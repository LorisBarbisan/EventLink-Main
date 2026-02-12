import { insertJobApplicationSchema, type JobApplication } from "@shared/schema";
import type { Request, Response } from "express";
import { storage } from "../../storage";
import { emailService } from "../utils/emailNotificationService";

// Get freelancer bookings (accepted applications)
export async function getFreelancerBookings(req: Request, res: Response) {
  try {
    const freelancerId = parseInt(req.params.freelancerId);

    // Check authorization - user can only view their own bookings or admin can view all
    if (
      !(req as any).user ||
      ((req as any).user.id !== freelancerId && (req as any).user.role !== "admin")
    ) {
      return res.status(403).json({ error: "Not authorized to view these bookings" });
    }

    const applications = await storage.getFreelancerApplications(freelancerId);
    // Filter only hired applications for bookings
    const bookings = applications.filter(app => app.status === "hired");

    res.json(bookings);
  } catch (error) {
    console.error("Get freelancer bookings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Apply to job
export async function applyToJob(req: Request, res: Response) {
  try {
    // Extract numeric ID from job ID (handles both "123" and "real-123" formats)
    const jobIdStr = req.params.jobId;
    const jobId = parseInt(jobIdStr.replace(/^real-/, ""));

    if (!(req as any).user) {
      return res.status(401).json({ error: "Please log in to apply for jobs" });
    }

    if ((req as any).user.role !== "freelancer") {
      return res.status(403).json({
        error: `You are logged in as a ${(req as any).user.role}. Only freelancers can apply to jobs. Please log in with a freelancer account.`,
      });
    }

    // Check if job exists
    const job = await storage.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Check if already applied
    let existingApplications: JobApplication[] = [];
    try {
      existingApplications = await storage.getFreelancerApplications((req as any).user.id);
    } catch (appError) {
      console.error("Error fetching existing applications:", appError);
      // Continue with empty array if fetch fails - allow application to proceed
    }

    const alreadyApplied = existingApplications.some(app => app.job_id === jobId);

    if (alreadyApplied) {
      return res.status(400).json({ error: "You have already applied to this job" });
    }

    const applicationData = {
      job_id: jobId,
      freelancer_id: (req as any).user.id,
      cover_letter: req.body.cover_letter || "",
      status: "applied" as const,
    };

    const result = insertJobApplicationSchema.safeParse(applicationData);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input", details: result.error.issues });
    }

    const application = await storage.createJobApplication(result.data);

    // Create notification for recruiter (non-blocking)
    if (job.recruiter_id) {
      try {
        await storage.createNotification({
          user_id: job.recruiter_id,
          type: "application_update",
          title: "New Job Application",
          message: `A freelancer has applied to your job: ${job.title}`,
          priority: "high",
          related_entity_type: "application",
          related_entity_id: application.id,
          action_url: "/dashboard?tab=applications",
          metadata: JSON.stringify({ application_id: application.id, job_id: jobId }),
        });

        // Send email notification to recruiter
        try {
          const recruiter = await storage.getUser(job.recruiter_id);
          if (recruiter) {
            let recruiterDisplayName = recruiter.email;
            const recruiterProfile = await storage.getRecruiterProfile(job.recruiter_id);
            // Priority: company_name → user's full name → email
            if (recruiterProfile?.company_name) {
              recruiterDisplayName = recruiterProfile.company_name;
            } else if (recruiter.first_name || recruiter.last_name) {
              const firstName = recruiter.first_name || "";
              const lastName = recruiter.last_name || "";
              recruiterDisplayName = `${firstName} ${lastName}`.trim() || recruiter.email;
            }

            // Get freelancer's display name
            let freelancerDisplayName = "A freelancer";
            let freelancerTitle: string | undefined;
            const freelancerProfile = await storage.getFreelancerProfile((req as any).user.id);
            if (freelancerProfile) {
              if (freelancerProfile.first_name || freelancerProfile.last_name) {
                const firstName = freelancerProfile.first_name || "";
                const lastName = freelancerProfile.last_name || "";
                freelancerDisplayName = `${firstName} ${lastName}`.trim();
              }
              freelancerTitle = freelancerProfile.title || undefined;
            }

            emailService
              .sendNewApplicationNotification({
                recipientId: job.recruiter_id,
                recipientEmail: recruiter.email,
                recipientName: recruiterDisplayName,
                jobTitle: job.title,
                freelancerName: freelancerDisplayName,
                freelancerTitle: freelancerTitle,
                jobId: jobId,
                applicationId: application.id,
              })
              .catch(error => {
                console.error("Failed to send new application email:", error);
              });
          }
        } catch (emailError) {
          console.error("Error preparing new application email:", emailError);
        }
      } catch (notifError) {
        console.error("Failed to create notification (non-critical):", notifError);
        // Don't fail the application if notification fails
      }
    }

    res.status(201).json(application);
  } catch (error) {
    console.error("Apply to job error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");

    // Return more detailed error in development
    if (process.env.NODE_ENV === "development") {
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

// Get freelancer applications
export async function getFreelancerApplications(req: Request, res: Response) {
  try {
    const freelancerId = parseInt(req.params.freelancerId);

    // Check authorization
    if (
      !(req as any).user ||
      ((req as any).user.id !== freelancerId && (req as any).user.role !== "admin")
    ) {
      return res.status(403).json({ error: "Not authorized to view these applications" });
    }

    const applications = await storage.getFreelancerApplications(freelancerId);
    res.set("Cache-Control", "no-store");
    res.json(applications);
  } catch (error) {
    console.error("Get freelancer applications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get applications for a job
export async function getJobApplications(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.jobId);

    // Check if user is authorized to view applications for this job
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const job = await storage.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if ((req as any).user.role !== "admin" && job.recruiter_id !== (req as any).user.id) {
      return res.status(403).json({ error: "Not authorized to view applications for this job" });
    }

    const applications = await storage.getJobApplications(jobId);
    res.json(applications);
  } catch (error) {
    console.error("Get job applications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get recruiter applications
export async function getRecruiterApplications(req: Request, res: Response) {
  try {
    const recruiterId = parseInt(req.params.recruiterId);

    // Check authorization
    if (
      !(req as any).user ||
      ((req as any).user.id !== recruiterId && (req as any).user.role !== "admin")
    ) {
      return res.status(403).json({ error: "Not authorized to view these applications" });
    }

    // Use the proper storage method that includes job details
    const applications = await storage.getRecruiterApplications(recruiterId);

    res.set("Cache-Control", "no-store");
    res.json(applications);
  } catch (error) {
    console.error("Get recruiter applications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Accept application
export async function acceptApplication(req: Request, res: Response) {
  try {
    const applicationId = parseInt(req.params.applicationId);

    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Check if user is authorized to accept this application
    const application = await storage.getJobApplicationById(applicationId);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const job = await storage.getJobById(application.job_id);
    if (!job || ((req as any).user.role !== "admin" && job.recruiter_id !== (req as any).user.id)) {
      return res.status(403).json({ error: "Not authorized to accept this application" });
    }

    // Mark application as hired (this also automatically closes the job)
    await storage.updateApplicationStatus(applicationId, "hired");

    // Create notification for freelancer
    await storage.createNotification({
      user_id: application.freelancer_id,
      type: "application_update",
      title: "Application Accepted!",
      message: `Congratulations! Your application for "${job.title}" at ${job.company} has been accepted. The employer will contact you soon.`,
      priority: "high",
      related_entity_type: "application",
      related_entity_id: applicationId,
      action_url: "/dashboard?tab=jobs",
      metadata: JSON.stringify({
        application_id: applicationId,
        job_id: job.id,
        status: "hired",
      }),
    });

    // Send email notification (non-blocking)
    try {
      const freelancer = await storage.getUser(application.freelancer_id);
      if (freelancer) {
        let freelancerDisplayName = freelancer.email;
        const freelancerProfile = await storage.getFreelancerProfile(application.freelancer_id);
        if (freelancerProfile?.first_name || freelancerProfile?.last_name) {
          const firstName = freelancerProfile.first_name || "";
          const lastName = freelancerProfile.last_name || "";
          freelancerDisplayName = `${firstName} ${lastName}`.trim() || freelancer.email;
        }

        emailService
          .sendApplicationUpdateNotification({
            recipientId: application.freelancer_id,
            recipientEmail: freelancer.email,
            recipientName: freelancerDisplayName,
            jobTitle: job.title,
            companyName: job.company,
            status: "Accepted",
            applicationId: applicationId,
          })
          .catch(error => {
            console.error("Failed to send application update email:", error);
          });
      }
    } catch (error) {
      console.error("Error preparing application update email:", error);
    }

    // Broadcast live notification to freelancer if connected
    if ((global as any).broadcastToUser) {
      (global as any).broadcastToUser(application.freelancer_id, {
        type: "application_update",
        application: {
          id: applicationId,
          job_title: job.title,
          company: job.company,
        },
        status: "hired",
      });
    }

    res.json({ message: "Application accepted successfully" });
  } catch (error) {
    console.error("Accept application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Reject application
export async function rejectApplication(req: Request, res: Response) {
  try {
    const applicationId = parseInt(req.params.applicationId);

    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Check if user is authorized to reject this application
    const application = await storage.getJobApplicationById(applicationId);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const job = await storage.getJobById(application.job_id);
    if (!job || ((req as any).user.role !== "admin" && job.recruiter_id !== (req as any).user.id)) {
      return res.status(403).json({ error: "Not authorized to reject this application" });
    }

    await storage.updateApplicationStatus(applicationId, "rejected", req.body.message);

    // Create notification for freelancer
    await storage.createNotification({
      user_id: application.freelancer_id,
      type: "application_update",
      title: "Application Update",
      message: `Your application for "${job.title}" at ${job.company} was not selected this time. ${req.body.message ? "The employer left you feedback." : ""}`,
      priority: "normal",
      related_entity_type: "application",
      related_entity_id: applicationId,
      action_url: "/dashboard?tab=jobs",
      metadata: JSON.stringify({
        application_id: applicationId,
        job_id: job.id,
        status: "rejected",
        has_feedback: !!req.body.message,
      }),
    });

    // Send email notification (non-blocking)
    try {
      const freelancer = await storage.getUser(application.freelancer_id);
      if (freelancer) {
        let freelancerDisplayName = freelancer.email;
        const freelancerProfile = await storage.getFreelancerProfile(application.freelancer_id);
        if (freelancerProfile?.first_name || freelancerProfile?.last_name) {
          const firstName = freelancerProfile.first_name || "";
          const lastName = freelancerProfile.last_name || "";
          freelancerDisplayName = `${firstName} ${lastName}`.trim() || freelancer.email;
        }

        emailService
          .sendApplicationUpdateNotification({
            recipientId: application.freelancer_id,
            recipientEmail: freelancer.email,
            recipientName: freelancerDisplayName,
            jobTitle: job.title,
            companyName: job.company,
            status: "Not Selected",
            applicationId: applicationId,
          })
          .catch(error => {
            console.error("Failed to send application update email:", error);
          });
      }
    } catch (error) {
      console.error("Error preparing application update email:", error);
    }

    // Broadcast live notification to freelancer if connected
    if ((global as any).broadcastToUser) {
      (global as any).broadcastToUser(application.freelancer_id, {
        type: "application_update",
        application: {
          id: applicationId,
          job_title: job.title,
          company: job.company,
        },
        status: "rejected",
      });
    }

    res.json({ message: "Application rejected successfully" });
  } catch (error) {
    console.error("Reject application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Delete application (soft delete with role-based permissions)
export async function deleteApplication(req: Request, res: Response) {
  try {
    const applicationId = parseInt(req.params.applicationId);

    if (Number.isNaN(applicationId)) {
      return res.status(400).json({ error: "Invalid application ID" });
    }

    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get the application
    const application = await storage.getJobApplicationById(applicationId);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Check authorization and determine delete type
    let userRole: "freelancer" | "recruiter";

    if (
      (req as any).user.role === "freelancer" &&
      application.freelancer_id === (req as any).user.id
    ) {
      // Freelancer can delete their own applications
      userRole = "freelancer";
    } else if ((req as any).user.role === "recruiter" || (req as any).user.role === "admin") {
      // Recruiter/admin can hide applications from jobs they own
      const job = await storage.getJobById(application.job_id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if ((req as any).user.role === "admin" || job.recruiter_id === (req as any).user.id) {
        userRole = "recruiter";
      } else {
        return res.status(403).json({ error: "Not authorized to delete this application" });
      }
    } else {
      return res.status(403).json({ error: "Not authorized to delete this application" });
    }

    // Perform soft delete
    await storage.softDeleteApplication(applicationId, userRole);

    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      deletedFor: userRole,
      applicationId: applicationId,
      message: `Application ${userRole === "freelancer" ? "removed" : "hidden"} successfully`,
    });
  } catch (error) {
    console.error("Delete application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
// Invite freelancer to job
export async function inviteFreelancer(req: Request, res: Response) {
  try {
    const { jobId, freelancerId, message } = req.body;

    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if ((req as any).user.role !== "recruiter" && (req as any).user.role !== "admin") {
      return res.status(403).json({ error: "Only employers can invite freelancers" });
    }

    // Check if job exists and user owns it
    const job = await storage.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if ((req as any).user.role !== "admin" && job.recruiter_id !== (req as any).user.id) {
      return res.status(403).json({ error: "Not authorized to invite to this job" });
    }

    // Check if already applied/invited
    const existingApplications = await storage.getFreelancerApplications(freelancerId);
    const alreadyApplied = existingApplications.some(app => app.job_id === jobId);

    if (alreadyApplied) {
      return res
        .status(400)
        .json({ error: "Freelancer has already applied or been invited to this job" });
    }

    const applicationData = {
      job_id: jobId,
      freelancer_id: freelancerId,
      status: "invited" as const,
      invitation_message: message,
      cover_letter: "", // No cover letter for invites initially
    };

    const result = insertJobApplicationSchema.safeParse(applicationData);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input", details: result.error.issues });
    }

    const application = await storage.createJobApplication(result.data);

    // Create notification for freelancer
    await storage.createNotification({
      user_id: freelancerId,
      type: "application_update", // Using application_update or maybe 'system' for invites
      title: "Job Invitation",
      message: `${(req as any).user.first_name || "An employer"} invited you to apply for "${job.title}" at ${job.company}`,
      priority: "high",
      related_entity_type: "application",
      related_entity_id: application.id,
      action_url: "/dashboard?tab=jobs",
      metadata: JSON.stringify({
        application_id: application.id,
        job_id: jobId,
        type: "invitation",
      }),
    });

    // Send email notification to freelancer
    try {
      const freelancer = await storage.getUser(freelancerId);
      const recruiter = await storage.getUser((req as any).user.id);
      const recruiterProfile = await storage.getRecruiterProfile((req as any).user.id);

      if (freelancer && recruiter) {
        let recruiterDisplayName = recruiterProfile?.company_name || recruiter.email;
        if (
          (!recruiterDisplayName || recruiterDisplayName === recruiter.email) &&
          (recruiter.first_name || recruiter.last_name)
        ) {
          recruiterDisplayName =
            `${recruiter.first_name || ""} ${recruiter.last_name || ""}`.trim();
        }

        let freelancerDisplayName = freelancer.email;
        const freelancerProfile = await storage.getFreelancerProfile(freelancerId);
        if (freelancerProfile && (freelancerProfile.first_name || freelancerProfile.last_name)) {
          freelancerDisplayName =
            `${freelancerProfile.first_name || ""} ${freelancerProfile.last_name || ""}`.trim();
        }

        await emailService.sendInvitationNotification({
          recipientId: freelancerId,
          recipientEmail: freelancer.email,
          recipientName: freelancerDisplayName,
          recruiterName: recruiterDisplayName,
          jobTitle: job.title,
          message: message || "I'd like to invite you to apply for my job.",
          jobId: jobId,
        });
      }
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      // Continue, don't fail the request
    }

    res.status(201).json(application);
  } catch (error) {
    console.error("Invite freelancer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Respond to invitation (Accept/Decline)
export async function respondToInvitation(req: Request, res: Response) {
  try {
    const applicationId = parseInt(req.params.applicationId);
    const { status, responseMessage } = req.body; // status: 'applied' (accept) or 'declined'

    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const application = await storage.getJobApplicationById(applicationId);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (application.freelancer_id !== (req as any).user.id) {
      return res.status(403).json({ error: "Not authorized to respond to this invitation" });
    }

    if (application.status !== "invited") {
      return res
        .status(400)
        .json({ error: "This application is not an invitation or already responded to" });
    }

    if (status !== "applied" && status !== "declined") {
      return res.status(400).json({ error: "Invalid status response" });
    }

    // Update status
    // If declined, save response message key
    // We need to update storage method or use direct db update if schema supports it
    // Our updateApplicationStatus handles status, but not extra fields like responseMessage easily
    // without schema change I made.

    // I need to use db directly or extend storage method.
    // For now I'll use storage.updateApplicationStatus but I need to handle freelancer_response.
    // Actually I can't update freelancer_response with updateApplicationStatus.
    // I should create a specific method in storage or extend updateApplicationStatus?
    // Let's modify storage first? or just use db import here?
    // I'll stick to 'storage' abstraction but since I can't edit storage in this tool call...
    // I will wait.

    // WAIT: I can't edit storage.ts in this tool call.
    // I should have updated storage.ts to support updating freelancer_response.

    // Let's implement what we can here and I'll do a separate fix for storage if needed.
    // Actually, I can allow db usage here since it is available in imports?
    // 'db' is NOT imported in applications.controller.ts currently.
    // So I should stick to storage interface.

    // I will use updateApplicationStatus for now, and handle the message separately or update storage later.
    // BETTER: I'll finish this controller method assuming `updateInvitationResponse` exists,
    // then I'll go add it to storage.ts. It's safer.

    // Or I can just import 'db' and 'job_applications', 'eq' from schema/db config.
    // Let's rely on adding a method to storage.ts

    await storage.updateInvitationResponse(applicationId, status, responseMessage);

    // Notify recruiter
    const job = await storage.getJobById(application.job_id);
    if (job) {
      const title = status === "applied" ? "Invitation Accepted" : "Invitation Declined";
      const message =
        status === "applied"
          ? `Freelancer accepted your invitation for "${job.title}"`
          : `Freelancer declined your invitation for "${job.title}"`;

      await storage.createNotification({
        user_id: job.recruiter_id,
        type: "application_update",
        title: title,
        message: message,
        priority: "normal",
        related_entity_type: "application",
        related_entity_id: applicationId,
        action_url: "/dashboard?tab=applications",
        metadata: JSON.stringify({
          application_id: applicationId,
          job_id: job.id,
          status: status,
          response: responseMessage,
        }),
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Respond invitation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
