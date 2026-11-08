import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../config/db";
import { import_batches, import_rows } from "@shared/schema";
import { ObjectStorageService } from "../utils/object-storage";
import { enqueueParseJob } from "../services/import-parse-worker.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

type ImportSource =
  | "quickbooks"
  | "xero"
  | "freeagent"
  | "bank_csv"
  | "spreadsheet"
  | "pdf"
  | "unknown";

function detectSource(fileName: string, mimeType: string): ImportSource {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xlsx"
  )
    return "spreadsheet";
  if (mimeType === "text/csv" || ext === "csv") return "bank_csv";
  return "unknown";
}

// ── POST /api/imports ──────────────────────────────────────────────────────────
// Body: { fileName, mimeType, fileData (base64) }

export async function uploadImport(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { fileName, mimeType, fileData } = req.body as {
    fileName?: string;
    mimeType?: string;
    fileData?: string;
  };

  if (!fileName || !mimeType || !fileData) {
    res.status(400).json({ error: "fileName, mimeType and fileData are required" });
    return;
  }

  const ALLOWED_TYPES = [
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/pdf",
    "application/vnd.ms-excel",
  ];
  if (!ALLOWED_TYPES.includes(mimeType)) {
    res.status(400).json({ error: "Unsupported file type. Upload a CSV, Excel or PDF." });
    return;
  }

  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
  let buffer: Buffer;
  try {
    buffer = Buffer.from(fileData, "base64");
  } catch {
    res.status(400).json({ error: "Invalid base64 file data" });
    return;
  }
  if (buffer.length > MAX_BYTES) {
    res.status(400).json({ error: "File too large (max 20 MB)" });
    return;
  }

  const fileKey = `imports/${userId}/${randomUUID()}/${fileName}`;

  try {
    await ObjectStorageService.uploadBuffer(fileKey, mimeType, buffer);
  } catch (err) {
    console.error("[import] storage upload failed:", err);
    res.status(500).json({ error: "Failed to store file" });
    return;
  }

  const source = detectSource(fileName, mimeType);

  const [batch] = await db
    .insert(import_batches)
    .values({
      freelancer_id: userId,
      source,
      file_key: fileKey,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: buffer.length,
      status: "uploaded",
    })
    .returning();

  res.status(201).json(batch);
}

// ── GET /api/imports ──────────────────────────────────────────────────────────

export async function listImports(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const batches = await db
    .select()
    .from(import_batches)
    .where(eq(import_batches.freelancer_id, userId))
    .orderBy(desc(import_batches.created_at));

  res.json(batches);
}

// ── GET /api/imports/:id ───────────────────────────────────────────────────────

export async function getImport(req: Request, res: Response): Promise<void> {
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

  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, userId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Summary counts from import_rows
  const rows = await db
    .select({ decision: import_rows.decision })
    .from(import_rows)
    .where(eq(import_rows.batch_id, batchId));

  const counts = {
    total: rows.length,
    pending: rows.filter((r) => r.decision === "pending").length,
    approved: rows.filter((r) => r.decision === "approved").length,
    skipped: rows.filter((r) => r.decision === "skipped").length,
    duplicate: rows.filter((r) => r.decision === "duplicate").length,
  };

  res.json({ ...batch, counts });
}

// ── POST /api/imports/:id/parse ────────────────────────────────────────────────
// Enqueues the parse job. Returns 202 immediately.

export async function enqueueImportParse(req: Request, res: Response): Promise<void> {
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

  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, userId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (!["uploaded", "configuring", "failed"].includes(batch.status)) {
    res.status(409).json({
      error: `Cannot start parse from status '${batch.status}'`,
    });
    return;
  }

  const jobId = randomUUID();
  await db
    .update(import_batches)
    .set({ status: "queued", parse_job_id: jobId, error: null, updated_at: new Date() })
    .where(eq(import_batches.id, batchId));

  // Fire-and-forget — the worker runs asynchronously
  enqueueParseJob(batchId, jobId).catch((err) => {
    console.error(`[import] enqueueParseJob failed for batch ${batchId}:`, err);
  });

  res.status(202).json({ batchId, jobId, status: "queued" });
}

// ── DELETE /api/imports/:id ────────────────────────────────────────────────────
// 409 if committed (rollback first). Deletes batch, rows, and stored file.

export async function deleteImport(req: Request, res: Response): Promise<void> {
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

  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.freelancer_id, userId)))
    .limit(1);

  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (batch.status === "committed") {
    res.status(409).json({
      error:
        "This import has been committed. Roll it back first before deleting, " +
        "so its records are removed from your books.",
    });
    return;
  }

  if (batch.status === "parsing" || batch.status === "committing") {
    res.status(409).json({
      error: `Cannot delete an import while it is ${batch.status}. Wait for it to finish.`,
    });
    return;
  }

  // Delete stored file (best-effort — don't block on storage errors)
  ObjectStorageService.deleteObject(batch.file_key).catch((err) => {
    console.error(`[import] failed to delete file ${batch.file_key}:`, err);
  });

  // Cascade deletes import_rows via FK
  await db.delete(import_batches).where(eq(import_batches.id, batchId));

  res.json({ ok: true });
}
