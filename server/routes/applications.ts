import type { Express } from "express";
import { storage } from "../storage";
import { insertJobApplicationSchema } from "@shared/schema";

export function registerApplicationRoutes(app: Express) {
  // Get freelancer bookings (accepted applications)
  app.get("/api/freelancer/:freelancerId/bookings", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);
      
      // Check authorization - user can only view their own bookings or admin can view all
      if (!req.user || (req.user.id !== freelancerId && req.user.role !== 'admin')) {
        return res.status(403).json({ error: "Not authorized to view these bookings" });
      }

      const applications = await storage.getApplicationsByFreelancer(freelancerId);
      // Filter only accepted applications for bookings
      const bookings = applications.filter(app => app.status === 'accepted');
      
      res.json(bookings);
    } catch (error) {
      console.error("Get freelancer bookings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Apply to job
  app.post("/api/jobs/:jobId/apply", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      if (!req.user || req.user.role !== 'freelancer') {
        return res.status(403).json({ error: "Only freelancers can apply to jobs" });
      }

      // Check if job exists
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Check if already applied
      const existingApplications = await storage.getApplicationsByFreelancer(req.user.id);
      const alreadyApplied = existingApplications.some(app => app.job_id === jobId);
      
      if (alreadyApplied) {
        return res.status(400).json({ error: "You have already applied to this job" });
      }

      const applicationData = {
        job_id: jobId,
        freelancer_id: req.user.id,
        cover_letter: req.body.cover_letter || '',
        status: 'pending' as const
      };

      const result = insertJobApplicationSchema.safeParse(applicationData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const application = await storage.createJobApplication(result.data);
      
      // Create notification for recruiter
      await storage.createNotification({
        user_id: job.recruiter_id,
        type: 'application_received',
        title: 'New Job Application',
        message: `A freelancer has applied to your job: ${job.title}`,
        data: { job_id: jobId, application_id: application.id }
      });

      res.status(201).json(application);
    } catch (error) {
      console.error("Apply to job error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get freelancer applications
  app.get("/api/freelancer/:freelancerId/applications", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);
      
      // Check authorization
      if (!req.user || (req.user.id !== freelancerId && req.user.role !== 'admin')) {
        return res.status(403).json({ error: "Not authorized to view these applications" });
      }

      const applications = await storage.getApplicationsByFreelancer(freelancerId);
      res.json(applications);
    } catch (error) {
      console.error("Get freelancer applications error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get applications for a job
  app.get("/api/jobs/:jobId/applications", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      
      // Check if user is authorized to view applications for this job
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (req.user.role !== 'admin' && job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to view applications for this job" });
      }

      const applications = await storage.getApplicationsByJob(jobId);
      res.json(applications);
    } catch (error) {
      console.error("Get job applications error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get recruiter applications
  app.get("/api/recruiter/:recruiterId/applications", async (req, res) => {
    try {
      const recruiterId = parseInt(req.params.recruiterId);
      
      // Check authorization
      if (!req.user || (req.user.id !== recruiterId && req.user.role !== 'admin')) {
        return res.status(403).json({ error: "Not authorized to view these applications" });
      }

      // Get all jobs by this recruiter, then get applications for those jobs
      const jobs = await storage.getJobsByRecruiterId(recruiterId);
      const allApplications = [];
      
      for (const job of jobs) {
        const jobApplications = await storage.getApplicationsByJob(job.id);
        allApplications.push(...jobApplications);
      }

      res.json(allApplications);
    } catch (error) {
      console.error("Get recruiter applications error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Accept application
  app.put("/api/applications/:applicationId/accept", async (req, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if user is authorized to accept this application
      const application = await storage.getJobApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const job = await storage.getJob(application.job_id);
      if (!job || (req.user.role !== 'admin' && job.recruiter_id !== req.user.id)) {
        return res.status(403).json({ error: "Not authorized to accept this application" });
      }

      await storage.updateApplicationStatus(applicationId, 'accepted');
      
      // Create notification for freelancer
      await storage.createNotification({
        user_id: application.freelancer_id,
        type: 'application_accepted',
        title: 'Application Accepted!',
        message: `Your application for "${job.title}" has been accepted!`,
        data: { job_id: job.id, application_id: applicationId }
      });

      res.json({ message: "Application accepted successfully" });
    } catch (error) {
      console.error("Accept application error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reject application
  app.put("/api/applications/:applicationId/reject", async (req, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if user is authorized to reject this application
      const application = await storage.getJobApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const job = await storage.getJob(application.job_id);
      if (!job || (req.user.role !== 'admin' && job.recruiter_id !== req.user.id)) {
        return res.status(403).json({ error: "Not authorized to reject this application" });
      }

      await storage.updateApplicationStatus(applicationId, 'rejected');
      
      // Create notification for freelancer
      await storage.createNotification({
        user_id: application.freelancer_id,
        type: 'application_rejected',
        title: 'Application Update',
        message: `Your application for "${job.title}" was not selected this time.`,
        data: { job_id: job.id, application_id: applicationId }
      });

      res.json({ message: "Application rejected successfully" });
    } catch (error) {
      console.error("Reject application error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}