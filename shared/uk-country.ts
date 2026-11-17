/**
 * The one rule for "is this freelancer UK-based", used on both sides of the
 * Books gate (server middleware and client hook). Canonical stored value is
 * "United Kingdom"; common variants are accepted defensively.
 */

const UK_COUNTRY_VALUES = new Set([
  "united kingdom",
  "uk",
  "gb",
  "gbr",
  "great britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
]);

/** No country given: null, undefined, or only whitespace. Treated as unanswered. */
export function isCountryUnset(country: unknown): boolean {
  return typeof country !== "string" || country.trim() === "";
}

export function isUkCountry(country: unknown): boolean {
  if (typeof country !== "string") return false;
  return UK_COUNTRY_VALUES.has(country.trim().toLowerCase());
}
