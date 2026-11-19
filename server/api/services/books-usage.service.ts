import { lt, sql } from "drizzle-orm";
import { reportInfo } from "../utils/error-reporting";
import { books_usage_events } from "@shared/schema";
import { db } from "../config/db";
import {
  BOOKS_AREAS,
  booksCohort,
  type BooksArea,
  type BooksCohort,
  type BooksUsageEvent,
  type BooksUsageResponse,
  type BooksUsageRow,
} from "@shared/books-usage";

/**
 * PRIVACY: this module may only COUNT rows and read their created_at.
 * It must never select a text, amount or jsonb column from a Books table,
 * and must never touch books_audit_log (the freelancer's own audit trail).
 * books-usage.privacy.test.ts enforces both.
 */

const TABLES: Record<BooksArea, string> = {
  earnings: "earnings_entries",
  expenses: "expenses",
  mileage: "mileage_trips",
  kit: "kit_items",
  invoices: "invoices",
  imports: "import_batches",
};

type RawRow = {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  signed_up: Date | string;
  area: BooksArea | null;
  n: number | string | null;
  first_at: Date | string | null;
  last_at: Date | string | null;
  workbook: boolean;
};

const iso = (d: Date | string | null): string | null =>
  d == null ? null : new Date(d).toISOString().slice(0, 10);

export async function booksUsage(now: Date = new Date()): Promise<BooksUsageResponse> {
  const unions = BOOKS_AREAS.map(
    (a) =>
      `SELECT freelancer_id, '${a}' AS area, COUNT(*) AS n, MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM ${TABLES[a]} GROUP BY freelancer_id`
  ).join(" UNION ALL ");

  const raw = (await db.execute(
    sql.raw(`
      WITH per_area AS (${unions})
      SELECT u.id AS user_id, u.first_name, u.last_name, u.created_at AS signed_up,
             p.area, p.n, p.first_at, p.last_at,
             EXISTS (SELECT 1 FROM books_usage_events e
                     WHERE e.user_id = u.id AND e.event = 'workbook.downloaded') AS workbook
      FROM users u
      LEFT JOIN per_area p ON p.freelancer_id = u.id
      WHERE u.role = 'freelancer'
    `)
  )) as unknown as RawRow[];

  const byUser = new Map<number, BooksUsageRow>();
  for (const r of raw) {
    let row = byUser.get(r.user_id);
    if (!row) {
      row = {
        user_id: r.user_id,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || `User ${r.user_id}`,
        signed_up: iso(r.signed_up)!,
        counts: Object.fromEntries(BOOKS_AREAS.map((a) => [a, 0])) as Record<BooksArea, number>,
        total_records: 0,
        first_activity: null,
        last_activity: null,
        workbook_downloaded: Boolean(r.workbook),
        cohort: "never",
      };
      byUser.set(r.user_id, row);
    }
    if (r.area) {
      const n = Number(r.n ?? 0);
      row.counts[r.area] = n;
      row.total_records += n;
      const f = iso(r.first_at);
      const l = iso(r.last_at);
      if (f && (!row.first_activity || f < row.first_activity)) row.first_activity = f;
      if (l && (!row.last_activity || l > row.last_activity)) row.last_activity = l;
    }
  }

  const cohorts: Record<BooksCohort, number> = {
    active: 0,
    slowing: 0,
    lapsed: 0,
    tried: 0,
    never: 0,
  };
  const rows = Array.from(byUser.values());
  for (const row of rows) {
    row.cohort = booksCohort(row.total_records, row.last_activity, now);
    cohorts[row.cohort]++;
  }
  rows.sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""));
  return { cohorts, rows };
}

/** Record one usage event: the day only, a fixed event name, nothing else. */
export async function logBooksEvent(userId: number, event: BooksUsageEvent): Promise<void> {
  try {
    await db
      .insert(books_usage_events)
      .values({ user_id: userId, event, occurred_on: sql`CURRENT_DATE` as unknown as string });
  } catch (err) {
    console.error("[books-usage] log failed (non-fatal):", err);
  }
}

/** Retention: events older than 24 months are deleted. */
export async function pruneBooksEvents(): Promise<void> {
  const due = lt(books_usage_events.occurred_on, sql`CURRENT_DATE - INTERVAL '24 months'`);
  const [plan] = await db
    .select({
      rows: sql<number>`count(*)::int`,
      from: sql<string | null>`min(${books_usage_events.occurred_on})::text`,
      to: sql<string | null>`max(${books_usage_events.occurred_on})::text`,
    })
    .from(books_usage_events)
    .where(due);
  if (!plan?.rows) return;
  reportInfo(`books-usage prune: deleting ${plan.rows} events`, {
    job: "books-usage-prune",
    rows: plan.rows,
    occurred_from: plan.from,
    occurred_to: plan.to,
  });
  const gone = await db
    .delete(books_usage_events)
    .where(due)
    .returning({ id: books_usage_events.id });
  reportInfo(`books-usage prune: deleted ${gone.length} events`, {
    job: "books-usage-prune",
    rows: gone.length,
  });
}
