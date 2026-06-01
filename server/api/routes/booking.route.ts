// ============================================================
// FMS Phase 1 — Booking Routes
// File: server/api/routes/booking.route.ts
// ============================================================

import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { requireFmsAccess } from "../middleware/subscription.middleware";
import {
  createBooking,
  getEmployerBookings,
  getFreelancerBookings,
  updateIr35Status,
  getBookingById,
  updateBookingStatus,
  updateBookingDetails,
  getBookingsByJob,
  getBookingsSummary,
  getBookingsForCalendar,
} from "../controllers/booking.controller";

const router = Router();

router.use(authenticateJWT);

// ── Employer routes ───────────────────────────────────────
router.get("/calendar", requireRole("employer"), requireFmsAccess, getBookingsForCalendar);
router.get("/employer", requireRole("employer"), requireFmsAccess, getEmployerBookings);
router.get("/employer/summary", requireRole("employer"), requireFmsAccess, getBookingsSummary);
router.get("/job/:jobId", requireRole("employer"), requireFmsAccess, getBookingsByJob);
router.post("/", requireRole("employer"), requireFmsAccess, createBooking);
router.patch("/:id/details", requireRole("employer"), requireFmsAccess, updateBookingDetails);
router.patch("/:bookingId/ir35", requireRole("recruiter"), requireFmsAccess, updateIr35Status);

// ── Freelancer routes ─────────────────────────────────────
router.get("/freelancer", requireRole("freelancer"), getFreelancerBookings);

// ── Shared routes ─────────────────────────────────────────
router.get("/:id", getBookingById);
router.patch("/:id/status", updateBookingStatus);

export default router;
