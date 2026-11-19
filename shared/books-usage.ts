/**
 * Books usage for the admin panel — counts and dates only, never content.
 *
 * A cohort is derived from how many Books records someone has and when they
 * last wrote one. Nothing here is collected for the purpose: it is a count of
 * records the freelancer already keeps, so it disappears with them.
 */
export const BOOKS_AREAS = [
  "earnings",
  "expenses",
  "mileage",
  "kit",
  "invoices",
  "imports",
] as const;
export type BooksArea = (typeof BOOKS_AREAS)[number];

export type BooksCohort = "active" | "slowing" | "lapsed" | "tried" | "never";

/** The only events the usage log accepts. Mirrored by a CHECK constraint. */
export const BOOKS_USAGE_EVENTS = [
  "workbook.downloaded",
  "receipt.captured",
  "receipt.filed",
] as const;
export type BooksUsageEvent = (typeof BOOKS_USAGE_EVENTS)[number];

const DAY = 86_400_000;
export const TRIED_MAX_RECORDS = 5;

export function booksCohort(
  totalRecords: number,
  lastActivity: string | Date | null,
  now: Date = new Date()
): BooksCohort {
  if (totalRecords === 0 || !lastActivity) return "never";
  const days = (now.getTime() - new Date(lastActivity).getTime()) / DAY;
  if (days <= 30) return "active";
  if (days <= 90) return "slowing";
  return totalRecords > TRIED_MAX_RECORDS ? "lapsed" : "tried";
}

/** One row of the admin list. Every field is an id, a name, a number, a date or a label. */
export interface BooksUsageRow {
  user_id: number;
  name: string;
  signed_up: string;
  counts: Record<BooksArea, number>;
  total_records: number;
  first_activity: string | null;
  last_activity: string | null;
  workbook_downloaded: boolean;
  cohort: BooksCohort;
}

export interface BooksUsageResponse {
  cohorts: Record<BooksCohort, number>;
  rows: BooksUsageRow[];
}
