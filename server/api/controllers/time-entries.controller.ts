import type { Request, Response } from "express";
import { storage } from "../../storage";

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function workedMinutes(start: string, finish: string, breakMin: number): number {
  let mins = timeToMinutes(finish) - timeToMinutes(start);
  if (mins < 0) mins += 24 * 60; // overnight
  return Math.max(0, mins - breakMin);
}

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

  const standardMinutes = entry.standard_hours_per_day ? entry.standard_hours_per_day * 60 : null;

  let totalWorkedMinutes = 0;
  let totalOvertimeMinutes = 0;

  const days = rows.map((r) => {
    const worked = workedMinutes(r.start_time, r.finish_time, r.break_minutes);
    totalWorkedMinutes += worked;
    const overtime = standardMinutes !== null ? Math.max(0, worked - standardMinutes) : null;
    if (overtime !== null) totalOvertimeMinutes += overtime;
    return {
      ...r,
      worked_minutes: worked,
      overtime_minutes: overtime,
    };
  });

  const overtimeHours = minutesToHours(totalOvertimeMinutes);
  const overtimePence =
    entry.overtime_rate_pence !== null && entry.overtime_rate_pence !== undefined
      ? Math.round(overtimeHours * entry.overtime_rate_pence)
      : null;

  return res.json({
    days,
    total_worked_minutes: totalWorkedMinutes,
    total_overtime_minutes: standardMinutes !== null ? totalOvertimeMinutes : null,
    overtime_hours_suggested: standardMinutes !== null ? overtimeHours : null,
    overtime_pence_suggested: overtimePence,
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
