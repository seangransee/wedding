import { createHash } from "crypto";

export const PHOTO_ASSET_WIDTHS = {
  thumbnail: [360, 640, 960],
  lightbox: [1600],
} as const;

export type PhotoAssetVariant = keyof typeof PHOTO_ASSET_WIDTHS;

type PhotoAssetPathParams = {
  filename: string;
  variant: PhotoAssetVariant;
  width: number;
};

function getPhotoAssetSlug(filename: string) {
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

export function getOptimizedPhotoAssetPath({
  filename,
  variant,
  width,
}: PhotoAssetPathParams) {
  return `/optimized-photos/${variant}/${getPhotoAssetSlug(filename)}-${width}.webp`;
}

export function getAvailablePhotoAssetWidths(
  variant: PhotoAssetVariant,
  originalWidth: number,
) {
  const variantWidths = PHOTO_ASSET_WIDTHS[variant];
  const maxGeneratedWidth = variantWidths[variantWidths.length - 1];
  const widths: number[] = variantWidths.filter((width) => width <= originalWidth);

  if (originalWidth < maxGeneratedWidth && widths.at(-1) !== originalWidth) {
    widths.push(originalWidth);
  }

  return widths.length > 0 ? widths : [originalWidth];
}
