import { and, eq, inArray, isNotNull, sql, or, isNull } from "drizzle-orm";
import { db } from "../config/db";
import { storage } from "../../storage";
import {
  import_batches,
  import_rows,
  earnings_entries,
  expenses,
  expense_categories,
  receipts,
} from "@shared/schema";
import {
  earningDiffersFromImport,
  expenseDiffersFromImport,
  notesWithRef,
  type Parsed,
} from "./import-diff";
import type { ImportRow } from "@shared/schema";

// ── Category resolver ─────────────────────────────────────────────────────────
// Looks up an expense_categories.id by name (system or freelancer-owned).
// Returns null if not found — the expense is committed without a category.

async function resolveCategoryId(name: string, freelancerId: number): Promise<number | null> {
  const normalised = name.trim().toLowerCase().replace(/\s+/g, " ");
  const [row] = await db
    .select({ id: expense_categories.id })
    .from(expense_categories)
    .where(
      and(
        eq(expense_categories.normalised_name, normalised),
        eq(expense_categories.archived, false),
        or(
          eq(expense_categories.freelancer_id, freelancerId),
          isNull(expense_categories.freelancer_id)
        )
      )
    )
    .limit(1);
  return row?.id ?? null;
}

// ── Record writer dispatch ─────────────────────────────────────────────────────
// Called once per approved row during commitBatch(). Returns the table name and
// the ID of the created record so we can roll it back later, or null when the
// row's target is not yet implemented (skipped gracefully with needs_review flag).
//
// PR 5 (real parser) populates row.parsed with well-typed fields and replaces
// these stubs with the real insert logic.

// Writes go through the commit transaction (tx), so a crash part-way through
// leaves nothing behind.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeRecord(
  tx: Tx,
  row: ImportRow,
  freelancerId: number
): Promise<{ table: string; id: number } | null> {
  const parsed = (row.parsed ?? {}) as Record<string, unknown>;

  if (row.target === "earnings") {
    const description = String(parsed.description ?? "Imported earnings entry");
    const dateAssumed = !parsed.date;
    const workDate = String(parsed.date ?? new Date().toISOString().slice(0, 10));
    const rateRaw = typeof parsed.rate_raw === "string" ? parsed.rate_raw : null;
    const grossPence = typeof parsed.amount_pence === "number" ? parsed.amount_pence : 0;

    // Determine whether this entry genuinely needs review:
    //   unparsed_amount  — amount_pence absent (parser could not read it)
    //   ambiguous_amount — rate_raw contains a range like "£250-300"
    //   assumed_date     — no date column was present; we used today as a fallback
    //   zero_amount      — parsed to £0 from a non-empty source field
    // A clean row with a readable amount and a real date needs no review.
    type ReviewReason = "unparsed_amount" | "ambiguous_amount" | "assumed_date" | "zero_amount";
    let reviewReason: ReviewReason | null = null;
    if (typeof parsed.amount_pence !== "number") {
      reviewReason = "unparsed_amount";
    } else if (grossPence === 0 && rateRaw) {
      reviewReason = "zero_amount";
    } else if (rateRaw && /\d+\s*[-–]\s*\d+/.test(rateRaw)) {
      reviewReason = "ambiguous_amount";
    } else if (dateAssumed) {
      reviewReason = "assumed_date";
    }

    // The file's payee becomes the client; "Paid? YES" in the file marks it paid
    // on its date (the file gives no separate payment date).
    const payee = typeof parsed.payee === "string" ? parsed.payee.trim() : "";
    const client = payee ? await storage.findOrCreateClientByName(freelancerId, payee) : null;
    const paid = parsed.paid === true && !dateAssumed;

    const [entry] = await tx
      .insert(earnings_entries)
      .values({
        freelancer_id: freelancerId,
        source: "imported",
        import_batch_id: row.batch_id,
        client_id: client?.id ?? null,
        description,
        work_date: workDate,
        gross_amount_pence: grossPence,
        status: paid ? "paid" : "expected",
        paid_date: paid ? workDate : null,
        paid_amount_pence: paid ? grossPence : null,
        needs_review: reviewReason !== null,
        review_reason: reviewReason,
        rate_raw: rateRaw,
        notes: notesWithRef(parsed),
      })
      .returning({ id: earnings_entries.id });

    return { table: "earnings_entries", id: entry.id };
  }

  if (row.target === "expense") {
    const description = String(parsed.description ?? "Imported expense");
    const expenseDate = String(parsed.date ?? new Date().toISOString().slice(0, 10));
    // Amounts are what was paid (VAT included); split out VAT when the file gives it.
    const grossPence = typeof parsed.amount_pence === "number" ? Math.abs(parsed.amount_pence) : 0;
    const vatPence =
      typeof parsed.vat_pence === "number" ? Math.min(Math.abs(parsed.vat_pence), grossPence) : 0;
    const netPence = grossPence - vatPence;

    // Resolve category from parsed.category_name if present
    const categoryName = typeof parsed.category_name === "string" ? parsed.category_name : null;
    const categoryId = categoryName ? await resolveCategoryId(categoryName, freelancerId) : null;

    const [expense] = await tx
      .insert(expenses)
      .values({
        freelancer_id: freelancerId,
        source: "imported",
        import_batch_id: row.batch_id,
        description,
        expense_date: expenseDate,
        supplier: typeof parsed.payee === "string" && parsed.payee ? parsed.payee : null,
        net_amount_pence: netPence,
        vat_amount_pence: vatPence,
        category_id: categoryId,
        notes: notesWithRef(parsed),
      })
      .returning({ id: expenses.id });

    return { table: "expenses", id: expense.id };
  }

  // "skip" is an explicit no-op; "invoice" / "mileage" / "kit" are stubbed
  // here and implemented in PR 5 once the parser defines their parsed shapes.
  // The row keeps decision="approved" but gets no created_record_id, which the
  // UI surfaces as needing manual entry.
  return null;
}

