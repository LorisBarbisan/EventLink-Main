import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { storage } from "../../storage";
import { ObjectStorageService } from "../utils/object-storage";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadReceipt(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { fileData, filename, contentType, expense_id } = req.body;

    if (!fileData || !filename || !contentType) {
      return res.status(400).json({ error: "fileData, filename and contentType are required" });
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      return res.status(400).json({ error: "File type not supported" });
    }

    const buffer = Buffer.from(fileData, "base64");
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: "File too large (max 20 MB)" });
    }

    const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
    const key = `receipts/${freelancerId}/${randomUUID()}${ext}`;
    await ObjectStorageService.uploadBuffer(key, contentType, buffer);

    const receipt = await storage.createReceipt({
      freelancer_id: freelancerId,
      expense_id: expense_id ? Number(expense_id) : null,
      file_key: key,
      file_name: filename,
      mime_type: contentType,
      size_bytes: buffer.length,
    });

    const url = await ObjectStorageService.getDownloadUrl(key);
    return res.status(201).json({ ...receipt, url });
  } catch (err) {
    console.error("uploadReceipt error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── List for expense ──────────────────────────────────────────────────────────

export async function listReceiptsForExpense(req: Request, res: Response) {
  const expenseId = parseInt(req.params.expenseId);
  if (isNaN(expenseId)) return res.status(400).json({ error: "Invalid id" });

  const rows = await storage.listReceiptsForExpense(expenseId);
  const withUrls = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      url: await ObjectStorageService.getDownloadUrl(r.file_key),
    }))
  );
  return res.json(withUrls);
}

// ── Unattached inbox ──────────────────────────────────────────────────────────

export async function listUnattachedReceipts(req: Request, res: Response) {
  const rows = await storage.listUnattachedReceipts(req.user!.id);
  const withUrls = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      url: await ObjectStorageService.getDownloadUrl(r.file_key),
    }))
  );
  return res.json(withUrls);
}

export async function countUnattachedReceipts(req: Request, res: Response) {
  const n = await storage.countUnattachedReceipts(req.user!.id);
  return res.json({ count: n });
}

// ── Get single ────────────────────────────────────────────────────────────────

export async function getReceipt(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const receipt = await storage.getReceipt(id);
  if (!receipt) return res.status(404).json({ error: "Not found" });
  if (receipt.freelancer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });

  const url = await ObjectStorageService.getDownloadUrl(receipt.file_key);
  return res.json({ ...receipt, url });
}

// ── Attach / detach ───────────────────────────────────────────────────────────

export async function attachReceipt(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  // expense_id: number to attach, null to detach
  const expenseId = req.body.expense_id !== undefined ? req.body.expense_id : undefined;
  if (expenseId === undefined) return res.status(400).json({ error: "expense_id is required" });

  const receipt = await storage.attachReceipt(
    id,
    req.user!.id,
    expenseId === null ? null : Number(expenseId)
  );
  if (!receipt) return res.status(404).json({ error: "Not found" });
  return res.json(receipt);
}

// ── Archive ───────────────────────────────────────────────────────────────────

export async function archiveReceipt(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  await storage.archiveReceipt(id, req.user!.id);
  return res.status(204).send();
}
