/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../config/db";
import { import_batches, import_rows } from "@shared/schema";

const VALID_DECISIONS = ["pending", "approved", "skipped", "duplicate"] as const;
type Decision = (typeof VALID_DECISIONS)[number];

function isValidDecision(v: unknown): v is Decision {
  return VALID_DECISIONS.includes(v as Decision);
}

// ── Shared: ownership check ───────────────────────────────────────────────────

async function getBatchForUser(
  batchId: number,
  userId: number
): Promise<typeof import_batches.$inferSelect | null> {
  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, userId)))
    .limit(1);
  return batch ?? null;
}

// ── GET /api/imports/:id/rows ──────────────────────────────────────────────────
// Query params:
//   decision  — filter by decision value (omit = all rows)
//   page      — 1-indexed page number (default 1)
//   limit     — rows per page, 1–200 (default 50)
//
// Response: { rows, total, counts: { pending, approved, skipped, duplicate }, page, limit }

export async function listImportRows(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  const batchId = parseInt(req.params.id);

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (isNaN(batchId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const batch = await getBatchForUser(batchId, userId);
  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Batch must have been parsed before rows exist
  const READABLE_STATUSES = ["review", "committing", "committed", "rolled_back", "failed"];
  if (!READABLE_STATUSES.includes(batch.status)) {
    res.status(409).json({
      error: `Rows are not available yet — batch is still ${batch.status}`,
    });
    return;
  }

  const decisionFilter = req.query.decision as string | undefined;
  if (decisionFilter !== undefined && !isValidDecision(decisionFilter)) {
    res.status(400).json({
      error: `decision must be one of: ${VALID_DECISIONS.join(", ")}`,
    });
    return;
  }

  const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
  const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) ?? "50") || 50));
  const offset = (page - 1) * limit;

  // Build where clause
  const where = decisionFilter
    ? and(eq(import_rows.batch_id, batchId), eq(import_rows.decision, decisionFilter))
    : eq(import_rows.batch_id, batchId);

  // Run rows + total count in parallel
  const [rows, [{ total }], allDecisions] = await Promise.all([
    db
      .select()
      .from(import_rows)
      .where(where)
      .orderBy(import_rows.row_number)
      .limit(limit)
      .offset(offset),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(import_rows)
      .where(where),

    // Per-decision counts (always over all rows, regardless of filter)
    db
      .select({ decision: import_rows.decision, count: sql<number>`count(*)::int` })
      .from(import_rows)
      .where(eq(import_rows.batch_id, batchId))
      .groupBy(import_rows.decision),
  ]);

  const counts = { pending: 0, approved: 0, skipped: 0, duplicate: 0 };
  for (const row of allDecisions) {
    if (isValidDecision(row.decision)) {
      counts[row.decision] = row.count;
    }
  }

  res.json({ rows, total, counts, page, limit });
}

// ── PATCH /api/imports/:id/rows/:rowId ────────────────────────────────────────
// Body: { decision: "pending" | "approved" | "skipped" | "duplicate" }
// Returns the updated row.

export async function setRowDecision(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  const batchId = parseInt(req.params.id);
  const rowId = parseInt(req.params.rowId);

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (isNaN(batchId) || isNaN(rowId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { decision } = req.body as { decision?: unknown };
  if (!isValidDecision(decision)) {
    res.status(400).json({
      error: `decision must be one of: ${VALID_DECISIONS.join(", ")}`,
    });
    return;
  }

  const batch = await getBatchForUser(batchId, userId);
  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (batch.status !== "review") {
    res.status(409).json({
      error: `Rows can only be reviewed while batch is in 'review' status (currently '${batch.status}')`,
    });
    return;
  }

  const [updated] = await db
    .update(import_rows)
    .set({ decision })
    .where(and(eq(import_rows.id, rowId), eq(import_rows.batch_id, batchId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Row not found" });
    return;
  }

  res.json(updated);
}

// ── POST /api/imports/:id/rows/bulk ───────────────────────────────────────────
// Body: { rowIds: number[], decision: Decision }
//       OR { filter: "all" | "pending", decision: Decision }
//
// rowIds path:  apply decision to exactly these rows (up to 1000)
// filter path:  apply to all rows / all pending rows in the batch
//
// Returns: { updated: number } — count of affected rows.

export async function bulkSetDecision(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  const batchId = parseInt(req.params.id);

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (isNaN(batchId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { rowIds, filter, decision } = req.body as {
    rowIds?: unknown;
    filter?: unknown;
    decision?: unknown;
  };

  if (!isValidDecision(decision)) {
    res.status(400).json({
      error: `decision must be one of: ${VALID_DECISIONS.join(", ")}`,
    });
    return;
  }

  const hasRowIds = Array.isArray(rowIds) && rowIds.length > 0;
  const hasFilter = filter === "all" || filter === "pending";

  if (!hasRowIds && !hasFilter) {
    res.status(400).json({
      error: "Provide either rowIds (array of row IDs) or filter ('all' | 'pending')",
    });
    return;
  }

  const batch = await getBatchForUser(batchId, userId);
  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (batch.status !== "review") {
    res.status(409).json({
      error: `Rows can only be reviewed while batch is in 'review' status (currently '${batch.status}')`,
    });
    return;
  }

  let where;
  if (hasRowIds) {
    if (rowIds.length > 1000) {
      res.status(400).json({ error: "Cannot bulk-decide more than 1 000 rows at once" });
      return;
    }
    if (rowIds.some((id) => typeof id !== "number" || !Number.isInteger(id))) {
      res.status(400).json({ error: "rowIds must be an array of integers" });
      return;
    }
    where = and(eq(import_rows.batch_id, batchId), inArray(import_rows.id, rowIds as number[]));
  } else {
    // filter path
    where =
      filter === "pending"
        ? and(eq(import_rows.batch_id, batchId), eq(import_rows.decision, "pending"))
        : eq(import_rows.batch_id, batchId);
  }

  const updated = await db
    .update(import_rows)
    .set({ decision })
    .where(where)
    .returning({ id: import_rows.id });

  res.json({ updated: updated.length });
}
