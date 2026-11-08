/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../config/db";
import { import_batches } from "@shared/schema";
import { computeSignature, lookupMapping, saveMapping } from "../services/import-mapping.service";

// ── POST /api/imports/:id/mappings/lookup ──────────────────────────────────────
// Body: { headers: string[] }
// Returns: { signature, mapping } where mapping may be null (no previous match).
// Called by the client immediately after upload so it can pre-fill the column
// mapping UI with any saved suggestion.

export async function lookupImportMapping(req: Request, res: Response): Promise<void> {
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

  const { headers } = req.body as { headers?: unknown };
  if (!Array.isArray(headers) || headers.length === 0) {
    res.status(400).json({ error: "headers must be a non-empty array of strings" });
    return;
  }
  if (headers.some((h) => typeof h !== "string")) {
    res.status(400).json({ error: "Every header must be a string" });
    return;
  }

  // Confirm batch belongs to this user
  const [batch] = await db
    .select({ id: import_batches.id })
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, userId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const signature = computeSignature(headers as string[]);
  const mapping = await lookupMapping(userId, signature);

  res.json({ signature, mapping: mapping ?? null });
}

// ── POST /api/imports/:id/mappings ─────────────────────────────────────────────
// Body: { headers, columnMap, categoryMap?, fullFidelityFrom?, dateFormat? }
// Saves the mapping and advances the batch to status 'configuring'.
// The parse endpoint (POST /:id/parse) is what actually queues the job — the
// client calls this endpoint first to record what mapping to use.

export async function saveImportMapping(req: Request, res: Response): Promise<void> {
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

  const { headers, columnMap, categoryMap, fullFidelityFrom, dateFormat } = req.body as {
    headers?: unknown;
    columnMap?: unknown;
    categoryMap?: unknown;
    fullFidelityFrom?: unknown;
    dateFormat?: unknown;
  };

  if (!Array.isArray(headers) || headers.length === 0) {
    res.status(400).json({ error: "headers must be a non-empty array of strings" });
    return;
  }
  if (headers.some((h) => typeof h !== "string")) {
    res.status(400).json({ error: "Every header must be a string" });
    return;
  }
  if (!columnMap || typeof columnMap !== "object" || Array.isArray(columnMap)) {
    res.status(400).json({ error: "columnMap must be an object" });
    return;
  }

  // Confirm batch belongs to this user and is in an editable state
  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, userId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const LOCKED_STATUSES = ["parsing", "committing", "committed"];
  if (LOCKED_STATUSES.includes(batch.status)) {
    res.status(409).json({
      error: `Cannot change mapping while batch is ${batch.status}`,
    });
    return;
  }

  const signature = computeSignature(headers as string[]);

  // Persist the mapping for future imports with the same column layout
  const mapping = await saveMapping({
    freelancerId: userId,
    signature,
    source: batch.source,
    columnMap: columnMap as Record<string, string | null>,
    categoryMap: (categoryMap as Record<string, string> | null | undefined) ?? null,
  });

  // Advance batch status to 'configuring' and store the active config fields
  const configUpdate: Partial<typeof import_batches.$inferInsert> = {
    status: "configuring",
    updated_at: new Date(),
  };
  if (typeof fullFidelityFrom === "string" && fullFidelityFrom) {
    configUpdate.full_fidelity_from = fullFidelityFrom;
  }
  if (typeof dateFormat === "string" && dateFormat) {
    configUpdate.date_format = dateFormat;
  }

  await db.update(import_batches).set(configUpdate).where(eq(import_batches.id, batchId));

  res.json({ signature, mapping });
}

// ── PATCH /api/imports/:id ─────────────────────────────────────────────────────
// Updates configurable metadata on the batch: fullFidelityFrom, dateFormat.
// Does not change status — just lets the client update these fields independently
// if the user goes back and changes the fidelity date without re-mapping columns.

export async function patchImportBatch(req: Request, res: Response): Promise<void> {
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

  const { fullFidelityFrom, dateFormat } = req.body as {
    fullFidelityFrom?: unknown;
    dateFormat?: unknown;
  };

  const [batch] = await db
    .select({ id: import_batches.id, status: import_batches.status })
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, userId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const LOCKED_STATUSES = ["parsing", "committing", "committed"];
  if (LOCKED_STATUSES.includes(batch.status)) {
    res.status(409).json({ error: `Cannot edit batch while it is ${batch.status}` });
    return;
  }

  const update: Partial<typeof import_batches.$inferInsert> = { updated_at: new Date() };
  if (typeof fullFidelityFrom === "string" && fullFidelityFrom) {
    update.full_fidelity_from = fullFidelityFrom;
  } else if (fullFidelityFrom === null) {
    update.full_fidelity_from = null;
  }
  if (typeof dateFormat === "string" && dateFormat) {
    update.date_format = dateFormat;
  } else if (dateFormat === null) {
    update.date_format = null;
  }

  const [updated] = await db
    .update(import_batches)
    .set(update)
    .where(eq(import_batches.id, batchId))
    .returning();

  res.json(updated);
}
