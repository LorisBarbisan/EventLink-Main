// ============================================================
// FMS Phase 1 — Booking Routes
// File: server/api/routes/booking.route.ts
// ============================================================

import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { resolveCompanyId } from "../middleware/team.middleware";
import { requireFmsAccess } from "../middleware/subscription.middleware";
import {
  createBooking,
  getEmployerBookings,
  getFreelancerBookings,
  getBookingById,
  updateBookingStatus,
  updateBookingDetails,
  getBookingsByJob,
  getBookingsSummary,
  getCalendarBookings,
} from "../controllers/booking.controller";

const router = Router();

router.use(authenticateJWT);

// ── Employer routes (require active FMS subscription) ─────
const fms = [requireRole("employer"), resolveCompanyId, requireFmsAccess()];

router.get("/employer", ...fms, getEmployerBookings);
router.get("/employer/summary", ...fms, getBookingsSummary);
router.get("/job/:jobId", ...fms, getBookingsByJob);
router.post("/", ...fms, createBooking);
router.patch("/:id/details", ...fms, updateBookingDetails);
router.get("/calendar", ...fms, getCalendarBookings);

// ── Freelancer routes ─────────────────────────────────────
router.get("/freelancer", requireRole("freelancer"), getFreelancerBookings);

// ── Shared routes (both parties) ──────────────────────────
router.get("/:id", getBookingById);
router.patch("/:id/status", updateBookingStatus);

export default router;
