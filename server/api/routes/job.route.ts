import type { Express } from "express";
import {
  createJob,
  deleteJob,
  getJobById,
  getJobPresets,
  getJobsByRecruiter,
  updateJob,
} from "../controllers/job.controller";
import { authenticateJWT, optionalAuthenticateJWT } from "../middleware/auth.middleware";

export function registerJobRoutes(app: Express) {
  // Get job by ID (optional auth for private job access control)
  app.get("/api/jobs/:id", optionalAuthenticateJWT, getJobById);

  // Get job posting presets
  app.get("/api/jobs/presets", getJobPresets);

  // Get jobs by recruiter
  app.get("/api/jobs/recruiter/:recruiterId", getJobsByRecruiter);

  // Create new job
  app.post("/api/jobs", authenticateJWT, createJob);

  // Update job
  app.put("/api/jobs/:jobId", authenticateJWT, updateJob);

  // Delete job
  app.delete("/api/jobs/:jobId", authenticateJWT, deleteJob);
}
