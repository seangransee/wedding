import countries from "./photo-countries.json" with { type: "json" };

// Static names keep server and browser output identical across ICU versions.
const countryCodeSet = new Set(countries.map(({ code }) => code));
const countryNames = new Map(countries.map(({ code, name }) => [code, name]));

export const PHOTO_LOCATION_MAX_LENGTH = 160;

export function isPhotoCountryCode(code: string) {
  return code === "" || countryCodeSet.has(code);
}

export function photoCountryName(code: string) {
  return countryNames.get(code) ?? "";
}

export function photoCountryFlag(code: string) {
  if (!code || !countryCodeSet.has(code)) return "";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

export const photoCountries = countries.map(({ code, name }) => ({
  code, name, flag: photoCountryFlag(code),
}));

export function validatePhotoLocation(countryCode: unknown, locationText: unknown) {
  if (typeof countryCode !== "string" || !isPhotoCountryCode(countryCode)) {
    return "Choose a valid country.";
  }
  if (typeof locationText !== "string" || locationText.trim().length > PHOTO_LOCATION_MAX_LENGTH) {
    return `Keep the location to ${PHOTO_LOCATION_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}
