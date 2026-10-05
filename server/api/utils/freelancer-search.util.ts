import { freelancer_profiles } from "@shared/schema";
import { or, sql, type SQL } from "drizzle-orm";
import { getNearbyLocationNames } from "./uk-coordinates";

/** Keyword filter: title, full name, bio, or individual skills (case-insensitive). */
export function freelancerKeywordCondition(keyword: string): SQL {
  const searchTerm = `%${keyword.trim().toLowerCase()}%`;
  return or(
    sql`LOWER(${freelancer_profiles.title}) LIKE ${searchTerm}`,
    sql`LOWER(CONCAT(${freelancer_profiles.first_name}, ' ', ${freelancer_profiles.last_name})) LIKE ${searchTerm}`,
    sql`LOWER(${freelancer_profiles.bio}) LIKE ${searchTerm}`,
    sql`EXISTS (
      SELECT 1 FROM unnest(${freelancer_profiles.skills}) AS skill
      WHERE LOWER(skill) LIKE ${searchTerm}
    )`
  )!;
}

/**
 * Location filter (case-insensitive). Matches the typed place as a substring AND
 * fans out to nearby known locations, so a city search also returns its
 * sub-locations — e.g. "London" matches freelancers stored under its boroughs
 * (Camden, Westminster, …) instead of excluding them. Places outside the
 * coordinate table simply fall back to the plain substring match.
 */
export function freelancerLocationCondition(location: string): SQL {
  const base = location.trim().toLowerCase();
  const terms = new Set<string>([base, ...getNearbyLocationNames(location)]);
  const conditions = Array.from(terms)
    .filter((term) => term.length > 0)
    .map((term) => sql`LOWER(${freelancer_profiles.location}) LIKE ${`%${term}%`}`);
  return conditions.length === 1 ? conditions[0] : or(...conditions)!;
}
