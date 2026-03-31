import type { Request, Response } from "express";
import ExcelJS from "exceljs";
import { storage } from "../../storage";
import { generateJWTToken } from "../utils/auth.util";
import { sendContactReplyEmail } from "../utils/emailService";
import { emailService } from "../utils/emailNotificationService";

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
    const feedbackId = parseInt(req.params.id);
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
    const feedbackId = parseInt(req.params.id);
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
    const message = messages.find(m => m.id === messageId);

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

    const { jobs, total } = await storage.getAdminJobs(page, limit, search, status, type, sortBy, sortOrder);

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

    const { users, total } = await storage.getAllUsers(page, limit, search, role, status, sortBy, sortOrder, profileStatus);

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
export async function bootstrapGrantAdminAccess(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Only allow admin@eventlink.one for this override
    if (email.trim().toLowerCase() !== "admin@eventlink.one") {
      return res.status(403).json({ error: "This endpoint is only for admin@eventlink.one" });
    }

    // Find user by email
    const user = await storage.getUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found with that email address." });
    }

    // Update user role to admin
    const updatedUser = await storage.updateUserRole(user.id, "admin");

    // Generate JWT token using the same function as signin to ensure consistency
    const token = generateJWTToken(updatedUser);

    res.json({
      message: "Admin access granted successfully!",
      token: token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Grant admin access error:", error);
    res.status(500).json({ error: "Failed to grant admin access" });
  }
}

export async function bootstrapCreateFirstAdmin(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Email allowlist restriction removed for bootstrap - any existing user can become admin

    // Check if any admins already exist (to prevent abuse)
    const existingAdmins = await storage.getAdminUsers();
    const realAdmins = existingAdmins.filter(admin => admin.role === "admin");

    if (realAdmins.length > 0) {
      return res.status(400).json({
        error: "Admin users already exist. Use the regular admin management interface.",
      });
    }

    // Find user by email
    const user = await storage.getUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found with that email address. Please register first." });
    }

    // Update user role to admin
    const updatedUser = await storage.updateUserRole(user.id, "admin");

    // Generate JWT token using the same function as signin to ensure consistency
    const token = generateJWTToken(updatedUser);

    res.json({
      message: "First admin created successfully! You can now use the admin dashboard.",
      token: token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Bootstrap admin creation error:", error);
    res.status(500).json({ error: "Failed to create first admin" });
  }
}

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

    console.log(`🔔 Admin triggered job alerts for job ${jobId}: "${job.title}"`);

    // Run async without blocking response
    emailService.sendJobAlertToMatchingFreelancers(job).catch((error) => {
      console.error(`Failed to send job alerts for job ${jobId}:`, error);
    });

    res.json({
      success: true,
      message: `Job alert emails are being sent for "${job.title}". Check the email notification logs for results.`,
    });
  } catch (error) {
    console.error("Retrigger job alerts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- XLSX Export Helpers ---

function fmtDate(d: unknown): string {
  if (!d) return "";
  try {
    return new Date(d as string).toISOString().slice(0, 10);
  } catch {
    return String(d);
  }
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Apply bold header style and auto-fit column widths to a worksheet. */
function styleSheet(ws: ExcelJS.Worksheet, headers: string[]) {
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD8690E" } };
    cell.alignment = { vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFB85C0A" } },
    };
  });
  headerRow.height = 20;

  // Auto-fit column widths based on header label length (with generous min/max)
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = Math.min(Math.max(h.length + 4, 12), 40);
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/** Add a sheet with headers + data rows, returning the worksheet. */
function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: unknown[][]
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers);
  for (const row of rows) {
    ws.addRow(row.map(str));
  }
  styleSheet(ws, headers);
  return ws;
}

