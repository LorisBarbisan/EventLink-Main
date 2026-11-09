import { and, eq, sql } from "drizzle-orm";
import { db } from "../config/db";
import { earnings_entries, expenses, import_rows } from "@shared/schema";

// ── Description normalisation ─────────────────────────────────────────────────
// Specified in the epic §8: lowercase, strip punctuation (keep digits — card
// last-four and refs carry meaning), collapse whitespace, truncate at 60 chars.

export function normaliseDescription(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// ── Duplicate check ───────────────────────────────────────────────────────────
// Checks both live ledger tables and rows already committed by prior batches.
// Returns true if a matching record exists for this freelancer.
// Candidate key: date + amount_pence + normalised description.

export async function isDuplicate(params: {
  freelancerId: number;
  date: string; // ISO YYYY-MM-DD
  amountPence: number;
  description: string;
  target: "earnings" | "expense";
}): Promise<boolean> {
  const normDesc = normaliseDescription(params.description);
  const { freelancerId, date, amountPence, target } = params;

  if (target === "earnings") {
    // Check live earnings_entries
    const [live] = await db
      .select({ id: earnings_entries.id })
      .from(earnings_entries)
      .where(
        and(
          eq(earnings_entries.freelancer_id, freelancerId),
          eq(earnings_entries.work_date, date),
          eq(earnings_entries.gross_amount_pence, amountPence),
          sql`lower(regexp_replace(regexp_replace(${earnings_entries.description}, '[^a-z0-9 ]', ' ', 'gi'), '\s+', ' ', 'g'))
              like ${normDesc.slice(0, 60)}`
        )
      )
      .limit(1);
    if (live) return true;
  }

  if (target === "expense") {
    // Check live expenses
    const [live] = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(
        and(
          eq(expenses.freelancer_id, freelancerId),
          eq(expenses.expense_date, date),
          eq(expenses.net_amount_pence, Math.abs(amountPence)),
          sql`lower(regexp_replace(regexp_replace(${expenses.description}, '[^a-z0-9 ]', ' ', 'gi'), '\s+', ' ', 'g'))
              like ${normDesc.slice(0, 60)}`
        )
      )
      .limit(1);
    if (live) return true;
  }

  return false;
}

// ── Batch-level dedup ─────────────────────────────────────────────────────────
// Called by the parser after all rows are classified. Marks rows whose
// (date, amount, normalised-description) match an existing live record or a
// committed row from an earlier batch. Sets decision = "duplicate" and adds the
// "possible_duplicate" issue code.

export async function markDuplicates(batchId: number, freelancerId: number): Promise<number> {
  const rows = await db.select().from(import_rows).where(eq(import_rows.batch_id, batchId));

  let count = 0;

  for (const row of rows) {
    const parsed = (row.parsed ?? {}) as Record<string, unknown>;
    const date = typeof parsed.date === "string" ? parsed.date : null;
    const amountPence = typeof parsed.amount_pence === "number" ? parsed.amount_pence : null;
    const description = typeof parsed.description === "string" ? parsed.description : null;
    const target = row.target;

    if (!date || amountPence === null || !description) continue;
    if (target !== "earnings" && target !== "expense") continue;

    const dup = await isDuplicate({
      freelancerId,
      date,
      amountPence,
      description,
      target,
    });

    if (dup) {
      const existingIssues = Array.isArray(row.issues) ? (row.issues as string[]) : [];
      await db
        .update(import_rows)
        .set({
          decision: "duplicate",
          issues: Array.from(new Set([...existingIssues, "possible_duplicate"])),
        })
        .where(eq(import_rows.id, row.id));
      count++;
    }
  }

  return count;
}
