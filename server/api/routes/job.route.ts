import type { Express } from "express";
import {
  closeJob,
  createJob,
  createFreelancerJob,
  deleteJob,
  getFreelancerPublicPostedJobs,
  getJobById,
  getJobLinkViewCount,
  getJobPresets,
  getJobsByRecruiter,
  getMyPostedJobs,
  getRecruiterJobDetail,
  reopenJob,
  trackJobLinkView,
  updateJob,
} from "../controllers/job.controller";
import { submitGuestJob, confirmGuestJob } from "../controllers/guest-job.controller";
import { authenticateJWT, authenticateOptionalJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { resolveCompanyId, resolveCompanyIdOptional } from "../middleware/team.middleware";

export function registerJobRoutes(app: Express) {
  // Guest job submission (no auth required)
  app.post("/api/jobs/guest", submitGuestJob);
  app.get("/api/jobs/guest/confirm", confirmGuestJob);

  // Get job by ID
  app.get("/api/jobs/:id", authenticateOptionalJWT, resolveCompanyIdOptional, getJobById);

  // Get job posting presets
  app.get("/api/jobs/presets", getJobPresets);

  // Get jobs by recruiter
  app.get("/api/jobs/recruiter/:recruiterId", getJobsByRecruiter);

  // Track job link view (public, no auth required)
  app.post("/api/jobs/:id/link-view", trackJobLinkView);

  // Get job link view count (authenticated - recruiter/admin only)
  app.get("/api/jobs/:id/link-views", authenticateJWT, getJobLinkViewCount);

  // Create new job (recruiter / employer)
  app.post("/api/jobs", authenticateJWT, resolveCompanyId, createJob);

  // Create a job posted by a freelancer
  app.post("/api/jobs/freelancer", authenticateJWT, requireRole("freelancer"), createFreelancerJob);

  // Get jobs the current freelancer has posted themselves
  app.get("/api/jobs/my-posted", authenticateJWT, requireRole("freelancer"), getMyPostedJobs);

  // Public: active jobs posted by a specific freelancer (profile page)
  app.get("/api/freelancer/:userId/posted-jobs", getFreelancerPublicPostedJobs);

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
