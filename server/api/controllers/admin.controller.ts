import type { Request, Response } from "express";
import { storage } from "../../storage";
import { generateJWTToken } from "../utils/auth.util";
import { sendContactReplyEmail } from "../utils/emailService";

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
