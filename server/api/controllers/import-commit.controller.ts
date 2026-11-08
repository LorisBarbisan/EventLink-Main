/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from "express";
import { commitBatch, rollbackBatch } from "../services/import-commit.service";

// ── POST /api/imports/:id/commit ───────────────────────────────────────────────
// Writes all approved rows to the ledger. Synchronous for now (runs in a single
// transaction); if the row count ever grows large enough to need chunking, this
// endpoint should return 202 and the commit should run in the background.

export async function commitImport(req: Request, res: Response): Promise<void> {
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

  try {
    await commitBatch(batchId, userId);
    res.json({ ok: true });
  } catch (err: any) {
    const status = err?.httpStatus ?? 500;
    res.status(status).json({ error: err?.message ?? "Commit failed" });
  }
}

// ── POST /api/imports/:id/rollback ─────────────────────────────────────────────
// Deletes every record created during commit and resets the batch to
// 'rolled_back'. Only works on committed batches.

export async function rollbackImport(req: Request, res: Response): Promise<void> {
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

  try {
    await rollbackBatch(batchId, userId);
    res.json({ ok: true });
  } catch (err: any) {
    const status = err?.httpStatus ?? 500;
    res.status(status).json({ error: err?.message ?? "Rollback failed" });
  }
}
