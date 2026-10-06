import express from "express";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { storage } from "../../storage.js";
import { format, addDays } from "date-fns";

const router = express.Router();

// Freelancer: get my availability for a date range
router.get("/my", authenticateJWT, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "freelancer") return res.status(403).json({ error: "Freelancers only" });
    const from = (req.query.from as string) || format(new Date(), "yyyy-MM-dd");
    const to = (req.query.to as string) || format(addDays(new Date(), 90), "yyyy-MM-dd");
    const rows = await storage.getFreelancerDateAvailability(user.id, from, to);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

// Freelancer: set availability for a single date
router.put("/my", authenticateJWT, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "freelancer") return res.status(403).json({ error: "Freelancers only" });
    const { date, status, note } = req.body as {
      date: string;
      status: "available" | "tentative" | "unavailable";
      note?: string;
    };
    if (!date || !status) return res.status(400).json({ error: "date and status required" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    if (!["available", "tentative", "unavailable"].includes(status))
      return res.status(400).json({ error: "invalid status" });
    const row = await storage.upsertFreelancerDateAvailability(user.id, date, status, note);
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update availability" });
  }
});

// Employer: get crew (saved freelancers) availability
router.get("/crew", authenticateJWT, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "recruiter") return res.status(403).json({ error: "Recruiters only" });
    const from = (req.query.from as string) || format(new Date(), "yyyy-MM-dd");
    const to = (req.query.to as string) || format(addDays(new Date(), 90), "yyyy-MM-dd");
    const rows = await storage.getCrewAvailability(user.id, from, to);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch crew availability" });
  }
});

// Employer: invite all saved freelancers to mark their availability
router.post("/invite", authenticateJWT, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "recruiter") return res.status(403).json({ error: "Recruiters only" });
    const savedIds = await storage.getSavedFreelancerIds(user.id);
    const results = await Promise.allSettled(
      savedIds.map((freelancerId) =>
        storage.createNotification({
          user_id: freelancerId,
          type: "system",
          title: "Availability Request",
          message: `${user.first_name ?? "An employer"} has invited you to mark your availability in EventLink FMS.`,
          is_read: false,
          action_url: "/dashboard?tab=availability",
        })
      )
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    res.json({ sent });
  } catch {
    res.status(500).json({ error: "Failed to send invites" });
  }
});

export default router;
