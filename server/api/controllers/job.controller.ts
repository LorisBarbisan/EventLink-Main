import { insertJobSchema, insertJobLinkViewSchema } from "@shared/schema";
import type { Request, Response } from "express";
import { storage } from "../../storage";

// Get job by ID
export async function getJobById(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.id);

    if (Number.isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }
    const job = await storage.getJobById(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const currentUser = (req as any).user;

    if (job.status === "private") {
      if (!currentUser) {
        return res.status(403).json({ error: "This job is only accessible via invitation. Please sign in to check if you have been invited." });
      }
      const isOwner = currentUser.role === "admin" || job.recruiter_id === currentUser.id;
      if (!isOwner && currentUser.role === "freelancer") {
        const apps = await storage.getFreelancerApplications(currentUser.id);
        const hasInviteOrApplication = apps.some(app => app.job_id === jobId);
        if (!hasInviteOrApplication) {
          return res.status(403).json({ error: "This job is only accessible via invitation." });
        }
      }
    }

    res.json(job);
  } catch (error) {
    console.error("Get job by ID error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get job posting presets
export async function getJobPresets(req: Request, res: Response) {
  try {
    // Return common job posting templates
    const presets = [
      {
        id: "av-tech",
        name: "AV Technician",
        description: "Audio/Visual technical support role",
        skills: ["Audio Equipment", "Video Equipment", "Troubleshooting", "Setup"],
      },
      {
        id: "lighting-tech",
        name: "Lighting Technician",
        description: "Event lighting setup and operation",
        skills: ["Lighting Design", "DMX", "Rigging", "Programming"],
      },
      {
        id: "stage-manager",
        name: "Stage Manager",
        description: "Event coordination and stage management",
        skills: ["Event Coordination", "Team Management", "Scheduling", "Communication"],
      },
    ];
    res.json(presets);
  } catch (error) {
    console.error("Get job presets error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get jobs by recruiter
export async function getJobsByRecruiter(req: Request, res: Response) {
  try {
    const recruiterId = parseInt(req.params.recruiterId);
    const jobs = await storage.getJobsByRecruiterId(recruiterId);
    res.set("Cache-Control", "no-store");
    res.json(jobs);
  } catch (error) {
    console.error("Get recruiter jobs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Create new job
export async function createJob(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "recruiter") {
      return res.status(403).json({ error: "Only employers can create jobs" });
    }

    const result = insertJobSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Job validation failed:", JSON.stringify(result.error.issues, null, 2));
      console.error("Request body:", JSON.stringify(req.body, null, 2));
      return res.status(400).json({ error: "Invalid input", details: result.error.issues });
    }

    const job = await storage.createJob({
      ...result.data,
      recruiter_id: (req as any).user.id,
      status: result.data.status || "private", // Default to private if not specified
    });

    // Send job alert emails to matching freelancers (non-blocking)
    // Only for EventLink jobs (not external jobs) AND only if active (published)
    if (job.type !== "external" && job.status === "active") {
      const { emailService } = await import("../utils/emailNotificationService");
      emailService.sendJobAlertToMatchingFreelancers(job).catch((error) => {
        console.error("Failed to send job alert emails:", error);
      });
    }

    res.status(201).json(job);
  } catch (error) {
    console.error("Create job error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update job
export async function updateJob(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.jobId);

    // Check if user is authorized to update this job
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const job = await storage.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if ((req as any).user.role !== "admin" && job.recruiter_id !== (req as any).user.id) {
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

    // Notify only active applicants about the job update (not rejected or hired)
    const jobApplications = await storage.getJobApplications(jobId);
    const activeApplications = jobApplications.filter(
      (app) => app.status === "applied" || app.status === "reviewed" || app.status === "shortlisted"
    );

    // Parallelize notification creation for performance
    await Promise.all(
      activeApplications.map((application) =>
        storage.createNotification({
          user_id: application.freelancer_id,
          type: "job_update",
          title: "Job Updated",
          message: `The job "${updatedJob.title}" at ${updatedJob.company} that you applied for has been updated. Please review the changes.`,
          priority: "normal",
          related_entity_type: "job",
          related_entity_id: jobId,
          action_url: `/jobs/${jobId}`,
          metadata: JSON.stringify({
            job_id: jobId,
            application_id: application.id,
            job_title: updatedJob.title,
            company: updatedJob.company,
          }),
        })
      )
    );

    // If job is being published (status changing to active), send alerts if not sent before
    if (job.status === "private" && updatedJob.status === "active") {
      if (updatedJob.type !== "external") {
        const { emailService } = await import("../utils/emailNotificationService");
        emailService.sendJobAlertToMatchingFreelancers(updatedJob).catch((error) => {
          console.error("Failed to send job alert emails:", error);
        });
      }
    }

    res.json(updatedJob);
  } catch (error) {
    console.error("Update job error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Track job link view
export async function trackJobLinkView(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.id || req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    const { source } = req.body;
    const referrer = req.headers.referer || req.headers.referrer || null;
    const userAgent = req.headers["user-agent"] || null;

    await storage.createJobLinkView({
      job_id: jobId,
      source: source || "direct",
      referrer: referrer as string | undefined,
      user_agent: userAgent as string | undefined,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Track job link view error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get job link view count (for recruiter/admin)
export async function getJobLinkViewCount(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.id || req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    const count = await storage.getJobLinkViewCount(jobId);
    res.json({ job_id: jobId, views: count });
  } catch (error) {
    console.error("Get job link view count error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Close job manually
export async function closeJob(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.jobId);

    if (Number.isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const job = await storage.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if ((req as any).user.role !== "admin" && job.recruiter_id !== (req as any).user.id) {
      return res.status(403).json({ error: "Not authorized to close this job" });
    }

    if (job.status === "closed") {
      return res.status(400).json({ error: "Job is already closed" });
    }

    const updatedJob = await storage.updateJob(jobId, { status: "closed" });

    const jobApplications = await storage.getJobApplications(jobId);
    const activeApplications = jobApplications.filter(
      (app) => app.status === "applied" || app.status === "reviewed" || app.status === "shortlisted" || app.status === "invited"
    );

    await Promise.all(
      activeApplications.map((application) =>
        storage.createNotification({
          user_id: application.freelancer_id,
          type: "job_update",
          title: "Job Closed",
          message: `The job "${job.title}" at ${job.company} has been closed by the employer and is no longer accepting applications.`,
          priority: "normal",
          related_entity_type: "job",
          related_entity_id: jobId,
          action_url: `/jobs/${jobId}`,
          metadata: JSON.stringify({
            job_id: jobId,
            application_id: application.id,
            job_title: job.title,
            company: job.company,
          }),
        })
      )
    );

    res.set("Cache-Control", "no-store");
    res.json(updatedJob);
  } catch (error) {
    console.error("Close job error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Delete job
export async function deleteJob(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.jobId);

    if (Number.isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    // Check if user is authorized to delete this job
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const job = await storage.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if ((req as any).user.role !== "admin" && job.recruiter_id !== (req as any).user.id) {
      return res.status(403).json({ error: "Not authorized to delete this job" });
    }

    // Find all hired freelancers for this job before deletion
    const jobApplications = await storage.getJobApplications(jobId);
    const hiredApplications = jobApplications.filter((app) => app.status === "hired");

    // Create cancellation notifications for hired freelancers
    for (const application of hiredApplications) {
      await storage.createNotification({
        user_id: application.freelancer_id,
        type: "job_update",
        title: "Job Cancelled",
        message: `Unfortunately, the job "${job.title}" at ${job.company} has been cancelled by the employer.`,
        priority: "high",
        related_entity_type: "job",
        related_entity_id: jobId,
        metadata: JSON.stringify({
          reason: "job_deleted",
          application_id: application.id,
          job_title: job.title,
          company: job.company,
        }),
      });
    }

    await storage.deleteJob(jobId);

    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      jobId: jobId,
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Delete job error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
