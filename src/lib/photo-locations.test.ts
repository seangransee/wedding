import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTO_LOCATION_MAX_LENGTH,
  isPhotoCountryCode,
  photoCountryFlag,
  photoCountryName,
  validatePhotoLocation,
} from "./photo-locations.ts";

test("only real country codes produce flags", () => {
  assert.equal(photoCountryFlag("US"), "🇺🇸");
  assert.equal(photoCountryFlag("IN"), "🇮🇳");
  for (const code of ["", "us", "ZZ", "<script>"]) {
    assert.equal(photoCountryFlag(code), "");
  }
  assert.equal(isPhotoCountryCode("ZZ"), false);
  assert.equal(isPhotoCountryCode(""), true);
});

test("country labels are deterministic for regions with different ICU names", () => {
  assert.equal(photoCountryName("HK"), "Hong Kong");
  assert.equal(photoCountryName("MO"), "Macau");
  assert.equal(photoCountryName("US"), "United States");
  assert.equal(photoCountryName("ZZ"), "");
});

test("locations can be cleared and country text stays freely editable", () => {
  assert.equal(validatePhotoLocation("", ""), null);
  assert.equal(validatePhotoLocation("US", "Chicago, Illinois"), null);
  assert.equal(validatePhotoLocation("IN", "Thar Desert, India"), null);
  assert.equal(validatePhotoLocation("", "Somewhere special"), null);
  assert.ok(validatePhotoLocation("ZZ", "Somewhere"));
  assert.ok(validatePhotoLocation(null, "Somewhere"));
  assert.ok(validatePhotoLocation("US", null));
  assert.equal(validatePhotoLocation("US", "x".repeat(PHOTO_LOCATION_MAX_LENGTH)), null);
  assert.ok(validatePhotoLocation("US", "x".repeat(PHOTO_LOCATION_MAX_LENGTH + 1)));
});
