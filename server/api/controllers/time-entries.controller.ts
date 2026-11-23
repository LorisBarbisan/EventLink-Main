import type { Request, Response } from "express";
import { storage } from "../../storage";
import { computeOvertime } from "@shared/overtime";

export async function listTimeEntries(req: Request, res: Response) {
  const earningsEntryId = parseInt(req.params.entryId);
  if (isNaN(earningsEntryId)) return res.status(400).json({ error: "Invalid entry id" });
  const rows = await storage.listTimeEntries(req.user!.id, earningsEntryId);
  return res.json(rows);
}

export async function upsertTimeEntry(req: Request, res: Response) {
  const earningsEntryId = parseInt(req.params.entryId);
  if (isNaN(earningsEntryId)) return res.status(400).json({ error: "Invalid entry id" });

  const { work_date, start_time, finish_time, break_minutes = 0, notes } = req.body;
  if (!work_date || !start_time || !finish_time) {
    return res.status(400).json({ error: "work_date, start_time and finish_time are required" });
  }

  const row = await storage.upsertTimeEntry(req.user!.id, earningsEntryId, work_date, {
    start_time,
    finish_time,
    break_minutes: parseInt(break_minutes) || 0,
    notes: notes?.trim() || null,
  });
  return res.status(200).json(row);
}

export async function deleteTimeEntry(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await storage.deleteTimeEntry(id, req.user!.id);
  return res.status(204).send();
}

export async function getOvertimeSummary(req: Request, res: Response) {
  const earningsEntryId = parseInt(req.params.entryId);
  if (isNaN(earningsEntryId)) return res.status(400).json({ error: "Invalid entry id" });

  const rows = await storage.listTimeEntries(req.user!.id, earningsEntryId);

  // Pull overtime settings from the earnings entry
  const entry = await storage.getEarningsEntry(earningsEntryId);
  if (!entry || entry.freelancer_id !== req.user!.id)
    return res.status(404).json({ error: "Earnings entry not found" });

  const ot = computeOvertime(rows, {
    standard_hours_per_day: entry.standard_hours_per_day,
    overtime_rate_pence: entry.overtime_rate_pence,
  });

  const days = rows.map((r, i) => ({ ...r, ...ot.per_day[i] }));

  return res.json({
    days,
    total_worked_minutes: ot.total_worked_minutes,
    total_overtime_minutes: ot.has_standard ? ot.total_overtime_minutes : null,
    overtime_hours_suggested: ot.has_standard ? ot.overtime_hours : null,
    overtime_pence_suggested: ot.overtime_pence,
    standard_hours_per_day: entry.standard_hours_per_day ?? null,
    overtime_rate_pence: entry.overtime_rate_pence ?? null,
  });
}

export async function updateOvertimeSettings(req: Request, res: Response) {
  const earningsEntryId = parseInt(req.params.entryId);
  if (isNaN(earningsEntryId)) return res.status(400).json({ error: "Invalid entry id" });

  const { standard_hours_per_day, overtime_rate_pence } = req.body;
  await storage.updateEarningsEntryOvertimeSettings(req.user!.id, earningsEntryId, {
    standard_hours_per_day:
      standard_hours_per_day !== undefined
        ? standard_hours_per_day === null || standard_hours_per_day === ""
          ? null
          : parseInt(standard_hours_per_day)
        : undefined,
    overtime_rate_pence:
      overtime_rate_pence !== undefined
        ? overtime_rate_pence === null || overtime_rate_pence === ""
          ? null
          : parseInt(overtime_rate_pence)
        : undefined,
  });
  return res.status(204).send();
}