// Export all admin dashboard data as a multi-sheet XLSX workbook
export async function exportAdminXLSX(req: Request, res: Response) {
  try {
    const [analytics, usersResult, jobsResult, feedbackList, contactList, adminUsers, ratingsAll] =
      await Promise.all([
        storage.getAdminAnalytics(),
        storage.getAllUsers(1, 100000),
        storage.getAdminJobs(1, 100000),
        storage.getAllFeedback(),
        storage.getAllContactMessages(),
        storage.getAdminUsers(),
        storage.getAllRatings(),
      ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "EventLink Admin";
    wb.created = new Date();

    // Sheet 1 — Overview
    addSheet(wb, "Overview", ["Metric", "Value"], [
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
    addSheet(
      wb,
      "Users",
      ["ID", "Full Name", "Email", "Role", "Status", "Email Verified", "Join Date", "Profile Status"],
      (usersResult.users || []).map((u: any) => [
        u.id,
        `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
        u.email,
        u.role === "recruiter" ? "employer" : (u.role ?? ""),
        u.status ?? "",
        u.email_verified ? "Yes" : "No",
        fmtDate(u.created_at),
        u.profile_status ?? "",
      ])
    );

    // Sheet 3 — Jobs
    addSheet(
      wb,
      "Jobs",
      ["ID", "Title", "Company", "Location", "Status", "Type", "Applications", "Hired", "Posted By", "Poster Email", "Created Date"],
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
        fmtDate(j.created_at),
      ])
    );

    // Sheet 4 — Feedback
    addSheet(
      wb,
      "Feedback",
      ["ID", "Type", "Status", "User Email", "Description", "Admin Response", "Created Date"],
      (feedbackList || []).map((f: any) => [
        f.id,
        f.type ?? "",
        f.status ?? "",
        f.user?.email ?? "",
        f.description ?? "",
        f.admin_response ?? "",
        fmtDate(f.created_at),
      ])
    );

    // Sheet 5 — Contact Messages
    addSheet(
      wb,
      "Contact Messages",
      ["ID", "Name", "Email", "Subject", "Message", "Status", "Replied", "Created Date"],
      (contactList || []).map((m: any) => [
        m.id,
        m.name ?? "",
        m.email ?? "",
        m.subject ?? "",
        m.message ?? "",
        m.status ?? "",
        m.replied_at ? "Yes" : "No",
        fmtDate(m.created_at),
      ])
    );

    // Sheet 6 — Ratings (Moderation)
    addSheet(
      wb,
      "Ratings",
      ["ID", "Rating", "Comment", "Status", "Flagged", "Employer Email", "Job Title", "Admin Notes", "Created Date"],
      (ratingsAll || []).map((r: any) => [
        r.id,
        r.overall_rating ?? "",
        r.comment ?? "",
        r.status ?? "",
        r.is_flagged ? "Yes" : "No",
        r.recruiter?.email ?? "",
        r.job_title ?? "",
        r.admin_notes ?? "",
        fmtDate(r.created_at),
      ])
    );

    // Sheet 7 — Admin Management
    addSheet(
      wb,
      "Admin Management",
      ["ID", "Full Name", "Email", "Role", "Status", "Join Date"],
      (adminUsers || []).map((a: any) => [
        a.id,
        `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
        a.email,
        a.role ?? "",
        a.status ?? "",
        fmtDate(a.created_at),
      ])
    );

    const filename = `eventlink_admin_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Admin XLSX export error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Send bulk in-app messages to filtered users (admin only)
export async function sendBulkMessages(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;
    if (!adminUser) return res.status(401).json({ error: "Not authenticated" });

    const { message, filters } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const search = filters?.search || undefined;
    const role = filters?.role && filters.role !== "all" ? filters.role : undefined;
    const status = filters?.status && filters.status !== "all" ? filters.status : undefined;
    const profileStatus = filters?.profileStatus && filters.profileStatus !== "all" ? filters.profileStatus : undefined;

    // Fetch all matching users (no pagination cap)
    const { users } = await storage.getAllUsers(1, 100000, search, role, status, "created_at", "desc", profileStatus);

    // Never message admins or the sender
    const recipients = users.filter(u => u.id !== adminUser.id && u.role !== "admin");

    let sent = 0;
    let failed = 0;

    const adminName =
      adminUser.first_name && adminUser.last_name
        ? `${adminUser.first_name} ${adminUser.last_name}`
        : "EventLink";

    for (const recipient of recipients) {
      try {
        const conversation = await storage.getOrCreateConversation(adminUser.id, recipient.id);
        await storage.sendMessage({
          conversation_id: conversation.id,
          sender_id: adminUser.id,
          content: message.trim(),
          is_system: false,
        });

        const conversationUrl = `/dashboard?tab=messages&conversationId=${conversation.id}`;

        await storage.createNotification({
          user_id: recipient.id,
          type: "new_message",
          title: "New Message from EventLink",
          message: `You have a new message from ${adminName}`,
          data: JSON.stringify({ conversation_id: conversation.id }),
          action_url: conversationUrl,
        });

        // Send email notification (non-blocking — failures don't abort the loop)
        const recipientName =
          recipient.first_name && recipient.last_name
            ? `${recipient.first_name} ${recipient.last_name}`
            : recipient.email;
        const messagePreview =
          message.trim().length > 150 ? `${message.trim().substring(0, 150)}...` : message.trim();

        emailService
          .sendMessageNotification({
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            recipientName,
            senderName: adminName,
            messagePreview,
            conversationId: conversation.id,
          })
          .catch((err: any) =>
            console.error(`Bulk message email failed for user ${recipient.id}:`, err)
          );

        sent++;
      } catch (err) {
        console.error(`Bulk message: failed for user ${recipient.id}:`, err);
        failed++;
      }
    }

    console.log(`📨 Bulk message sent by admin ${adminUser.id}: ${sent} sent, ${failed} failed`);
    res.json({ sent, failed, total: recipients.length });
  } catch (error) {
    console.error("Bulk message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