// ── commitBatch ────────────────────────────────────────────────────────────────
// Writes all approved rows to the appropriate ledger tables.
// Runs the full set in a single transaction so a mid-commit crash leaves no
// partial state; the sweeper (below) detects batches stuck in 'committing' and
// marks them failed so the user can retry.

export async function commitBatch(batchId: number, freelancerId: number): Promise<void> {
  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, freelancerId)))
    .limit(1);

  if (!batch) throw new Error("Batch not found");
  if (batch.status !== "review") {
    throw Object.assign(new Error(`Cannot commit from status '${batch.status}'`), {
      httpStatus: 409,
    });
  }

  // Count approved rows
  const [{ approvedCount }] = await db
    .select({ approvedCount: sql<number>`count(*)::int` })
    .from(import_rows)
    .where(and(eq(import_rows.batch_id, batchId), eq(import_rows.decision, "approved")));

  if (approvedCount === 0) {
    throw Object.assign(
      new Error("No approved rows to commit. Approve at least one row before committing."),
      { httpStatus: 422 }
    );
  }

  // Mark as committing
  await db
    .update(import_batches)
    .set({ status: "committing", updated_at: new Date() })
    .where(eq(import_batches.id, batchId));

  try {
    const approvedRows = await db
      .select()
      .from(import_rows)
      .where(and(eq(import_rows.batch_id, batchId), eq(import_rows.decision, "approved")));

    let committedCount = 0;

    await db.transaction(async (tx) => {
      for (const row of approvedRows) {
        const result = await writeRecord(tx, row, freelancerId);
        if (result) {
          await tx
            .update(import_rows)
            .set({
              created_record_table: result.table,
              created_record_id: result.id,
            })
            .where(eq(import_rows.id, row.id));
          committedCount++;
        }
      }
    });

    await db
      .update(import_batches)
      .set({
        status: "committed",
        committed_count: committedCount,
        committed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(import_batches.id, batchId));
  } catch (err) {
    await db
      .update(import_batches)
      .set({
        status: "failed",
        error: `Commit failed: ${String(err)}`,
        updated_at: new Date(),
      })
      .where(eq(import_batches.id, batchId));
    throw err;
  }
}

// ── rollbackBatch ──────────────────────────────────────────────────────────────
// Archives (never deletes) every record that was created during commitBatch(), identified by
// created_record_table / created_record_id on each row. Only records this batch
// created are touched — existing records with the same IDs are not deleted
// (there is no ID overlap risk because we only track IDs we inserted).

export async function rollbackBatch(batchId: number, freelancerId: number): Promise<void> {
  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, freelancerId)))
    .limit(1);

  if (!batch) throw new Error("Batch not found");
  if (batch.status !== "committed") {
    throw Object.assign(
      new Error(
        `Cannot roll back from status '${batch.status}' — only committed batches can be rolled back`
      ),
      { httpStatus: 409 }
    );
  }

  // Collect all created records grouped by table
  const createdRows = await db
    .select({
      table: import_rows.created_record_table,
      id: import_rows.created_record_id,
    })
    .from(import_rows)
    .where(and(eq(import_rows.batch_id, batchId), isNotNull(import_rows.created_record_id)));

  const byTable: Record<string, number[]> = {};
  for (const r of createdRows) {
    if (r.table && r.id !== null) {
      (byTable[r.table] ??= []).push(r.id);
    }
  }

  await db.transaction(async (tx) => {
    // Archive, not delete: restorable for 30 days from Recently removed, then
    // hard-deleted by the nightly sweep. Scoped to this freelancer as well as
    // to the ids this batch created.
    const now = new Date();
    const archive = {
      archived: true,
      archived_at: now,
      archived_by_batch_id: batchId,
      updated_at: now,
    };
    if (byTable["earnings_entries"]?.length) {
      await tx
        .update(earnings_entries)
        .set(archive)
        .where(
          and(
            inArray(earnings_entries.id, byTable["earnings_entries"]),
            eq(earnings_entries.freelancer_id, freelancerId)
          )
        );
    }
    if (byTable["expenses"]?.length) {
      await tx
        .update(expenses)
        .set(archive)
        .where(
          and(inArray(expenses.id, byTable["expenses"]), eq(expenses.freelancer_id, freelancerId))
        );
    }

    // Clear tracking columns on the rows
    await tx
      .update(import_rows)
      .set({ created_record_table: null, created_record_id: null })
      .where(eq(import_rows.batch_id, batchId));

    // Mark batch rolled back
    await tx
      .update(import_batches)
      .set({
        status: "rolled_back",
        committed_count: 0,
        rolled_back_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(import_batches.id, batchId));
  });
}

