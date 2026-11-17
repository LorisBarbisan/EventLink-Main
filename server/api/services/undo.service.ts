/**
 * Undo for earnings and expenses: archive (never delete), list what was
 * recently removed, restore, sweep after 30 days, and "start your books again".
 *
 * Every removal path — rollback, delete, start again — sets archived=true and
 * archived_at, so it is recoverable from Recently removed for 30 days. All
 * existing lists and totals already filter archived=false.
 */

import { and, eq, gte, isNotNull, isNull, lt, ne, or, sql, desc } from "drizzle-orm";
import { db } from "../config/db";
import { bookings, earnings_entries, expenses, import_batches } from "@shared/schema";

export const RETENTION_DAYS = 30;

const retentionCutoff = () => new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

export type UndoTable = "earnings" | "expenses";

// ── Recently removed ──────────────────────────────────────────────────────────

export interface RemovedRecord {
  id: number;
  date: string;
  description: string;
  amount_pence: number;
  currency: string;
  archived_at: string;
  removed_by: string; // "Rolled back: file.csv" | "Start again" | "Deleted"
  restore_until: string;
}

function removedBy(
  batchFile: string | null,
  archivedByBatch: number | null,
  bookingStatus?: string | null
): string {
  if (archivedByBatch != null) return `Import rolled back${batchFile ? `: ${batchFile}` : ""}`;
  // Cancelling a booking archives its earnings line: say so, or it reads as
  // something the freelancer deleted.
  if (bookingStatus === "cancelled") return "Booking cancelled";
  return "Removed";
}

export async function listRemoved(
  freelancerId: number,
  table: UndoTable
): Promise<RemovedRecord[]> {
  const cutoff = retentionCutoff();
  const restoreUntil = (at: Date) =>
    new Date(at.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  if (table === "earnings") {
    const rows = await db
      .select({
        id: earnings_entries.id,
        date: earnings_entries.work_date,
        description: earnings_entries.description,
        amount_pence: earnings_entries.gross_amount_pence,
        currency: earnings_entries.currency,
        archived_at: earnings_entries.archived_at,
        batch_id: earnings_entries.archived_by_batch_id,
        batch_file: import_batches.file_name,
        booking_status: bookings.status,
      })
      .from(earnings_entries)
      .leftJoin(import_batches, eq(earnings_entries.archived_by_batch_id, import_batches.id))
      .leftJoin(bookings, eq(earnings_entries.booking_id, bookings.id))
      .where(
        and(
          eq(earnings_entries.freelancer_id, freelancerId),
          eq(earnings_entries.archived, true),
          isNotNull(earnings_entries.archived_at),
          gte(earnings_entries.archived_at, cutoff)
        )
      )
      .orderBy(desc(earnings_entries.archived_at))
      .limit(500);
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      amount_pence: r.amount_pence,
      currency: r.currency,
      archived_at: r.archived_at!.toISOString(),
      removed_by: removedBy(r.batch_file, r.batch_id, r.booking_status),
      restore_until: restoreUntil(r.archived_at!),
    }));
  }

  const rows = await db
    .select({
      id: expenses.id,
      date: expenses.expense_date,
      description: expenses.description,
      net: expenses.net_amount_pence,
      vat: expenses.vat_amount_pence,
      currency: expenses.currency,
      archived_at: expenses.archived_at,
      batch_id: expenses.archived_by_batch_id,
      batch_file: import_batches.file_name,
    })
    .from(expenses)
    .leftJoin(import_batches, eq(expenses.archived_by_batch_id, import_batches.id))
    .where(
      and(
        eq(expenses.freelancer_id, freelancerId),
        eq(expenses.archived, true),
        isNotNull(expenses.archived_at),
        gte(expenses.archived_at, cutoff)
      )
    )
    .orderBy(desc(expenses.archived_at))
    .limit(500);
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    amount_pence: r.net + r.vat,
    currency: r.currency,
    archived_at: r.archived_at!.toISOString(),
    removed_by: removedBy(r.batch_file, r.batch_id),
    restore_until: restoreUntil(r.archived_at!),
  }));
}

/** Restore one archived record. Returns false if it is not this freelancer's. */
export async function restoreRecord(
  freelancerId: number,
  table: UndoTable,
  id: number
): Promise<boolean> {
  const set = {
    archived: false,
    archived_at: null,
    archived_by_batch_id: null,
    updated_at: new Date(),
  };
  const rows =
    table === "earnings"
      ? await db
          .update(earnings_entries)
          .set(set)
          .where(and(eq(earnings_entries.id, id), eq(earnings_entries.freelancer_id, freelancerId)))
          .returning({ id: earnings_entries.id })
      : await db
          .update(expenses)
          .set(set)
          .where(and(eq(expenses.id, id), eq(expenses.freelancer_id, freelancerId)))
          .returning({ id: expenses.id });
  return rows.length > 0;
}

