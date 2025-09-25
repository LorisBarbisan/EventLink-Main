import type { Express } from "express";
import { storage } from "../storage";
import { insertJobSchema } from "@shared/schema";
import { authenticateJWT } from "./auth";

export function registerJobRoutes(app: Express) {
  // Get all jobs endpoint implemented in main routes.ts

  // Job by ID endpoint implemented in main routes.ts

  // External job sync endpoint implemented in main routes.ts

  // Get job posting presets
  app.get("/api/jobs/presets", async (req, res) => {
    try {
      // Return common job posting templates
      const presets = [
        {
          id: "av-tech",
          name: "AV Technician",
          description: "Audio/Visual technical support role",
          skills: ["Audio Equipment", "Video Equipment", "Troubleshooting", "Setup"]
        },
        {
          id: "lighting-tech", 
          name: "Lighting Technician",
          description: "Event lighting setup and operation",
          skills: ["Lighting Design", "DMX", "Rigging", "Programming"]
        },
        {
          id: "stage-manager",
          name: "Stage Manager",
          description: "Event coordination and stage management",
          skills: ["Event Coordination", "Team Management", "Scheduling", "Communication"]
        }
      ];
      res.json(presets);
    } catch (error) {
      console.error("Get job presets error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Job preset sync endpoint implemented in main routes.ts

  // External jobs endpoint implemented in main routes.ts

  // Get jobs by recruiter
  app.get("/api/jobs/recruiter/:recruiterId", async (req, res) => {
    try {
      const recruiterId = parseInt(req.params.recruiterId);
      const jobs = await storage.getJobsByRecruiterId(recruiterId);
      res.json(jobs);
    } catch (error) {
      console.error("Get recruiter jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new job
  app.post("/api/jobs", authenticateJWT, async (req, res) => {
    try {
      if (!req.user || (req.user as any).role !== 'recruiter') {
        return res.status(403).json({ error: "Only recruiters can create jobs" });
      }

      const result = insertJobSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const job = await storage.createJob(result.data);
      res.status(201).json(job);
    } catch (error) {
      console.error("Create job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update job
  app.put("/api/jobs/:jobId", authenticateJWT, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      // Check if user is authorized to update this job
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if ((req.user as any).role !== 'admin' && job.recruiter_id !== (req.user as any).id) {
        return res.status(403).json({ error: "Not authorized to update this job" });
      }

      const result = insertJobSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const updatedJob = await storage.updateJob(jobId, result.data);
      if (!updatedJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json(updatedJob);
    } catch (error) {
      console.error("Update job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete job
  app.delete("/api/jobs/:jobId", authenticateJWT, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      if (Number.isNaN(jobId)) {
        return res.status(400).json({ error: "Invalid job ID" });
      }
      
      // Check if user is authorized to delete this job
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (req.user.role !== 'admin' && job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to delete this job" });
      }

      await storage.deleteJob(jobId);
      
      res.set('Cache-Control', 'no-store');
      res.json({ 
        success: true, 
        jobId: jobId,
        message: "Job deleted successfully"
      });
    } catch (error) {
      console.error("Delete job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}