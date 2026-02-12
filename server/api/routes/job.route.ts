import type { Express } from "express";
import {
  closeJob,
  createJob,
  deleteJob,
  getJobById,
  getJobLinkViewCount,
  getJobPresets,
  getJobsByRecruiter,
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

  // Delete job
  app.delete("/api/jobs/:jobId", authenticateJWT, deleteJob);
}
