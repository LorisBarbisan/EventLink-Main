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

      const applications = await storage.getFreelancerApplications(freelancerId);
      // Filter only hired applications for bookings
      const bookings = applications.filter(app => app.status === 'hired');
      
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
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Check if already applied
      const existingApplications = await storage.getFreelancerApplications(req.user.id);
      const alreadyApplied = existingApplications.some(app => app.job_id === jobId);
      
      if (alreadyApplied) {
        return res.status(400).json({ error: "You have already applied to this job" });
      }

      const applicationData = {
        job_id: jobId,
        freelancer_id: req.user.id,
        cover_letter: req.body.cover_letter || '',
        status: 'applied' as const
      };

      const result = insertJobApplicationSchema.safeParse(applicationData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const application = await storage.createJobApplication(result.data);
      
      // Create notification for recruiter
      if (job.recruiter_id) {
        await storage.createNotification({
          user_id: job.recruiter_id,
          type: 'application_received',
          title: 'New Job Application',
          message: `A freelancer has applied to your job: ${job.title}`,
          related_entity_type: 'job',
          related_entity_id: jobId,
          metadata: JSON.stringify({ application_id: application.id })
        });
      }

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

      const applications = await storage.getFreelancerApplications(freelancerId);
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

      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (req.user.role !== 'admin' && job.recruiter_id !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to view applications for this job" });
      }

      const applications = await storage.getJobApplications(jobId);
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
        const jobApplications = await storage.getJobApplications(job.id);
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
      const application = await storage.getJobApplicationById(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const job = await storage.getJobById(application.job_id);
      if (!job || (req.user.role !== 'admin' && job.recruiter_id !== req.user.id)) {
        return res.status(403).json({ error: "Not authorized to accept this application" });
      }

      await storage.updateApplicationStatus(applicationId, 'hired');
      
      // Create notification for freelancer
      await storage.createNotification({
        user_id: application.freelancer_id,
        type: 'application_accepted',
        title: 'Application Accepted!',
        message: `Your application for "${job.title}" has been accepted!`,
        related_entity_type: 'job',
        related_entity_id: job.id,
        metadata: JSON.stringify({ application_id: applicationId })
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
      const application = await storage.getJobApplicationById(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const job = await storage.getJobById(application.job_id);
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
        related_entity_type: 'job',
        related_entity_id: job.id,
        metadata: JSON.stringify({ application_id: applicationId })
      });

      res.json({ message: "Application rejected successfully" });
    } catch (error) {
      console.error("Reject application error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete application (soft delete with role-based permissions)
  app.delete("/api/applications/:applicationId", async (req, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);
      
      if (Number.isNaN(applicationId)) {
        return res.status(400).json({ error: "Invalid application ID" });
      }
      
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get the application
      const application = await storage.getJobApplicationById(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Check authorization and determine delete type
      let userRole: 'freelancer' | 'recruiter';
      
      if (req.user.role === 'freelancer' && application.freelancer_id === req.user.id) {
        // Freelancer can delete their own applications
        userRole = 'freelancer';
      } else if (req.user.role === 'recruiter' || req.user.role === 'admin') {
        // Recruiter/admin can hide applications from jobs they own
        const job = await storage.getJobById(application.job_id);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        
        if (req.user.role === 'admin' || job.recruiter_id === req.user.id) {
          userRole = 'recruiter';
        } else {
          return res.status(403).json({ error: "Not authorized to delete this application" });
        }
      } else {
        return res.status(403).json({ error: "Not authorized to delete this application" });
      }

      // Perform soft delete
      await storage.softDeleteApplication(applicationId, userRole);
      
      res.set('Cache-Control', 'no-store');
      res.json({ 
        success: true, 
        deletedFor: userRole,
        applicationId: applicationId,
        message: `Application ${userRole === 'freelancer' ? 'removed' : 'hidden'} successfully`
      });
    } catch (error) {
      console.error("Delete application error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}