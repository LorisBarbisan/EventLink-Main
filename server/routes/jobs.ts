import type { Express } from "express";
import { storage } from "../storage";
import { insertJobSchema } from "@shared/schema";

export function registerJobRoutes(app: Express) {
  // Get all jobs with filters
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Get jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get specific job by ID
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      console.error("Get job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sync external jobs (placeholder for job aggregator)
  app.post("/api/jobs/sync-external", async (req, res) => {
    try {
      // This would integrate with external job boards
      // For now, return success message
      res.json({ message: "External job sync initiated" });
    } catch (error) {
      console.error("Sync external jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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

  // Sync preset job template
  app.post("/api/jobs/sync-preset/:preset", async (req, res) => {
    try {
      const presetId = req.params.preset;
      
      // This would apply a preset template to a job posting
      res.json({ message: `Preset ${presetId} applied successfully` });
    } catch (error) {
      console.error("Sync preset error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get external jobs (from aggregators)
  app.get("/api/jobs/external", async (req, res) => {
    try {
      // This would fetch from external job sources
      res.json([]);
    } catch (error) {
      console.error("Get external jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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
  app.post("/api/jobs", async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'recruiter') {
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
  app.put("/api/jobs/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      // Check if user is authorized to update this job
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (req.user.role !== 'admin' && job.recruiter_id !== req.user.id) {
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
  app.delete("/api/jobs/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      // Check if user is authorized to delete this job
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (req.user.role !== 'admin' && job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to delete this job" });
      }

      await storage.deleteJob(jobId);
      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      console.error("Delete job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}