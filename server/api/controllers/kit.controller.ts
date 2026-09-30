import type { Request, Response } from "express";
import { storage } from "../../storage";
import { ObjectStorageService } from "../utils/object-storage";
import { randomUUID } from "crypto";

// ── List ──────────────────────────────────────────────────────────────────────

export async function listKitItems(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const includeDisposed = req.query.includeDisposed === "true";
  const items = await storage.listKitItems(freelancerId, includeDisposed);
  return res.json(items);
}

// ── Get single ────────────────────────────────────────────────────────────────

export async function getKitItem(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const item = await storage.getKitItem(id);
  if (!item) return res.status(404).json({ error: "Not found" });
  if (item.freelancer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
  const files = await storage.listKitItemFiles(id);
  return res.json({ ...item, files });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createKitItem(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const {
      name,
      category,
      manufacturer,
      model,
      serial_number,
      quantity,
      purchase_date,
      purchase_price_pence,
      currency,
      supplier,
      funding_method,
      business_use_percent,
      replacement_value_pence,
      condition_notes,
      status,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "name is required" });

    const item = await storage.createKitItem({
      freelancer_id: freelancerId,
      name: name.trim(),
      category: category ?? "other",
      manufacturer: manufacturer ?? null,
      model: model ?? null,
      serial_number: serial_number ?? null,
      quantity: quantity ?? 1,
      purchase_date: purchase_date ?? null,
      purchase_price_pence: purchase_price_pence ?? null,
      currency: currency ?? "GBP",
      supplier: supplier ?? null,
      funding_method: funding_method ?? "purchased",
      business_use_percent: business_use_percent ?? 100,
      replacement_value_pence: replacement_value_pence ?? null,
      condition_notes: condition_notes ?? null,
      status: status ?? "in_service",
      archived: false,
    });

    return res.status(201).json(item);
  } catch (err) {
    console.error("createKitItem error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateKitItem(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const item = await storage.getKitItem(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.freelancer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });

    const allowed = [
      "name",
      "category",
      "manufacturer",
      "model",
      "serial_number",
      "quantity",
      "purchase_date",
      "purchase_price_pence",
      "currency",
      "supplier",
      "funding_method",
      "business_use_percent",
      "replacement_value_pence",
      "condition_notes",
      "status",
      "disposal_date",
      "disposal_proceeds_pence",
      "disposal_notes",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const updated = await storage.updateKitItem(id, updates);
    return res.json(updated);
  } catch (err) {
    console.error("updateKitItem error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Archive (soft delete) ─────────────────────────────────────────────────────

export async function archiveKitItem(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const item = await storage.getKitItem(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.freelancer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
    const updated = await storage.updateKitItem(id, { archived: true });
    return res.json(updated);
  } catch (err) {
    console.error("archiveKitItem error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Files: list ───────────────────────────────────────────────────────────────

export async function listKitFiles(req: Request, res: Response) {
  const itemId = parseInt(req.params.id);
  if (isNaN(itemId)) return res.status(400).json({ error: "Invalid id" });
  const item = await storage.getKitItem(itemId);
  if (!item) return res.status(404).json({ error: "Not found" });
  if (item.freelancer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
  const files = await storage.listKitItemFiles(itemId);
  return res.json(files);
}

// ── Files: upload (base64) ────────────────────────────────────────────────────

export async function uploadKitFile(req: Request, res: Response) {
  try {
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) return res.status(400).json({ error: "Invalid id" });
    const item = await storage.getKitItem(itemId);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.freelancer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });

    const { fileData, filename, contentType, kind } = req.body;
    if (!fileData || !filename || !contentType) {
      return res.status(400).json({ error: "fileData, filename and contentType are required" });
    }

    const buffer = Buffer.from(fileData, "base64");
    const MAX_BYTES = 20 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: "File too large (max 20 MB)" });
    }

    const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
    const key = `kit/${req.user!.id}/${itemId}/${randomUUID()}${ext}`;
    await ObjectStorageService.uploadBuffer(key, contentType, buffer);

    const file = await storage.createKitItemFile({
      kit_item_id: itemId,
      file_key: key,
      file_name: filename,
      mime_type: contentType,
      size_bytes: buffer.length,
      kind: kind ?? "receipt",
      scan_status: "safe",
    });

    return res.status(201).json(file);
  } catch (err) {
    console.error("uploadKitFile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── Files: download ───────────────────────────────────────────────────────────

export async function downloadKitFile(req: Request, res: Response) {
  try {
    const itemId = parseInt(req.params.id);
    const fileId = parseInt(req.params.fileId);
    if (isNaN(itemId) || isNaN(fileId)) return res.status(400).json({ error: "Invalid id" });

    const item = await storage.getKitItem(itemId);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.freelancer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });

    const itemFiles = await storage.listKitItemFiles(itemId);
    const file = itemFiles.find((f) => f.id === fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    res.set({
      "Content-Disposition": `attachment; filename="${file.file_name}"`,
      ...(file.mime_type ? { "Content-Type": file.mime_type } : {}),
    });
    await new ObjectStorageService().downloadObject(file.file_key, res);
  } catch (err) {
    console.error("downloadKitFile error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
}

// ── Files: delete ─────────────────────────────────────────────────────────────

export async function deleteKitFile(req: Request, res: Response) {
  try {
    const itemId = parseInt(req.params.id);
    const fileId = parseInt(req.params.fileId);
    if (isNaN(itemId) || isNaN(fileId)) return res.status(400).json({ error: "Invalid id" });

    const item = await storage.getKitItem(itemId);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.freelancer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });

    const itemFiles = await storage.listKitItemFiles(itemId);
    const file = itemFiles.find((f) => f.id === fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    // Delete from object storage (non-fatal if already gone)
    ObjectStorageService.deleteObject(file.file_key).catch((e) =>
      console.error("kit file R2 delete failed (non-fatal):", e)
    );

    await storage.deleteKitItemFile(fileId);
    return res.status(204).send();
  } catch (err) {
    console.error("deleteKitFile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
