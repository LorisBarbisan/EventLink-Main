import type { Express } from "express";
import {
  closeJob,
  createJob,
  deleteJob,
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
import { resolveCompanyId } from "../middleware/team.middleware";

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
  app.post("/api/jobs", authenticateJWT, resolveCompanyId, createJob);

  // Update job
  app.put("/api/jobs/:jobId", authenticateJWT, resolveCompanyId, updateJob);

  // Close job manually
  app.put("/api/jobs/:jobId/close", authenticateJWT, resolveCompanyId, closeJob);

  // Reopen a closed job (resets to private/unposted)
  app.put("/api/jobs/:jobId/reopen", authenticateJWT, resolveCompanyId, reopenJob);

  // Delete job
  app.delete("/api/jobs/:jobId", authenticateJWT, resolveCompanyId, deleteJob);

  // Get full job detail + applications (recruiter owner only)
  app.get("/api/jobs/:jobId/detail", authenticateJWT, resolveCompanyId, getRecruiterJobDetail);
}
