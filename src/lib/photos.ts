import { existsSync } from "fs";
import { readdir, stat } from "fs/promises";
import path from "path";
import { imageSizeFromFile } from "image-size/fromFile";
import {
  ensureWeddingPhotoRecords,
  listWeddingPhotoRecords,
  type WeddingPhotoRecord,
} from "@/lib/db";

export type WeddingPhoto = {
  filename: string;
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type AdminWeddingPhoto = WeddingPhoto & {
  sortOrder: number;
  hiddenAt: string | null;
};

const photosDirectory = path.join(process.cwd(), "photos");
const supportedPhotoExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

const contentTypes = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const filenameCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const deterministicPhotoSeed = "sexi-wedding-photo-gallery-v2";

function deterministicPhotoRank(filename: string) {
  let hash = 0x811c9dc5;
  const value = `${deterministicPhotoSeed}:${filename.toLowerCase()}`;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function comparePhotoFilenames(first: string, second: string) {
  const rankDifference = deterministicPhotoRank(first) - deterministicPhotoRank(second);

  if (rankDifference !== 0) {
    return rankDifference;
  }

  return filenameCollator.compare(first, second);
}

export function getPhotosDirectory() {
  return photosDirectory;
}

export function isSupportedPhotoFilename(filename: string) {
  return supportedPhotoExtensions.has(path.extname(filename).toLowerCase());
}

export function getPhotoContentType(filename: string) {
  return contentTypes.get(path.extname(filename).toLowerCase()) ?? "application/octet-stream";
}

export function getSafePhotoPath(filename: string) {
  if (
    !filename ||
    filename !== path.basename(filename) ||
    filename.includes("/") ||
    filename.includes("\\") ||
    !isSupportedPhotoFilename(filename)
  ) {
    return null;
  }

  const filePath = path.join(photosDirectory, filename);
  const relativePath = path.relative(photosDirectory, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
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

async function getPhotoDimensions(filename: string) {
  const filePath = path.join(photosDirectory, filename);
  const dimensions = await imageSizeFromFile(filePath);

  if (!dimensions.width || !dimensions.height) {
    return null;
  }

  return {
    width: dimensions.width,
    height: dimensions.height,
  };
}

function sortPhotoEntries<T extends { filename: string; originalIndex: number }>(
  photos: T[],
  metadataByFilename: Map<string, WeddingPhotoRecord>,
) {
  return photos.sort((first, second) => {
    const firstMetadata = metadataByFilename.get(first.filename);
    const secondMetadata = metadataByFilename.get(second.filename);
    const firstSortOrder = firstMetadata?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const secondSortOrder = secondMetadata?.sortOrder ?? Number.MAX_SAFE_INTEGER;

    return (
      firstSortOrder - secondSortOrder ||
      first.originalIndex - second.originalIndex ||
      filenameCollator.compare(first.filename, second.filename)
    );
  });
}

export async function getWeddingPhotos(): Promise<WeddingPhoto[]> {
  const filenames = await getWeddingPhotoFilenames();
  const records = await listWeddingPhotoRecords(filenames);
  const metadataByFilename = new Map(records.map((record) => [record.filename, record]));

  const photos = await Promise.all(
    filenames.map(async (filename, index) => {
      const dimensions = await getPhotoDimensions(filename);

      if (!dimensions || metadataByFilename.get(filename)?.hiddenAt) {
        return null;
      }

      return {
        filename,
        src: `/photos/${encodeURIComponent(filename)}`,
        width: dimensions.width,
        height: dimensions.height,
        alt: `Wedding photo ${index + 1}`,
        originalIndex: index,
      };
    }),
  );

  return sortPhotoEntries(
    photos.filter((photo): photo is WeddingPhoto & { originalIndex: number } => photo !== null),
    metadataByFilename,
  ).map((photo, index) => ({
    filename: photo.filename,
    src: photo.src,
    width: photo.width,
    height: photo.height,
    alt: `Wedding photo ${index + 1}`,
  }));
}

export async function getAdminWeddingPhotos(): Promise<AdminWeddingPhoto[]> {
  const filenames = await getWeddingPhotoFilenames();
  await ensureWeddingPhotoRecords(filenames);

  const records = await listWeddingPhotoRecords(filenames);
  const metadataByFilename = new Map(records.map((record) => [record.filename, record]));
  const photos = await Promise.all(
    filenames.map(async (filename, index) => {
      const dimensions = await getPhotoDimensions(filename);

      if (!dimensions) {
        return null;
      }

      const metadata = metadataByFilename.get(filename);

      return {
        filename,
        src: `/photos/${encodeURIComponent(filename)}`,
        width: dimensions.width,
        height: dimensions.height,
        alt: `Wedding photo ${index + 1}`,
        originalIndex: index,
        sortOrder: metadata?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        hiddenAt: metadata?.hiddenAt ?? null,
      };
    }),
  );

  return sortPhotoEntries(
    photos.filter((photo): photo is AdminWeddingPhoto & { originalIndex: number } => photo !== null),
    metadataByFilename,
  ).map((photo, index) => ({
    filename: photo.filename,
    src: photo.src,
    width: photo.width,
    height: photo.height,
    alt: `Wedding photo ${index + 1}`,
    sortOrder: photo.sortOrder,
    hiddenAt: photo.hiddenAt,
  }));
}

export async function getCurrentWeddingPhotoFilenames() {
  return getWeddingPhotoFilenames();
}

export async function getPhotoFile(filename: string) {
  const filePath = getSafePhotoPath(filename);

  if (!filePath) {
    return null;
  }

  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile()) {
      return null;
    }

    return {
      filePath,
      size: fileStats.size,
      contentType: getPhotoContentType(filename),
    };
  } catch {
    return null;
  }
}
