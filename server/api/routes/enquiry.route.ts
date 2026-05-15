// ============================================================
// FMS Phase 2 — Availability Enquiry Routes
// File: server/api/routes/enquiry.route.ts
// ============================================================

import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import {
  createEnquiry,
  getEnquiriesForEmployer,
  getEnquiryResponses,
  respondToEnquiry,
  convertResponseToBooking,
  getResponseByTokenHandler,
  cancelEnquiry,
  updateEnquiry,
  addFreelancers,
  removeFreelancer,
} from "../controllers/enquiry.controller";

const router = Router();

// ── Public routes (no auth) ───────────────────────────────
router.get("/respond/:token", getResponseByTokenHandler);
router.post("/respond/:token", respondToEnquiry);

// ── Employer-only routes ──────────────────────────────────
router.get("/", authenticateJWT, requireRole("employer"), getEnquiriesForEmployer);
router.post("/", authenticateJWT, requireRole("employer"), createEnquiry);
router.get("/:id/responses", authenticateJWT, requireRole("employer"), getEnquiryResponses);
router.post("/:id/convert/:responseId", authenticateJWT, requireRole("employer"), convertResponseToBooking);
router.patch("/:id/cancel", authenticateJWT, requireRole("recruiter"), cancelEnquiry);
router.patch("/:id", authenticateJWT, requireRole("recruiter"), updateEnquiry);
router.post("/:id/freelancers", authenticateJWT, requireRole("recruiter"), addFreelancers);
router.delete("/:id/freelancers/:freelancerId", authenticateJWT, requireRole("recruiter"), removeFreelancer);

export default router;
