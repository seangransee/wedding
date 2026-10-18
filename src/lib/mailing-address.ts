export type MailingAddress = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export const MAILING_ADDRESS_FIELDS = [
  "line1",
  "line2",
  "city",
  "region",
  "postalCode",
  "country",
] as const satisfies ReadonlyArray<keyof MailingAddress>;

export const MAILING_ADDRESS_MAX_LENGTH = 200;

export const EMPTY_MAILING_ADDRESS: MailingAddress = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

export function mailingAddressFormName(field: keyof MailingAddress) {
  return `mailingAddress${field[0].toUpperCase()}${field.slice(1)}`;
}

export function normalizeMailingAddress(address: MailingAddress): MailingAddress {
  return Object.fromEntries(
    MAILING_ADDRESS_FIELDS.map((field) => [
      field,
      address[field].replace(/\s+/g, " ").trim().slice(0, MAILING_ADDRESS_MAX_LENGTH),
    ]),
  ) as MailingAddress;
}

export function formatMailingAddress(address: MailingAddress) {
  const regionLine = [address.region, address.postalCode].filter(Boolean).join(" ");
  const cityLine = [address.city, regionLine].filter(Boolean).join(", ");

  return [address.line1, address.line2, cityLine, address.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

const US_COUNTRY_NAMES = new Set([
  "us",
  "usa",
  "u.s.",
  "u.s.a.",
  "united states",
  "united states of america",
]);

const POSTAL_CODE = String.raw`(\d{5}(?:-\d{4})?|[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d)`;
const CITY_STATE_POSTAL = new RegExp(String.raw`^(.+?)\s+([A-Za-z]{2})\.?\s+${POSTAL_CODE}$`);
const STATE_POSTAL = new RegExp(String.raw`^([A-Za-z][A-Za-z .]*?)\.?\s+${POSTAL_CODE}$`);

/**
 * Splits a whole pasted address ("123 Main St, Apt 4, Chicago, IL 60601") into
 * its fields. Returns null when the text doesn't look like a full address, so
 * the paste can fall through to the browser's normal behavior.
 */
export function parsePastedMailingAddress(text: string): MailingAddress | null {
  const parts = text
    .split(/[\n,]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  let country = "";
  const lastPart = parts[parts.length - 1];
  if (parts.length >= 3 && !/\d/.test(lastPart)) {
    country = US_COUNTRY_NAMES.has(lastPart.toLowerCase()) ? "" : lastPart;
    parts.pop();
  }

  const regionPart = parts.pop() ?? "";
  let city = "";
  let region = "";
  let postalCode = "";

  const cityStatePostal = regionPart.match(CITY_STATE_POSTAL);
  const statePostal = regionPart.match(STATE_POSTAL);

  if (cityStatePostal && !cityStatePostal[1].match(/\d/)) {
    [, city, region, postalCode] = cityStatePostal;
  } else if (statePostal && parts.length >= 2) {
    [, region, postalCode] = statePostal;
    city = parts.pop() ?? "";
  } else {
    return null;
  }

  const [line1, ...rest] = parts;
  if (!line1) {
    return null;
  }

  return normalizeMailingAddress({
    line1,
    line2: rest.join(", "),
    city,
    region: region.length === 2 ? region.toUpperCase() : region,
    postalCode: postalCode.toUpperCase(),
    country,
  });
}
