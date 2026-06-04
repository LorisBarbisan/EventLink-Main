import type { Express } from "express";
import {
  cancelAllBookingsForJob,
  closeJob,
  createJob,
  deleteJob,
  getJobActivitySummary,
  getJobById,
  getJobLinkViewCount,
  getJobPresets,
  getJobsByRecruiter,
  getRecruiterJobDetail,
  reopenJob,
  trackJobLinkView,
  updateJob,
} from "../controllers/job.controller";
import { authenticateJWT, authenticateOptionalJWT } from "../middleware/auth.middleware";

export function registerJobRoutes(app: Express) {
  // Get job by ID
  app.get("/api/jobs/:id", authenticateOptionalJWT, getJobById);

  // Get job posting presets
  app.get("/api/jobs/presets", getJobPresets);

  // Get jobs by recruiter
  app.get("/api/jobs/recruiter/:recruiterId", getJobsByRecruiter);

  // Track job link view (public, no auth required)
  app.post("/api/jobs/:id/link-view", trackJobLinkView);

  // Get job link view count (authenticated - recruiter/admin only)
  app.get("/api/jobs/:id/link-views", authenticateJWT, getJobLinkViewCount);

  // Create new job
  app.post("/api/jobs", authenticateJWT, createJob);

  // Update job
  app.put("/api/jobs/:jobId", authenticateJWT, updateJob);

  // Close job manually
  app.put("/api/jobs/:jobId/close", authenticateJWT, closeJob);

  // Reopen a closed job (resets to private/unposted)
  app.put("/api/jobs/:jobId/reopen", authenticateJWT, reopenJob);

  // Delete job
  app.delete("/api/jobs/:jobId", authenticateJWT, deleteJob);

  // Get full job detail + applications (recruiter owner only)
  app.get("/api/jobs/:jobId/detail", authenticateJWT, getRecruiterJobDetail);

  // Activity summary for smart delete modal
  app.get("/api/jobs/:id/activity-summary", authenticateJWT, getJobActivitySummary);

  // Cancel all confirmed bookings for a job (used in smart delete)
  app.post("/api/jobs/:id/cancel-all-bookings", authenticateJWT, cancelAllBookingsForJob);
}
