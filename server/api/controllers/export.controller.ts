import type { Request, Response } from "express";
import { storage } from "../../storage.js";
import {
  generateBookingsExcel,
  generateBookingsCsv,
  generateCrewListExcel,
  generateCrewListCsv,
  generateAvailabilityExcel,
  generateAvailabilityCsv,
} from "../services/export.service.js";

function getDateRange(req: Request): { dateFrom?: string; dateTo?: string } {
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;
  return { dateFrom, dateTo };
}

function buildFilename(base: string, ext: string, dateFrom?: string, dateTo?: string): string {
  const today = new Date().toISOString().split("T")[0];
  const range = dateFrom && dateTo ? `_${dateFrom}_to_${dateTo}` : `_${today}`;
  return `${base}${range}.${ext}`;
}

// ── Bookings ───────────────────────────────────────────────

export const exportBookingsExcel = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const { dateFrom, dateTo } = getDateRange(req);
    const data = await storage.getBookingsForExport(employerId, dateFrom, dateTo);
    const buffer = await generateBookingsExcel(data);
    const name = buildFilename("EventLink_Bookings", "xlsx", dateFrom, dateTo);
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    return res.send(buffer);
  } catch (err: any) {
    console.error("exportBookingsExcel error:", err.message);
    return res.status(500).json({ error: "Export failed" });
  }
};

export const exportBookingsCsv = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const { dateFrom, dateTo } = getDateRange(req);
    const data = await storage.getBookingsForExport(employerId, dateFrom, dateTo);
    const csv = await generateBookingsCsv(data);
    const name = buildFilename("EventLink_Bookings", "csv", dateFrom, dateTo);
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    return res.send("\uFEFF" + csv);
  } catch (err: any) {
    console.error("exportBookingsCsv error:", err.message);
    return res.status(500).json({ error: "Export failed" });
  }
};

// ── Crew List ──────────────────────────────────────────────

export const exportCrewExcel = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const data = await storage.getCrewListForExport(employerId);
    const buffer = await generateCrewListExcel(data);
    res.setHeader("Content-Disposition", 'attachment; filename="EventLink_Crew_List.xlsx"');
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    return res.send(buffer);
  } catch (err: any) {
    console.error("exportCrewExcel error:", err.message);
    return res.status(500).json({ error: "Export failed" });
  }
};

export const exportCrewCsv = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const data = await storage.getCrewListForExport(employerId);
    const csv = await generateCrewListCsv(data);
    res.setHeader("Content-Disposition", 'attachment; filename="EventLink_Crew_List.csv"');
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    return res.send("\uFEFF" + csv);
  } catch (err: any) {
    console.error("exportCrewCsv error:", err.message);
    return res.status(500).json({ error: "Export failed" });
  }
};

// ── Availability ───────────────────────────────────────────

export const exportAvailabilityExcel = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const { dateFrom, dateTo } = getDateRange(req);
    const data = await storage.getAvailabilityForExport(employerId, dateFrom, dateTo);
    const buffer = await generateAvailabilityExcel(data);
    const name = buildFilename("EventLink_Availability", "xlsx", dateFrom, dateTo);
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    return res.send(buffer);
  } catch (err: any) {
    console.error("exportAvailabilityExcel error:", err.message);
    return res.status(500).json({ error: "Export failed" });
  }
};

export const exportAvailabilityCsv = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const { dateFrom, dateTo } = getDateRange(req);
    const data = await storage.getAvailabilityForExport(employerId, dateFrom, dateTo);
    const csv = await generateAvailabilityCsv(data);
    const name = buildFilename("EventLink_Availability", "csv", dateFrom, dateTo);
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    return res.send("\uFEFF" + csv);
  } catch (err: any) {
    console.error("exportAvailabilityCsv error:", err.message);
    return res.status(500).json({ error: "Export failed" });
  }
};