// ── Nightly sweep ─────────────────────────────────────────────────────────────

/** Hard-delete records archived more than RETENTION_DAYS ago. */
export async function sweepArchived(): Promise<void> {
  const cutoff = retentionCutoff();
  for (const [name, table] of [
    ["earnings_entries", earnings_entries],
    ["expenses", expenses],
  ] as const) {
    try {
      const gone = await db
        .delete(table)
        .where(
          and(eq(table.archived, true), isNotNull(table.archived_at), lt(table.archived_at, cutoff))
        )
        .returning({ id: table.id });
      if (gone.length) console.log(`[undo-sweep] deleted ${gone.length} archived ${name}`);
    } catch (err) {
      // A row still referenced elsewhere blocks the whole delete; it stays archived.
      console.error(`[undo-sweep] ${name} sweep failed:`, err);
    }
  }
}

// ── Start your books again ────────────────────────────────────────────────────

export type ResetScope = "all" | "keep_eventlink" | "imported";

/**
 * Which records each scope clears. "EventLink work" is anything that came
 * through a booking on the platform — the work EventLink can reconstruct —
 * so keep_eventlink spares it.
 */
function earningsScope(freelancerId: number, scope: ResetScope) {
  const base = and(
    eq(earnings_entries.freelancer_id, freelancerId),
    eq(earnings_entries.archived, false)
  );
  if (scope === "all") return base;
  if (scope === "imported") return and(base, eq(earnings_entries.source, "imported"));
  return and(base, isNull(earnings_entries.booking_id), ne(earnings_entries.source, "booking"));
}

function expensesScope(freelancerId: number, scope: ResetScope) {
  const base = and(eq(expenses.freelancer_id, freelancerId), eq(expenses.archived, false));
  if (scope === "all") return base;
  if (scope === "imported") return and(base, eq(expenses.source, "imported"));
  return and(base, isNull(expenses.booking_id));
}

export async function resetCounts(freelancerId: number) {
  const count = async (scope: ResetScope) => {
    const [[e], [x]] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(earnings_entries)
        .where(earningsScope(freelancerId, scope)),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(expenses)
        .where(expensesScope(freelancerId, scope)),
    ]);
    return { earnings: e.n, expenses: x.n };
  };
  const [all, keepEventlink, imported] = await Promise.all([
    count("all"),
    count("keep_eventlink"),
    count("imported"),
  ]);
  const [{ n: eventlinkJobs }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(earnings_entries)
    .where(
      and(
        eq(earnings_entries.freelancer_id, freelancerId),
        eq(earnings_entries.archived, false),
        or(isNotNull(earnings_entries.booking_id), eq(earnings_entries.source, "booking"))
      )
    );
  const [{ n: importCount }] = await db
    .select({ n: sql<number>`count(distinct ${earnings_entries.import_batch_id})::int` })
    .from(earnings_entries)
    .where(earningsScope(freelancerId, "imported"));
  return {
    all,
    keep_eventlink: keepEventlink,
    imported,
    eventlink_jobs: eventlinkJobs,
    imports: importCount,
  };
}

export async function resetBooks(freelancerId: number, scope: ResetScope) {
  const now = new Date();
  const set = { archived: true, archived_at: now, updated_at: now };
  return db.transaction(async (tx) => {
    const e = await tx
      .update(earnings_entries)
      .set(set)
      .where(earningsScope(freelancerId, scope))
      .returning({ id: earnings_entries.id });
    const x = await tx
      .update(expenses)
      .set(set)
      .where(expensesScope(freelancerId, scope))
      .returning({ id: expenses.id });
    return { earnings: e.length, expenses: x.length };
  });
}

// Re-exported so callers need not import drizzle helpers to archive one row.
export async function archiveOne(freelancerId: number, table: UndoTable, id: number) {
  const now = new Date();
  const set = { archived: true, archived_at: now, updated_at: now };
  if (table === "earnings") {
    await db
      .update(earnings_entries)
      .set(set)
      .where(and(eq(earnings_entries.id, id), eq(earnings_entries.freelancer_id, freelancerId)));
  } else {
    await db
      .update(expenses)
      .set(set)
      .where(and(eq(expenses.id, id), eq(expenses.freelancer_id, freelancerId)));
  }
}
