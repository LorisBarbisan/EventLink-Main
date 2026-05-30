import { freelancer_profiles } from "@shared/schema";
import { or, sql, type SQL } from "drizzle-orm";

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

/** Location filter (case-insensitive partial match). */
export function freelancerLocationCondition(location: string): SQL {
  const locationTerm = `%${location.trim().toLowerCase()}%`;
  return sql`LOWER(${freelancer_profiles.location}) LIKE ${locationTerm}`;
}
