import type { Request, Response } from "express";
import { ukDate, ukToday } from "@shared/job-dates";
import {
  addTypedSheet,
  createWorkbook,
  streamWorkbook,
  type ColSpec,
  type ColType,
} from "../utils/xlsx";
import { storage } from "../../storage";
import { sendContactReplyEmail } from "../utils/emailService";
import { emailService } from "../utils/emailNotificationService";
import { resolveBroadcastAudience } from "../services/broadcast-audience.service";
import { db } from "../config/db";
import { teamMembers, users } from "../../../shared/schema";
import { eq } from "drizzle-orm";

// Get all feedback (admin only)
export async function getAllFeedback(req: Request, res: Response) {
  try {
    const { status, type } = req.query;
    const feedback = await storage.getAllFeedback(status as string, type as string);
    res.json({ feedback });
  } catch (error) {
    console.error("Get admin feedback error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get feedback statistics (admin only)
export async function getFeedbackStats(req: Request, res: Response) {
  try {
    const stats = await storage.getFeedbackStats();
    res.json(stats);
  } catch (error) {
    console.error("Get feedback stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update feedback status (admin only)
export async function updateFeedbackStatus(req: Request, res: Response) {
  try {
    const feedbackId = Number(req.params.id);
    if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
      return res.status(400).json({ error: "Invalid feedback id" });
    }
    const { status } = req.body;

    if (!["pending", "in_review", "resolved", "closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await storage.updateFeedbackStatus(feedbackId, status);
    res.json({ message: "Feedback status updated successfully" });
  } catch (error) {
    console.error("Update feedback status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Add admin response to feedback (admin only)
export async function addFeedbackResponse(req: Request, res: Response) {
  try {
    const feedbackId = Number(req.params.id);
    if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
      return res.status(400).json({ error: "Invalid feedback id" });
    }
    const { response } = req.body;

    if (!response) {
      return res.status(400).json({ error: "Response is required" });
    }

    const feedback = await storage.getFeedbackById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    await storage.addAdminResponse(feedbackId, response, (req as any).user!.id);

    // Send email notification to user if email is available
    const userEmail = feedback.user_email;
    // If no direct email, try to find linked user
    let emailToSend = userEmail;

    if (!emailToSend && feedback.user_id) {
      const user = await storage.getUser(feedback.user_id);
      if (user) {
        emailToSend = user.email;
      }
    }

    if (emailToSend) {
      try {
        console.log(`📧 Sending feedback response email to ${emailToSend}`);
        await sendContactReplyEmail(
          emailToSend,
          `Response to your feedback: ${feedback.feedback_type}`,
          `Hello ${feedback.user_name || "there"},\n\nThank you for your feedback regarding "${feedback.message.substring(0, 50)}${feedback.message.length > 50 ? "..." : ""}".\n\nOur team has reviewed it and here is our response:\n\n${response}\n\nBest regards,\nEventLink Team`
        );
        console.log(`✅ Feedback response email sent successfully to ${emailToSend}`);
      } catch (emailError: any) {
        console.error(
          "❌ Failed to send feedback response email:",
          emailError?.message || emailError
        );
        // Don't fail the request, just log the error
      }
    } else {
      console.log(
        `ℹ️ No email address found for feedback ID ${feedbackId}, skipping email notification`
      );
    }

    res.json({ message: "Admin response added successfully" });
  } catch (error) {
    console.error("Add feedback response error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get all contact messages (admin only)
export async function getAllContactMessages(req: Request, res: Response) {
  try {
    const messages = await storage.getAllContactMessages();
    res.json(messages);
  } catch (error) {
    console.error("Get contact messages error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Send reply to contact message (admin only)
export async function sendContactReply(req: Request, res: Response) {
  console.log(`📧 Contact reply request received for message ID: ${req.params.id}`);
  try {
    const messageId = parseInt(req.params.id);
    const { reply } = req.body;
    console.log(`📧 Reply content length: ${reply?.length || 0}`);

    if (!reply || !reply.trim()) {
      console.log("❌ Reply validation failed - empty reply");
      return res.status(400).json({ error: "Reply message is required" });
    }

    // Get the contact message
    const messages = await storage.getAllContactMessages();
    const message = messages.find((m) => m.id === messageId);

    if (!message) {
      return res.status(404).json({ error: "Contact message not found" });
    }

    // Send reply email
    try {
      console.log(`📧 Attempting to send email to ${message.email}`);
      await sendContactReplyEmail(
        message.email,
        `Re: ${message.subject}`,
        `Hello ${message.name},\n\nThank you for contacting EventLink. Here's our response to your message:\n\n${reply}\n\nBest regards,\nEventLink Team`
      );

      console.log(`✅ Email sent successfully to ${message.email}`);

      // Update message status to replied only after successful email send
      await storage.updateContactMessageStatus(messageId, "replied");
      console.log(`✅ Message status updated to 'replied' for ID: ${messageId}`);

      res.json({ message: "Reply sent successfully" });
    } catch (emailError: any) {
      console.error("❌ Failed to send reply email:", emailError?.message || emailError);
      if (emailError?.response?.body) {
        console.error("❌ SendGrid error body:", JSON.stringify(emailError.response.body, null, 2));
      }
      // Don't update status if email fails - let admin retry

      // Return error so frontend can show proper error message
      return res.status(500).json({
        error: "Failed to send email reply. Please try again.",
        details:
          process.env.NODE_ENV === "development"
            ? `Email error: ${emailError?.message || "Unknown error"}`
            : undefined,
      });
    }
  } catch (error) {
    console.error("Send contact reply error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get all jobs (admin only)
export async function getAdminJobs(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const type = (req.query.type as string) || undefined;
    const sortBy = (req.query.sortBy as string) || "created_at";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";
    const country = (req.query.country as string) || undefined;

    const { jobs, total } = await storage.getAdminJobs(
      page,
      limit,
      search,
      status,
      type,
      sortBy,
      sortOrder,
      country
    );

    res.json({
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get admin jobs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAdminJobDetail(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }
    const result = await storage.getAdminJobDetail(jobId);
    if (!result) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("Get admin job detail error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get pending guest jobs awaiting moderation (admin only)
export async function getPendingGuestJobs(req: Request, res: Response) {
  try {
    const jobs = await storage.getPendingGuestJobs();
    res.json({ jobs, total: jobs.length });
  } catch (error) {
    console.error("getPendingGuestJobs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Read-only oversight list of recent direct offers (admin only). No moderation
// controls — direct offers are private and already delivered to the freelancer.
export async function getDirectOffers(req: Request, res: Response) {
  try {
    const offers = await storage.listDirectOffersForAdmin();
    const reportedCount = offers.filter((o) => o.reportedAt).length;
    res.json({ offers, total: offers.length, reportedCount });
  } catch (error) {
    console.error("getDirectOffers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Approve or reject a guest job (admin only)
export async function moderateGuestJob(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }
    const { decision, note } = req.body as { decision: string; note?: string };
    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }
    // A private job (e.g. a direct offer) is not a publication candidate.
    // Moderating it would publish or close a private arrangement, so refuse.
    const existing = await storage.getJobById(jobId);
    if (!existing) {
      return res.status(404).json({ error: "Job not found" });
    }
    if (existing.status === "private") {
      return res.status(409).json({ error: "A private job cannot be moderated for publication." });
    }
    const moderatorId = (req as any).user?.id;
    const job = await storage.moderateJob(jobId, decision, moderatorId, note);
    res.json(job);
  } catch (error) {
    console.error("moderateGuestJob error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get all users (admin only)
export async function getAllUsers(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || undefined;
    const role = (req.query.role as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const sortBy = (req.query.sortBy as string) || "created_at";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";
    const profileStatus = (req.query.profileStatus as string) || undefined;
    const country = (req.query.country as string) || undefined;

    const { users, total } = await storage.getAllUsers(
      page,
      limit,
      search,
      role,
      status,
      sortBy,
      sortOrder,
      profileStatus,
      country
    );

    // Remove sensitive information
    const safeUsers = users.map((user: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, email_verification_token, password_reset_token, ...safeUser } = user;
      return safeUser;
    });

    res.json({
      users: safeUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get admin users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get analytics overview (admin only)
// Get analytics overview (admin only)
export async function getAnalyticsOverview(req: Request, res: Response) {
  try {
    const analytics = await storage.getAdminAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error("Get analytics overview error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get all admin users (admin only)
export async function getAdminUsers(req: Request, res: Response) {
  try {
    const adminUsers = await storage.getAdminUsers();

    // Remove sensitive information
    const safeAdmins = adminUsers.map((user: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, email_verification_token, password_reset_token, ...safeUser } = user;
      return safeUser;
    });

    res.json(safeAdmins);
  } catch (error) {
    console.error("Get admin users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Hard delete a user account (admin only — for inactive/pending/no-profile accounts)
export async function adminDeleteUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    const requestingAdmin = (req as any).user;
    if (requestingAdmin?.id === userId) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    // Don't hard-delete an account that still has live activity — deleting it
    // would orphan or destroy live jobs and bookings. Refuse with a clear
    // reason so the admin can close those first.
    const blockers = await storage.getAccountDeletionBlockers(userId);
    if (blockers.activeJobs > 0 || blockers.openBookings > 0) {
      const parts: string[] = [];
      if (blockers.activeJobs > 0) {
        parts.push(`${blockers.activeJobs} active job${blockers.activeJobs > 1 ? "s" : ""}`);
      }
      if (blockers.openBookings > 0) {
        parts.push(`${blockers.openBookings} open booking${blockers.openBookings > 1 ? "s" : ""}`);
      }
      return res.status(409).json({
        error: `This account still has ${parts.join(" and ")}. Close or cancel them before removing it.`,
      });
    }

    await storage.adminHardDeleteUser(userId);
    res.json({ message: "Account permanently removed." });
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
}

// Update user status (admin only)
export async function updateUserStatus(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    if (!["active", "deactivated"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updatedUser = await storage.updateUserStatus(userId, status);

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove sensitive information
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, email_verification_token, password_reset_token, ...safeUser } =
      updatedUser as any;

    res.json(safeUser);
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Grant admin access to user (admin only)
export async function grantAdminAccess(req: Request, res: Response) {
  try {
    const { email, userId } = req.body;

    // Support both email and userId for backwards compatibility
    let user;
    if (email) {
      console.log("🔧 Looking up user by email:", email.trim().toLowerCase());
      // Find user by email
      user = await storage.getUserByEmail(email.trim().toLowerCase());
      console.log("🔧 User lookup result:", user ? `Found user ${user.id}` : "User not found");
      if (!user) {
        console.log("❌ User not found with email:", email);
        return res.status(404).json({ error: "User not found with that email address" });
      }
    } else if (userId) {
      // Find user by ID
      user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
    } else {
      return res.status(400).json({ error: "Either email or user ID is required" });
    }

    console.log("🔧 Updating user role to admin for user:", user.id);
    // Email allowlist restriction removed - any existing user can become admin

    // Update user role to admin using the updateUserRole function
    const updatedUser = await storage.updateUserRole(user.id, "admin");
    console.log("✅ Admin role granted successfully to:", updatedUser.email);

    res.json({
      message: "Admin access granted successfully",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("❌ Grant admin error:", error);
    res.status(500).json({ error: "Failed to grant admin access" });
  }
}

// Revoke admin access from user (admin only)
export async function revokeAdminAccess(req: Request, res: Response) {
  try {
    const { email, userId } = req.body;

    // Support both email and userId for backwards compatibility
    let user;
    if (email) {
      // Find user by email
      user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.status(404).json({ error: "User not found with that email address" });
      }
    } else if (userId) {
      // Find user by ID
      user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
    } else {
      return res.status(400).json({ error: "Either email or user ID is required" });
    }

    // Prevent self-demotion
    if ((req as any).user!.id === user.id) {
      return res.status(400).json({ error: "Cannot revoke your own admin access" });
    }

    if (user.role !== "admin") {
      return res.status(400).json({ error: "User is not an admin" });
    }

    // Update user role to freelancer (default) using the updateUserRole function
    const updatedUser = await storage.updateUserRole(user.id, "freelancer");

    res.json({
      message: "Admin access revoked successfully",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Revoke admin error:", error);
    res.status(500).json({ error: "Failed to revoke admin status" });
  }
}

// Bootstrap endpoint for initial admin setup (no auth required)
// Special override endpoint for admin@eventlink.one production access

// Manually trigger job alert emails for a specific job (admin only)
export async function retriggerJobAlerts(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    const job = await storage.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status !== "active") {
      return res.status(400).json({ error: "Job must be active (published) to send alerts" });
    }

    if ((job as any).type === "external") {
      return res.status(400).json({ error: "Cannot send alerts for external jobs" });
    }

    const { userIds } = req.body || {};
    const isSpecific = Array.isArray(userIds) && userIds.length > 0;

    console.log(
      `🔔 Admin triggered job alerts for job ${jobId}: "${job.title}"` +
        (isSpecific ? ` → specific users: [${userIds.join(", ")}]` : " → all matching freelancers")
    );

    if (isSpecific) {
      // Send only to the explicitly selected users, bypassing their alert-filter preferences
      emailService.sendJobAlertToSpecificUsers(job, userIds).catch((error) => {
        console.error(`Failed to send job alerts for job ${jobId}:`, error);
      });
    } else {
      // Default: send to all freelancers whose alert preferences match
      emailService.sendJobAlertToMatchingFreelancers(job).catch((error) => {
        console.error(`Failed to send job alerts for job ${jobId}:`, error);
      });
    }

    res.json({
      success: true,
      message: isSpecific
        ? `Job alert emails are being sent to ${userIds.length} selected user${userIds.length !== 1 ? "s" : ""}.`
        : `Job alert emails are being sent for "${job.title}". Check the email notification logs for results.`,
    });
  } catch (error) {
    console.error("Retrigger job alerts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Preview how many freelancers will be notified for a job (admin only)
export async function getNotifyFreelancersPreview(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) return res.status(400).json({ error: "Invalid job ID" });

    const job = await storage.getJobById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.status !== "active")
      return res.status(400).json({ error: "Job must be active to notify freelancers" });

    const matching = await storage.getFreelancersMatchingJob(job);

    const lastNotifiedAt = (job as any).last_notified_at;
    const hoursAgo = lastNotifiedAt
      ? Math.floor((Date.now() - new Date(lastNotifiedAt).getTime()) / 3_600_000)
      : null;

    res.json({
      count: matching.length,
      jobTitle: job.title,
      employerName: job.company,
      lastNotifiedAt: lastNotifiedAt ?? null,
      hoursAgo,
    });
  } catch (error) {
    console.error("Notify freelancers preview error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Send "Notify Freelancers" emails for a specific job (admin only)
export async function notifyFreelancersForJob(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) return res.status(400).json({ error: "Invalid job ID" });

    const job = await storage.getJobById(jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.status !== "active")
      return res.status(400).json({ error: "Job must be active to notify freelancers" });

    const lastNotifiedAt = (job as any).last_notified_at;
    const force = req.body?.force === true;
    if (lastNotifiedAt && !force) {
      const hoursAgo = Math.floor((Date.now() - new Date(lastNotifiedAt).getTime()) / 3_600_000);
      if (hoursAgo < 24) {
        return res.status(409).json({
          error: "recently_notified",
          hoursAgo,
          message: `Freelancers were already notified about this job ${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago. Send again?`,
        });
      }
    }

    const matching = await storage.getFreelancersMatchingJob(job);
    if (matching.length === 0) {
      return res.json({ success: true, count: 0, message: "No matching freelancers found." });
    }

    const eventDate = job.event_date
      ? new Date(job.event_date).toLocaleDateString("en-GB", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "Date TBC";

    const descriptionPreview = job.description
      ? job.description.slice(0, 150).replace(/\s+\S*$/, "") +
        (job.description.length > 150 ? "…" : "")
      : "";

    // Update timestamp immediately so double-clicks don't send twice
    await storage.updateJobLastNotifiedAt(jobId);

    // Fire and forget — send emails in background
    (async () => {
      let sent = 0;
      const notifiedUserIds: number[] = [];
      for (const freelancer of matching) {
        try {
          const ok = await emailService.sendSingleJobNotification({
            recipientId: freelancer.userId,
            recipientEmail: freelancer.email,
            recipientFirstName: freelancer.firstName || "there",
            jobTitle: job.title,
            employerName: job.company,
            location: job.location,
            payRate: job.rate,
            eventDate,
            descriptionPreview,
            jobId: job.id,
            jobSlug: (job as any).slug ?? null,
          });
          if (ok) {
            sent++;
            notifiedUserIds.push(freelancer.userId);
          }
        } catch (err) {
          console.error(`Failed to notify freelancer ${freelancer.userId}:`, err);
        }
      }
      // Set notification timestamps so frequency cap works across manual + automated sends
      await storage
        .setManualNotificationTimestamps(jobId, notifiedUserIds)
        .catch((err) => console.error("Failed to set manual notification timestamps:", err));
      console.log(
        `✅ Notify Freelancers: sent ${sent}/${matching.length} emails for job ${jobId} "${job.title}"`
      );
    })();

    res.json({
      success: true,
      count: matching.length,
      message: `Notification sent to ${matching.length} freelancer${matching.length === 1 ? "" : "s"}`,
    });
  } catch (error) {
    console.error("Notify freelancers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- XLSX Export Helpers ---

/** Timestamp → "YYYY-MM-DD", which addTypedSheet turns into a real date cell. */
function isoDay(d: unknown): string | null {
  if (!d) return null;
  const t = new Date(d as string);
  return Number.isNaN(t.getTime()) ? null : ukDate(t);
}

/** Column specs from headers; anything not listed in `types` is text. */
function cols(headers: string[], types: Record<string, ColType> = {}): ColSpec[] {
  return headers.map((header) => ({ header, type: types[header] ?? "text" }));
}

// Export all admin dashboard data as a multi-sheet XLSX workbook
export async function exportAdminXLSX(req: Request, res: Response) {
  try {
    const [
      analytics,
      usersResult,
      jobsResult,
      feedbackList,
      contactList,
      adminUsers,
      ratingsAll,
      recruiterProfiles,
    ] = await Promise.all([
      storage.getAdminAnalytics(),
      storage.getAllUsers(1, 100000),
      storage.getAdminJobs(1, 100000),
      storage.getAllFeedback(),
      storage.getAllContactMessages(),
      storage.getAdminUsers(),
      storage.getAllRatings(),
      storage.getAllRecruiterProfiles(),
    ]);

    // Country per user: freelancers already carry profile_country from getAllUsers;
    // employers' country lives on their recruiter profile, so merge that in too.
    const recruiterCountryByUserId = new Map<number, string>(
      (recruiterProfiles || [])
        .filter((r: any) => r.country)
        .map((r: any) => [r.user_id, r.country as string])
    );

    const wb = createWorkbook();

    // Sheet 1 — Overview
    addTypedSheet(wb, "Overview", cols(["Metric", "Value"], { Value: "number" }), [
      ["Total Users", analytics.users.total],
      ["Active Users", analytics.users.active],
      ["New Users This Month", analytics.users.thisMonth],
      ["Total Jobs", analytics.jobs.total],
      ["Active Jobs", analytics.jobs.active],
      ["New Jobs This Month", analytics.jobs.thisMonth],
      ["Pending Feedback", analytics.feedback.pending],
      ["Total Applications", analytics.applications.total],
      ["Hired Applications", analytics.applications.hired],
      ["Applications This Month", analytics.applications.thisMonth],
    ]);

    // Sheet 2 — Users
    addTypedSheet(
      wb,
      "Users",
      cols(
        [
          "ID",
          "Full Name",
          "Email",
          "Role",
          "Country",
          "Status",
          "Email Verified",
          "Join Date",
          "Profile Status",
        ],
        { ID: "number", "Join Date": "date" }
      ),
      (usersResult.users || []).map((u: any) => [
        u.id,
        `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
        u.email,
        u.role === "recruiter" ? "employer" : (u.role ?? ""),
        u.profile_country ?? recruiterCountryByUserId.get(u.id) ?? "",
        u.status ?? "",
        u.email_verified ? "Yes" : "No",
        isoDay(u.created_at),
        u.profile_status ?? "",
      ])
    );

    // Sheet 3 — Jobs
    addTypedSheet(
      wb,
      "Jobs",
      cols(
        [
          "ID",
          "Title",
          "Company",
          "Location",
          "Status",
          "Type",
          "Applications",
          "Hired",
          "Posted By",
          "Poster Email",
          "Created Date",
        ],
        { ID: "number", Applications: "number", Hired: "number", "Created Date": "date" }
      ),
      (jobsResult.jobs || []).map((j: any) => [
        j.id,
        j.title ?? "",
        j.company_name ?? "",
        j.location ?? "",
        j.status ?? "",
        j.is_published ? "Published" : "Private",
        j.application_count ?? 0,
        j.hired_count ?? 0,
        j.recruiter_name ?? "",
        j.recruiter_email ?? "",
        isoDay(j.created_at),
      ])
    );

    // Sheet 4 — Feedback
    addTypedSheet(
      wb,
      "Feedback",
      cols(
        ["ID", "Type", "Status", "User Email", "Description", "Admin Response", "Created Date"],
        { ID: "number", "Created Date": "date" }
      ),
      (feedbackList || []).map((f: any) => [
        f.id,
        f.type ?? "",
        f.status ?? "",
        f.user?.email ?? "",
        f.description ?? "",
        f.admin_response ?? "",
        isoDay(f.created_at),
      ])
    );

    // Sheet 5 — Contact Messages
    addTypedSheet(
      wb,
      "Contact Messages",
      cols(["ID", "Name", "Email", "Subject", "Message", "Status", "Replied", "Created Date"], {
        ID: "number",
        "Created Date": "date",
      }),
      (contactList || []).map((m: any) => [
        m.id,
        m.name ?? "",
        m.email ?? "",
        m.subject ?? "",
        m.message ?? "",
        m.status ?? "",
        m.replied_at ? "Yes" : "No",
        isoDay(m.created_at),
      ])
    );

    // Sheet 6 — Ratings (Moderation)
    addTypedSheet(
      wb,
      "Ratings",
      cols(
        [
          "ID",
          "Rating",
          "Comment",
          "Status",
          "Flagged",
          "Employer Email",
          "Job Title",
          "Admin Notes",
          "Created Date",
        ],
        { ID: "number", Rating: "number", "Created Date": "date" }
      ),
      (ratingsAll || []).map((r: any) => [
        r.id,
        r.overall_rating ?? "",
        r.comment ?? "",
        r.status ?? "",
        r.is_flagged ? "Yes" : "No",
        r.recruiter?.email ?? "",
        r.job_title ?? "",
        r.admin_notes ?? "",
        isoDay(r.created_at),
      ])
    );

    // Sheet 7 — Admin Management
    addTypedSheet(
      wb,
      "Admin Management",
      cols(["ID", "Full Name", "Email", "Role", "Status", "Join Date"], {
        ID: "number",
        "Join Date": "date",
      }),
      (adminUsers || []).map((a: any) => [
        a.id,
        `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
        a.email,
        a.role ?? "",
        a.status ?? "",
        isoDay(a.created_at),
      ])
    );

    const filename = `eventlink_admin_export_${ukToday()}.xlsx`;
    await streamWorkbook(wb, res, filename);
    res.end();
  } catch (error) {
    console.error("Admin XLSX export error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Send bulk in-app messages to filtered users (admin only)
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Live recipient breakdown for the announcement composer. Uses the same
// resolver as the send path, so the count shown is the count that is used.
export async function getBroadcastAudience(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;
    if (!adminUser) return res.status(401).json({ error: "Not authenticated" });

    const { category, filters, userIds } = req.body as {
      category?: string;
      filters?: Record<string, unknown>;
      userIds?: number[];
    };
    if (category !== "announcement" && category !== "service") {
      return res.status(400).json({ error: "category must be 'announcement' or 'service'" });
    }

    const { breakdown } = await resolveBroadcastAudience({
      adminId: adminUser.id,
      category,
      filters: filters as any,
      userIds,
    });
    res.json(breakdown);
  } catch (error) {
    console.error("getBroadcastAudience error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Send the composed email to the admin only — same template, subject and
// footer a recipient would get, with a [TEST] prefix and a banner. The address
// is ANNOUNCEMENT_TEST_EMAIL, falling back to the signed-in admin's own.
export async function sendBroadcastTest(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;
    if (!adminUser) return res.status(401).json({ error: "Not authenticated" });

    const { message, emailSubject, count } = req.body as {
      message?: string;
      emailSubject?: string;
      count?: number;
    };
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }
    const subjectClean =
      typeof emailSubject === "string" && emailSubject.trim()
        ? emailSubject.trim()
        : "A message from EventLink";
    const to = process.env.ANNOUNCEMENT_TEST_EMAIL || adminUser.email;
    const n = typeof count === "number" && Number.isFinite(count) ? count : null;
    const banner = `<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#92400E;">This is a <strong>test</strong>.${
      n != null ? ` The real send would reach <strong>${n}</strong> recipient(s).` : ""
    }</div>`;
    const messageHtml = banner + escapeHtml(message.trim()).replace(/\r?\n/g, "<br/>");
    const replyTo = process.env.BROADCAST_REPLY_TO || "admin@eventlink.one";

    const okSent = await emailService.sendSystemUpdateNotification({
      recipientId: adminUser.id,
      recipientEmail: to,
      recipientName: adminUser.first_name?.trim() || "there",
      title: subjectClean,
      message: messageHtml,
      subjectOverride: `[TEST] ${subjectClean}`,
      hideHeading: true,
      skipPreferenceCheck: true,
      replyTo,
    });
    if (!okSent) return res.status(502).json({ error: "Test email could not be sent" });
    res.json({ ok: true, to });
  } catch (error) {
    console.error("sendBroadcastTest error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function sendBulkMessages(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;
    if (!adminUser) return res.status(401).json({ error: "Not authenticated" });

    const { message, filters, userIds, emailSubject, category } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }
    if (category !== "announcement" && category !== "service") {
      return res.status(400).json({ error: "category must be 'announcement' or 'service'" });
    }

    // Single source of truth for who receives what — the same resolver the live
    // count endpoint uses, so the number shown is the number sent.
    const { breakdown, emailRecipients, inAppRecipients } = await resolveBroadcastAudience({
      adminId: adminUser.id,
      category,
      filters,
      userIds,
    });

    const adminName =
      adminUser.first_name && adminUser.last_name
        ? `${adminUser.first_name} ${adminUser.last_name}`
        : "EventLink";
    const broadcastSubject =
      typeof emailSubject === "string" && emailSubject.trim()
        ? emailSubject.trim()
        : "A message from EventLink";
    const messageHtml = escapeHtml(message.trim()).replace(/\r?\n/g, "<br/>");
    const replyTo = process.env.BROADCAST_REPLY_TO || "admin@eventlink.one";
    const logMetadata = JSON.stringify({
      broadcast: true,
      category,
      filters: filters ?? null,
      byUserIds: Array.isArray(userIds) && userIds.length > 0,
    });

    // In-app message + notification: service/legal only. A broadcast is not a
    // conversation, so an announcement is email-only — opted out means opted
    // out, and nothing lands in a one-sided thread nobody is watching.
    let inAppCreated = 0;
    if (category === "service") {
      for (const recipient of inAppRecipients) {
        try {
          const conversation = await storage.getOrCreateConversation(adminUser.id, recipient.id);
          await storage.sendMessage({
            conversation_id: conversation.id,
            sender_id: adminUser.id,
            content: message.trim(),
            is_system_message: false,
          });
          await storage.createNotification({
            user_id: recipient.id,
            type: "new_message",
            title: "New Message from EventLink",
            message: `You have a new message from ${adminName}`,
            metadata: JSON.stringify({ conversation_id: conversation.id }),
            action_url: `/dashboard?tab=messages&conversationId=${conversation.id}`,
          });
          inAppCreated++;
        } catch (err) {
          console.error(`Broadcast in-app failed for user ${recipient.id}:`, err);
        }
      }
    }

    // Email through the shared system-update path (real template, unsubscribe
    // link, send-log row). Announcement is gated on the toggle — belt-and-
    // braces, since the resolver already excluded opted-out users; service/legal
    // skips the gate. replyTo so a reply to an email-only send lands somewhere.
    // Fire-and-forget so a whole-base send doesn't block the request; delivery
    // is recorded in email_notification_logs.
    for (const recipient of emailRecipients) {
      const greetingName = recipient.first_name?.trim() || "there";
      emailService
        .sendSystemUpdateNotification({
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          recipientName: greetingName,
          title: broadcastSubject,
          message: messageHtml,
          subjectOverride: broadcastSubject,
          hideHeading: true,
          skipPreferenceCheck: category === "service",
          replyTo,
          metadata: logMetadata,
        })
        .catch((err: unknown) =>
          console.error(`Broadcast email failed for user ${recipient.id}:`, err)
        );
    }

    console.log(
      `📨 Broadcast (${category}) by admin ${adminUser.id}: email ${emailRecipients.length}, in-app ${inAppCreated}`
    );
    res.json({ category, breakdown, emailQueued: emailRecipients.length, inAppCreated });
  } catch (error) {
    console.error("Bulk message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get all teams/companies (admin only)
export async function getAdminTeams(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || undefined;
    const sort = (req.query.sort as string) || undefined;

    const { teams, total } = await storage.getAdminTeams(page, limit, search, sort);

    res.json({
      teams,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get admin teams error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get team detail (admin only)
export async function getAdminTeamDetail(req: Request, res: Response) {
  try {
    const companyUserId = parseInt(req.params.id);
    if (isNaN(companyUserId)) {
      return res.status(400).json({ error: "Invalid company user ID" });
    }

    const result = await storage.getAdminTeamDetail(companyUserId);
    if (!result) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Get admin team detail error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Admin-only: link an existing user account to a company
 * as a team member, bypassing the invitation email flow.
 *
 * POST /api/admin/team/link
 * Body: { companyId, userId, role }
 */
export async function adminLinkTeamMember(req: Request, res: Response) {
  try {
    const { companyId, userId, role = "manager" } = req.body;

    if (!companyId || !userId) {
      return res.status(400).json({ error: "companyId and userId are both required" });
    }

    if (!["admin", "manager"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const [company] = await db.select().from(users).where(eq(users.id, companyId));
    const [member] = await db.select().from(users).where(eq(users.id, userId));

    if (!company || !member) {
      return res.status(404).json({ error: "One or both accounts not found" });
    }

    const [existing] = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));

    if (existing) {
      return res.status(409).json({
        error: `User ${userId} is already linked to company ${existing.companyId}`,
        existingLink: existing,
      });
    }

    const [link] = await db
      .insert(teamMembers)
      .values({
        companyId,
        userId,
        role,
        invitedEmail: member.email,
        inviteToken: null,
        inviteAccepted: true,
        inviteAcceptedAt: new Date(),
      })
      .returning();

    console.log(`Admin linked user ${userId} (${member.email}) to company ${companyId} as ${role}`);

    return res.status(201).json({
      success: true,
      message: `${member.email} is now linked to company ${companyId} as ${role}`,
      membership: link,
    });
  } catch (error) {
    console.error("adminLinkTeamMember error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateUserSubscription(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const { tier } = req.body;
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });
    if (!["free", "pro"].includes(tier)) return res.status(400).json({ error: "Invalid tier" });
    const updated = await storage.updateSubscriptionTier(userId, tier as "free" | "pro");
    if (!updated) return res.status(404).json({ error: "User not found" });
    return res.json({
      id: updated.id,
      email: updated.email,
      subscription_tier: updated.subscription_tier,
    });
  } catch (error) {
    console.error("updateUserSubscription error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function bulkUpdateSubscription(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;
    const { emails, tier } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "emails must be a non-empty array" });
    }
    if (emails.length > 100) {
      return res.status(400).json({ error: "Maximum 100 emails per request" });
    }
    if (!["free", "pro"].includes(tier)) {
      return res.status(400).json({ error: "tier must be 'free' or 'pro'" });
    }

    const updated: string[] = [];
    const notFound: string[] = [];

    for (const email of emails) {
      if (typeof email !== "string") continue;
      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        notFound.push(email);
        continue;
      }
      await storage.updateSubscriptionTier(user.id, tier as "free" | "pro");
      updated.push(email);
    }

    console.log(
      `Admin ${adminUser?.email} (id=${adminUser?.id}) bulk set subscription to '${tier}' for: [${updated.join(", ")}]`
    );

    return res.json({ updated, notFound });
  } catch (error) {
    console.error("bulkUpdateSubscription error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Reject an expiry date more than 10 years out or more than 5 years past.
function adminExpiryDateError(value: string): string | null {
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return "Expiry date is not a valid date.";
  const now = new Date();
  const maxFuture = new Date(now);
  maxFuture.setFullYear(now.getFullYear() + 10);
  const maxPast = new Date(now);
  maxPast.setFullYear(now.getFullYear() - 5);
  if (expiry.getTime() > maxFuture.getTime()) return "That expiry date is more than 10 years away.";
  if (expiry.getTime() < maxPast.getTime())
    return "That expiry date is more than 5 years in the past.";
  return null;
}

// Admin documents view: every current document with owner + expiry status.
export async function getAdminDocuments(_req: Request, res: Response) {
  try {
    const documents = await storage.getAdminDocuments();
    res.json(documents);
  } catch (error) {
    console.error("getAdminDocuments error:", error);
    res.status(500).json({ error: "Failed to load documents" });
  }
}

// Admin sets/corrects a document's expiry (and optional issue) date.
export async function adminUpdateDocumentDates(req: Request, res: Response) {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (Number.isNaN(documentId)) {
      return res.status(400).json({ error: "Invalid document id" });
    }
    const { issueDate, expiryDate, noExpiry } = req.body as {
      issueDate?: string | null;
      expiryDate?: string;
      noExpiry?: boolean;
    };
    if (!noExpiry) {
      if (!expiryDate) {
        return res.status(400).json({ error: "An expiry date is required" });
      }
      const err = adminExpiryDateError(expiryDate);
      if (err) {
        return res.status(400).json({ error: err });
      }
    }
    const updated = await storage.adminSetDocumentDates(documentId, {
      issue_date: issueDate || null,
      expiry_date: noExpiry ? null : expiryDate!,
      expiry_source: noExpiry ? "not_applicable" : "entered",
    });
    if (!updated) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json({ success: true, document: updated });
  } catch (error) {
    console.error("adminUpdateDocumentDates error:", error);
    res.status(500).json({ error: "Failed to update document dates" });
  }
}

// ── Tax rates management ──────────────────────────────────────────────────────

export async function adminListTaxRates(req: Request, res: Response) {
  try {
    const rates = await storage.listTaxRates();
    return res.json(rates);
  } catch (err) {
    console.error("adminListTaxRates error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function adminUpdateTaxRate(req: Request, res: Response) {
  try {
    const taxYear = req.params.taxYear;
    const { bands, stale_flag } = req.body;
    if (!bands) return res.status(400).json({ error: "bands is required" });

    const existing = await storage.getTaxRate(taxYear);
    if (!existing) return res.status(404).json({ error: "Tax year not found" });

    const updated = await storage.upsertTaxRate({
      tax_year: taxYear,
      effective_from: existing.effective_from,
      bands,
      govuk_etag: existing.govuk_etag,
      govuk_checked_at: existing.govuk_checked_at,
      stale_flag: stale_flag ?? false,
    });
    return res.json(updated);
  } catch (err) {
    console.error("adminUpdateTaxRate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// GOVUK_INCOME_TAX_PATH is the gov.uk Content API path for the income tax rates page.
const GOVUK_IT_PATH = "/government/publications/rates-and-allowances-income-tax";

export async function adminCheckGovuk(req: Request, res: Response) {
  try {
    const url = `https://www.gov.uk/api/content${GOVUK_IT_PATH}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return res.status(502).json({ error: `gov.uk returned ${response.status}` });
    }
    const json = (await response.json()) as Record<string, unknown>;
    const govukUpdatedAt: string | null =
      (json.public_updated_at as string | null) ?? (json.updated_at as string | null) ?? null;

    // Update all rows with the new checked timestamp and stale flag
    const rates = await storage.listTaxRates();
    const checkedAt = new Date();
    let anyStale = false;

    for (const rate of rates) {
      // Mark stale if gov.uk page updated after our last check (or no prior check)
      const wasStale = govukUpdatedAt
        ? !rate.govuk_checked_at || new Date(govukUpdatedAt) > new Date(rate.govuk_checked_at)
        : false;
      if (wasStale) anyStale = true;
      await storage.upsertTaxRate({
        ...rate,
        govuk_checked_at: checkedAt,
        stale_flag: wasStale || rate.stale_flag,
      });
    }

    return res.json({
      govuk_updated_at: govukUpdatedAt,
      checked_at: checkedAt.toISOString(),
      stale: anyStale,
    });
  } catch (err) {
    console.error("adminCheckGovuk error:", err);
    return res.status(500).json({ error: "Failed to contact gov.uk" });
  }
}
