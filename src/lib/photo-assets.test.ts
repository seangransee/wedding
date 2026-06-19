import assert from "node:assert/strict";
import test from "node:test";
import {
  getAvailablePhotoAssetWidths,
  getOptimizedPhotoAssetPath,
} from "./photo-assets.ts";

test("builds stable optimized photo asset paths for original filenames", () => {
  assert.equal(
    getOptimizedPhotoAssetPath({
      filename: "IMG_6140 (1).jpeg",
      variant: "thumbnail",
      width: 640,
    }),
    "/optimized-photos/thumbnail/img-6140-1-07cb7823e3-640.webp",
  );

  assert.equal(
    getOptimizedPhotoAssetPath({
      filename: "Sean & Lexi!.JPG",
      variant: "lightbox",
      width: 1600,
    }),
    "/optimized-photos/lightbox/sean-lexi-46b0aaccde-1600.webp",
  );
});

test("uses only useful responsive widths for each original photo", () => {
  assert.deepEqual(getAvailablePhotoAssetWidths("thumbnail", 1536), [
    360,
    640,
    960,
  ]);
  assert.deepEqual(getAvailablePhotoAssetWidths("lightbox", 1536), [1536]);
  assert.deepEqual(getAvailablePhotoAssetWidths("lightbox", 900), [900]);
});
