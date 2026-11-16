import type { Request, Response } from "express";
import {
  listRemoved,
  restoreRecord,
  resetCounts,
  resetBooks,
  type ResetScope,
  type UndoTable,
} from "../services/undo.service";

const TABLES: UndoTable[] = ["earnings", "expenses"];
const SCOPES: ResetScope[] = ["all", "keep_eventlink", "imported"];

// GET /api/books/removed?table=earnings|expenses
export async function listRemovedHandler(req: Request, res: Response) {
  const table = req.query.table as UndoTable;
  if (!TABLES.includes(table)) return res.status(400).json({ error: "Unknown table" });
  try {
    return res.json(await listRemoved(req.user!.id, table));
  } catch (err) {
    console.error("listRemoved error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// POST /api/books/removed/:table/:id/restore
export async function restoreHandler(req: Request, res: Response) {
  const table = req.params.table as UndoTable;
  const id = parseInt(req.params.id);
  if (!TABLES.includes(table) || isNaN(id)) return res.status(400).json({ error: "Invalid" });
  try {
    const ok = await restoreRecord(req.user!.id, table, id);
    return ok ? res.json({ ok: true }) : res.status(404).json({ error: "Not found" });
  } catch (err) {
    console.error("restoreRecord error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// GET /api/books/start-again — how many records each scope would clear
export async function resetCountsHandler(req: Request, res: Response) {
  try {
    return res.json(await resetCounts(req.user!.id));
  } catch (err) {
    console.error("resetCounts error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// POST /api/books/start-again { scope, confirm: "CLEAR" }
export async function resetHandler(req: Request, res: Response) {
  const { scope, confirm } = req.body ?? {};
  if (!SCOPES.includes(scope)) return res.status(400).json({ error: "Unknown scope" });
  if (confirm !== "CLEAR") return res.status(400).json({ error: "Type CLEAR to confirm" });
  try {
    return res.json(await resetBooks(req.user!.id, scope));
  } catch (err) {
    console.error("resetBooks error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
