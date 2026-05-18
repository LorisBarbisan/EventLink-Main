// ============================================================
// FMS Phase 1 — Booking Routes
// File: server/api/routes/booking.route.ts
// ============================================================

import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { resolveCompanyId } from "../middleware/team.middleware";
import {
  createBooking,
  getEmployerBookings,
  getFreelancerBookings,
  getBookingById,
  updateBookingStatus,
  updateBookingDetails,
  getBookingsByJob,
  getBookingsSummary,
} from "../controllers/booking.controller";

const router = Router();

router.use(authenticateJWT);

// ── Employer routes ───────────────────────────────────────
router.get("/employer", requireRole("employer"), resolveCompanyId, getEmployerBookings);
router.get("/employer/summary", requireRole("employer"), resolveCompanyId, getBookingsSummary);
router.get("/job/:jobId", requireRole("employer"), resolveCompanyId, getBookingsByJob);
router.post("/", requireRole("employer"), resolveCompanyId, createBooking);
router.patch("/:id/details", requireRole("employer"), resolveCompanyId, updateBookingDetails);

// ── Freelancer routes ─────────────────────────────────────
router.get("/freelancer", requireRole("freelancer"), getFreelancerBookings);

// ── Shared routes ─────────────────────────────────────────
router.get("/:id", getBookingById);
router.patch("/:id/status", updateBookingStatus);

export default router;
