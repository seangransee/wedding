import {
  ensureWeddingPhotoRecords,
  listWeddingPhotoRecords,
  type WeddingPhotoRecord,
} from "@/lib/db";
import photoManifest from "@/lib/generated/photo-manifest.json";

export type PhotoSource = {
  src: string;
  width: number;
  height: number;
};

export type WeddingPhoto = {
  filename: string;
  src: string;
  srcSet: PhotoSource[];
  width: number;
  height: number;
  alt: string;
  lightboxSrc: string;
  lightboxSrcSet: PhotoSource[];
};

export type AdminWeddingPhoto = WeddingPhoto & {
  sortOrder: number;
  hiddenAt: string | null;
};

type PhotoManifestEntry = {
  filename: string;
  width: number;
  height: number;
  thumbnail: PhotoSource[];
  lightbox: PhotoSource[];
};

const manifestEntries = photoManifest as PhotoManifestEntry[];
const manifestByFilename = new Map(
  manifestEntries.map((entry) => [entry.filename, entry]),
);
const filenameCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

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

function getPrimarySource(sources: PhotoSource[]) {
  return sources.at(-1) ?? null;
}

function toWeddingPhoto(entry: PhotoManifestEntry, alt: string) {
  const thumbnail = getPrimarySource(entry.thumbnail);
  const lightbox = getPrimarySource(entry.lightbox) ?? thumbnail;

  if (!thumbnail || !lightbox) {
    return null;
  }

  return {
    filename: entry.filename,
    src: thumbnail.src,
    srcSet: entry.thumbnail,
    width: entry.width,
    height: entry.height,
    alt,
    lightboxSrc: lightbox.src,
    lightboxSrcSet: entry.lightbox.length > 0 ? entry.lightbox : [lightbox],
  };
}

function getWeddingPhotoFilenames() {
  return manifestEntries.map((entry) => entry.filename);
}

export function isKnownWeddingPhotoFilename(filename: string) {
  return manifestByFilename.has(filename);
}

export async function getWeddingPhotos(): Promise<WeddingPhoto[]> {
  const filenames = getWeddingPhotoFilenames();
  const records = await listWeddingPhotoRecords(filenames);
  const metadataByFilename = new Map(records.map((record) => [record.filename, record]));

  const photos = manifestEntries
    .map((entry, index) => {
      if (metadataByFilename.get(entry.filename)?.hiddenAt) {
        return null;
      }

      const photo = toWeddingPhoto(entry, `Wedding photo ${index + 1}`);

      return photo ? { ...photo, originalIndex: index } : null;
    })
    .filter((photo): photo is WeddingPhoto & { originalIndex: number } => photo !== null);

  return sortPhotoEntries(photos, metadataByFilename).map((photo, index) => ({
    filename: photo.filename,
    src: photo.src,
    srcSet: photo.srcSet,
    width: photo.width,
    height: photo.height,
    alt: `Wedding photo ${index + 1}`,
    lightboxSrc: photo.lightboxSrc,
    lightboxSrcSet: photo.lightboxSrcSet,
  }));
}

export async function getAdminWeddingPhotos(): Promise<AdminWeddingPhoto[]> {
  const filenames = getWeddingPhotoFilenames();
  await ensureWeddingPhotoRecords(filenames);

  const records = await listWeddingPhotoRecords(filenames);
  const metadataByFilename = new Map(records.map((record) => [record.filename, record]));
  const photos = manifestEntries
    .map((entry, index) => {
      const metadata = metadataByFilename.get(entry.filename);
      const photo = toWeddingPhoto(entry, `Wedding photo ${index + 1}`);

      if (!photo) {
        return null;
      }

      return {
        ...photo,
        originalIndex: index,
        sortOrder: metadata?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        hiddenAt: metadata?.hiddenAt ?? null,
      };
    })
    .filter((photo): photo is AdminWeddingPhoto & { originalIndex: number } => photo !== null);

  return sortPhotoEntries(photos, metadataByFilename).map((photo, index) => ({
    filename: photo.filename,
    src: photo.src,
    srcSet: photo.srcSet,
    width: photo.width,
    height: photo.height,
    alt: `Wedding photo ${index + 1}`,
    lightboxSrc: photo.lightboxSrc,
    lightboxSrcSet: photo.lightboxSrcSet,
    sortOrder: photo.sortOrder,
    hiddenAt: photo.hiddenAt,
  }));
}

export async function getCurrentWeddingPhotoFilenames() {
  return getWeddingPhotoFilenames();
}