// ── importImpact ───────────────────────────────────────────────────────────────
// What rolling a batch back would remove, and how much of it has been worked on
// since. "Edited" compares each record with what commit wrote from the file
// (see writeRecord), so housekeeping such as clearing the review flag does not
// count — only changes that carry work the file never had. "Linked" means an
// EventLink booking (imports never set one). Records are returned so the
// client can offer them as a download before acting.

export interface ImpactRecord {
  table: "earnings_entries" | "expenses";
  id: number;
  date: string;
  description: string;
  amount_pence: number;
  currency: string;
  edited: boolean;
  linked: boolean;
}

export async function importImpact(batchId: number, freelancerId: number) {
  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, freelancerId)))
    .limit(1);
  if (!batch) throw Object.assign(new Error("Batch not found"), { httpStatus: 404 });

  const created = await db
    .select({
      table: import_rows.created_record_table,
      id: import_rows.created_record_id,
      parsed: import_rows.parsed,
    })
    .from(import_rows)
    .where(and(eq(import_rows.batch_id, batchId), isNotNull(import_rows.created_record_id)));
  const ids = (t: string) => created.filter((r) => r.table === t).map((r) => r.id as number);
  const earningIds = ids("earnings_entries");
  const expenseIds = ids("expenses");

  const parsedFor = (t: string, id: number) =>
    (created.find((r) => r.table === t && r.id === id)?.parsed ?? {}) as Parsed;

  const records: ImpactRecord[] = [];
  if (earningIds.length) {
    const rows = await db
      .select()
      .from(earnings_entries)
      .where(
        and(
          inArray(earnings_entries.id, earningIds),
          eq(earnings_entries.freelancer_id, freelancerId)
        )
      );
    for (const e of rows) {
      records.push({
        table: "earnings_entries",
        id: e.id,
        date: e.work_date,
        description: e.description,
        amount_pence: e.gross_amount_pence,
        currency: e.currency,
        edited: earningDiffersFromImport(e, parsedFor("earnings_entries", e.id)),
        linked: e.booking_id != null,
      });
    }
  }
  if (expenseIds.length) {
    const rows = await db
      .select()
      .from(expenses)
      .where(and(inArray(expenses.id, expenseIds), eq(expenses.freelancer_id, freelancerId)));
    const withReceipts = new Set(
      (
        await db
          .select({ id: receipts.expense_id })
          .from(receipts)
          .where(inArray(receipts.expense_id, expenseIds))
      ).map((r) => r.id)
    );
    for (const x of rows) {
      records.push({
        table: "expenses",
        id: x.id,
        date: x.expense_date,
        description: x.description,
        amount_pence: x.net_amount_pence + x.vat_amount_pence,
        currency: x.currency,
        edited: expenseDiffersFromImport(x, parsedFor("expenses", x.id), withReceipts.has(x.id)),
        linked: x.booking_id != null || x.earnings_entry_id != null,
      });
    }
  }

  return {
    earnings: records.filter((r) => r.table === "earnings_entries").length,
    expenses: records.filter((r) => r.table === "expenses").length,
    edited: records.filter((r) => r.edited).length,
    linked: records.filter((r) => r.linked).length,
    records,
  };
}

// ── Sweeper ────────────────────────────────────────────────────────────────────
// Marks batches stuck in 'committing' as failed after 30 minutes.

export async function sweepStuckCommits(): Promise<void> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  // updated_at is refreshed when status changes to 'committing', so if it's
  // still 'committing' after 30 min the job has hung or crashed.
  const stuck = await db
    .select({ id: import_batches.id })
    .from(import_batches)
    .where(
      and(
        eq(import_batches.status, "committing"),
        sql`${import_batches.updated_at} < ${thirtyMinutesAgo}`
      )
    );

  if (stuck.length === 0) return;

  const ids = stuck.map((r) => r.id);
  await db
    .update(import_batches)
    .set({
      status: "failed",
      error: "Commit job timed out after 30 minutes",
      updated_at: new Date(),
    })
    .where(inArray(import_batches.id, ids));

  console.log(`[import-sweeper] marked ${ids.length} stuck commit(s) as failed: ${ids}`);
}
