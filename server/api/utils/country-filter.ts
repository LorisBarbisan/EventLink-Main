import { inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Other spellings of the UK seen in stored country values (typed before the
 * country picker, or read off a CV).
 */
const UK_ALIASES = [
  "united kingdom",
  "uk",
  "u.k.",
  "gb",
  "great britain",
  "britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
];

/**
 * What a country filter matches, lower-cased. The boards start filtered to
 * the UK, and EventLink is UK-first: records saved before the country field
 * (or since, without one) have none, so the UK filter counts them as UK
 * rather than hiding them from the default view.
 */
export function countryFilterValues(country: string): { values: string[]; includeBlank: boolean } {
  const c = country.trim().toLowerCase();
  if (UK_ALIASES.includes(c)) return { values: UK_ALIASES, includeBlank: true };
  return { values: [c], includeBlank: false };
}

/** SQL for a country filter on `column`; case and surrounding spaces ignored. */
export function countryCondition(column: AnyPgColumn, country: string): SQL {
  const { values, includeBlank } = countryFilterValues(country);
  const match = inArray(sql`LOWER(TRIM(${column}))`, values);
  return includeBlank ? or(match, isNull(column), sql`TRIM(${column}) = ''`)! : match;
}
