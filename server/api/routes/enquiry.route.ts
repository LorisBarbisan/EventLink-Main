// ============================================================
// FMS Phase 2 — Availability Enquiry Routes
// File: server/api/routes/enquiry.route.ts
// ============================================================

import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { requireFmsAccess } from "../middleware/subscription.middleware";
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
  archiveEnquiry,
  reactivateEnquiry,
  getArchivedEnquiries,
} from "../controllers/enquiry.controller";

const router = Router();

// ── Public routes (no auth) ───────────────────────────────
router.get("/respond/:token", getResponseByTokenHandler);
router.post("/respond/:token", respondToEnquiry);

// ── Employer-only routes ──────────────────────────────────
const fms = [authenticateJWT, requireRole("recruiter"), requireFmsAccess] as any[];

router.get("/archived", ...fms, getArchivedEnquiries);
router.get("/", ...fms, getEnquiriesForEmployer);
router.post("/", ...fms, createEnquiry);
router.get("/:id/responses", ...fms, getEnquiryResponses);
router.post("/:id/convert/:responseId", ...fms, convertResponseToBooking);
router.patch("/:id/cancel", ...fms, cancelEnquiry);
router.patch("/:id/archive", ...fms, archiveEnquiry);
router.patch("/:id/reactivate", ...fms, reactivateEnquiry);
router.patch("/:id", ...fms, updateEnquiry);
router.post("/:id/freelancers", ...fms, addFreelancers);
router.delete("/:id/freelancers/:freelancerId", ...fms, removeFreelancer);

export default router;
