import type { Express, Request, Response } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireAdminAuth } from "../middleware/admin.middleware";
import { storage } from "../../storage";
import { isReportCategory, REPORT_STATUSES, type ReportStatus } from "@shared/safety";
import {
  activeBookingsBetween,
  blockUser,
  createUserReport,
  hasBlocked,
  listUserReports,
  unblockUser,
  updateUserReport,
} from "../services/safety.service";

const intOrNull = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function registerSafetyRoutes(app: Express) {
  // Report a person. The reporter gets a confirmation; the subject is never told.
  app.post("/api/users/:id/report", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const me = (req as any).user;
      const subjectId = intOrNull(req.params.id);
      if (!subjectId) return res.status(400).json({ error: "Invalid user" });
      if (subjectId === me.id) return res.status(400).json({ error: "You can't report yourself." });
      const { category, details, conversation_id, booking_id } = req.body ?? {};
      if (!isReportCategory(category)) {
        return res.status(400).json({ error: "Choose what the report is about." });
      }
      const subject = await storage.getUser(subjectId);
      if (!subject) return res.status(404).json({ error: "User not found" });
      const subjectName = [subject.first_name, subject.last_name].filter(Boolean).join(" ") || null;
      const text = typeof details === "string" ? details.trim().slice(0, 4000) || null : null;
      const report = await createUserReport({
        reporterId: me.id,
        subjectId,
        subjectName,
        category,
        details: text,
        conversationId: intOrNull(conversation_id),
        bookingId: intOrNull(booking_id),
      });
      return res.status(201).json({
        id: report.id,
        message:
          "Thanks — your report has reached the EventLink team. We review every report, and the person you reported isn't told who made it.",
      });
    } catch (err) {
      console.error("[safety] report failed:", err);
      return res.status(500).json({ error: "Couldn't send your report. Please try again." });
    }
  });

  // Block state, plus whether an active booking keeps the thread open
  app.get("/api/users/:id/block", authenticateJWT, async (req: Request, res: Response) => {
    const me = (req as any).user;
    const other = intOrNull(req.params.id);
    if (!other) return res.status(400).json({ error: "Invalid user" });
    const [blocked, active] = await Promise.all([
      hasBlocked(me.id, other),
      activeBookingsBetween(me.id, other),
    ]);
    return res.json({ blocked, activeBookings: active });
  });

  app.post("/api/users/:id/block", authenticateJWT, async (req: Request, res: Response) => {
    const me = (req as any).user;
    const other = intOrNull(req.params.id);
    if (!other || other === me.id) return res.status(400).json({ error: "Invalid user" });
    await blockUser(me.id, other);
    const active = await activeBookingsBetween(me.id, other);
    return res.json({ blocked: true, activeBookings: active });
  });

  app.delete("/api/users/:id/block", authenticateJWT, async (req: Request, res: Response) => {
    const me = (req as any).user;
    const other = intOrNull(req.params.id);
    if (!other) return res.status(400).json({ error: "Invalid user" });
    await unblockUser(me.id, other);
    return res.json({ blocked: false });
  });

  // Admin queue
  app.get("/api/admin/user-reports", requireAdminAuth, async (_req: Request, res: Response) => {
    try {
      res.json(await listUserReports());
    } catch (err) {
      console.error("[safety] list failed:", err);
      res.status(500).json({ error: "Failed to load reports" });
    }
  });

  app.patch(
    "/api/admin/user-reports/:id",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const id = intOrNull(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid report" });
      const { status, admin_notes } = req.body ?? {};
      if (status !== undefined && !REPORT_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      await updateUserReport(id, {
        status: status as ReportStatus | undefined,
        admin_notes: admin_notes === undefined ? undefined : String(admin_notes ?? "") || null,
      });
      res.json({ ok: true });
    }
  );
}
