import { and, eq, inArray, isNotNull, sql, or, isNull } from "drizzle-orm";
import { db } from "../config/db";
import {
  import_batches,
  import_rows,
  earnings_entries,
  expenses,
  expense_categories,
} from "@shared/schema";
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

async function writeRecord(
  row: ImportRow,
  freelancerId: number
): Promise<{ table: string; id: number } | null> {
  const parsed = (row.parsed ?? {}) as Record<string, unknown>;

  if (row.target === "earnings") {
    const description = String(parsed.description ?? "Imported earnings entry");
    const workDate = String(parsed.date ?? new Date().toISOString().slice(0, 10));
    const grossPence = typeof parsed.amount_pence === "number" ? parsed.amount_pence : 0;

    const [entry] = await db
      .insert(earnings_entries)
      .values({
        freelancer_id: freelancerId,
        source: "manual",
        description,
        work_date: workDate,
        gross_amount_pence: grossPence,
        status: "expected",
        needs_review: true, // imported rows start as needing manual review
        rate_raw: typeof parsed.rate_raw === "string" ? parsed.rate_raw : null,
        notes: typeof parsed.notes === "string" ? parsed.notes : null,
      })
      .returning({ id: earnings_entries.id });

    return { table: "earnings_entries", id: entry.id };
  }

  if (row.target === "expense") {
    const description = String(parsed.description ?? "Imported expense");
    const expenseDate = String(parsed.date ?? new Date().toISOString().slice(0, 10));
    const netPence = typeof parsed.amount_pence === "number" ? Math.abs(parsed.amount_pence) : 0;

    // Resolve category from parsed.category_name if present
    const categoryName = typeof parsed.category_name === "string" ? parsed.category_name : null;
    const categoryId = categoryName ? await resolveCategoryId(categoryName, freelancerId) : null;

    const [expense] = await db
      .insert(expenses)
      .values({
        freelancer_id: freelancerId,
        source: "bank",
        description,
        expense_date: expenseDate,
        net_amount_pence: netPence,
        vat_amount_pence: 0,
        category_id: categoryId,
        notes: typeof parsed.notes === "string" ? parsed.notes : null,
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
        const result = await writeRecord(row, freelancerId);
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
// Deletes every record that was created during commitBatch(), identified by
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
    // Delete from each ledger table
    if (byTable["earnings_entries"]?.length) {
      await tx
        .delete(earnings_entries)
        .where(inArray(earnings_entries.id, byTable["earnings_entries"]));
    }
    if (byTable["expenses"]?.length) {
      await tx.delete(expenses).where(inArray(expenses.id, byTable["expenses"]));
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
