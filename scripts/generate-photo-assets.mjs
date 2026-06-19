import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const photosDirectory = path.join(root, "photos");
const outputDirectory = path.join(root, "public", "optimized-photos");
const manifestPath = path.join(root, "src", "lib", "generated", "photo-manifest.json");
const supportedPhotoExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);
const photoAssetWidths = {
  thumbnail: [360, 640, 960],
  lightbox: [1600],
};
const photoAssetQuality = {
  thumbnail: 68,
  lightbox: 76,
};
const filenameCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
const deterministicPhotoSeed = "sexi-wedding-photo-gallery-v2";

function deterministicPhotoRank(filename) {
  let hash = 0x811c9dc5;
  const value = `${deterministicPhotoSeed}:${filename.toLowerCase()}`;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function comparePhotoFilenames(first, second) {
  const rankDifference = deterministicPhotoRank(first) - deterministicPhotoRank(second);

  if (rankDifference !== 0) {
    return rankDifference;
  }

  return filenameCollator.compare(first, second);
}

function isSupportedPhotoFilename(filename) {
  return supportedPhotoExtensions.has(path.extname(filename).toLowerCase());
}

function getPhotoAssetSlug(filename) {
  const extensionStart = filename.lastIndexOf(".");
  const filenameWithoutExtension =
    extensionStart > 0 ? filename.slice(0, extensionStart) : filename;
  const readableSlug =
    filenameWithoutExtension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "photo";
  const hash = createHash("sha1").update(filename).digest("hex").slice(0, 10);

  return `${readableSlug}-${hash}`;
}

function getOptimizedPhotoAssetPath({ filename, variant, width }) {
  return `/optimized-photos/${variant}/${getPhotoAssetSlug(filename)}-${width}.webp`;
}

function getAvailablePhotoAssetWidths(variant, originalWidth) {
  const variantWidths = photoAssetWidths[variant];
  const maxGeneratedWidth = variantWidths[variantWidths.length - 1];
  const widths = variantWidths.filter((width) => width <= originalWidth);

  if (originalWidth < maxGeneratedWidth && widths.at(-1) !== originalWidth) {
    widths.push(originalWidth);
  }

  return widths.length > 0 ? widths : [originalWidth];
}

function getConstrainedHeight({ originalHeight, originalWidth, width }) {
  return Math.round((originalHeight / originalWidth) * width);
}

async function getWeddingPhotoFilenames() {
  if (!existsSync(photosDirectory)) {
    return [];
  }

  const entries = await readdir(photosDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && isSupportedPhotoFilename(entry.name))
    .map((entry) => entry.name)
    .sort(comparePhotoFilenames);
}

async function writeVariant({ filename, originalHeight, originalWidth, variant, width }) {
  const outputPath = path.join(
    root,
    "public",
    getOptimizedPhotoAssetPath({ filename, variant, width }),
  );

  await sharp(path.join(photosDirectory, filename), { failOn: "none" })
    .rotate()
    .resize({
      width,
      withoutEnlargement: true,
    })
    .webp({
      effort: 5,
      quality: photoAssetQuality[variant],
    })
    .toFile(outputPath);

  return {
    src: getOptimizedPhotoAssetPath({ filename, variant, width }),
    width,
    height: getConstrainedHeight({ originalHeight, originalWidth, width }),
  };
}

async function generate() {
  const filenames = await getWeddingPhotoFilenames();
  const manifest = [];

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(path.join(outputDirectory, "thumbnail"), { recursive: true });
  await mkdir(path.join(outputDirectory, "lightbox"), { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });

  for (const filename of filenames) {
    const image = sharp(path.join(photosDirectory, filename), { failOn: "none" }).rotate();
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      continue;
    }

    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    const thumbnail = [];
    const lightbox = [];

    for (const width of getAvailablePhotoAssetWidths("thumbnail", originalWidth)) {
      thumbnail.push(
        await writeVariant({
          filename,
          originalHeight,
          originalWidth,
          variant: "thumbnail",
          width,
        }),
      );
    }

    for (const width of getAvailablePhotoAssetWidths("lightbox", originalWidth)) {
      lightbox.push(
        await writeVariant({
          filename,
          originalHeight,
          originalWidth,
          variant: "lightbox",
          width,
        }),
      );
    }

    manifest.push({
      filename,
      width: originalWidth,
      height: originalHeight,
      thumbnail,
      lightbox,
    });
  }

  await writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(`${manifestPath}.tmp`, manifestPath);

  console.log(`Generated ${manifest.length} photo manifest entries in ${outputDirectory}`);
}

await generate();
