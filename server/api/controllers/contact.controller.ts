import { insertContactMessageSchema } from "@shared/schema";
import type { Request, Response } from "express";
import { storage } from "../../storage";
import { sendEmail } from "../utils/emailService";
import { wsService } from "../websocket/websocketService";

// Submit contact form
export async function submitContactForm(req: Request, res: Response) {
  try {
    // Validate input
    const result = insertContactMessageSchema.safeParse({
      name: req.body.name,
      email: req.body.email,
      subject: req.body.subject,
      message: req.body.message,
      ip_address: req.ip || req.headers["x-forwarded-for"] || "unknown",
      user_agent: req.headers["user-agent"] || "unknown",
    });

    if (!result.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: result.error.issues,
      });
    }

    // Save message to database
    const contactMessage = await storage.createContactMessage({
      name: result.data.name,
      email: result.data.email,
      subject: result.data.subject,
      message: result.data.message,
      ip_address: result.data.ip_address || undefined,
      user_agent: result.data.user_agent || undefined,
    });

    // Send email notification to admin
    try {
      await sendEmail({
        to: "admin@eventlink.one",
        from: "noreply@eventlink.one",
        subject: `New Contact Form Message — ${result.data.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Contact Form Message</h2>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p><strong>From:</strong> ${result.data.name}</p>
              <p><strong>Email:</strong> <a href="mailto:${result.data.email}">${result.data.email}</a></p>
              <p><strong>Subject:</strong> ${result.data.subject}</p>
              <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h3 style="color: #333; margin-top: 0;">Message:</h3>
              <p style="white-space: pre-wrap; line-height: 1.6;">${result.data.message}</p>
            </div>
            <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                <strong>IP Address:</strong> ${result.data.ip_address}<br>
                <strong>User Agent:</strong> ${result.data.user_agent}
              </p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send contact email notification:", emailError);
      // Don't fail the request if email fails - message is still saved
    }

    // Real-time notification for admins
    try {
      const admins = await storage.getAdminUsers();

      for (const admin of admins) {
        // Create database notification
        await storage.createNotification({
          user_id: admin.id,
          type: "contact_message",
          title: "New Contact Message",
          message: `From ${result.data.name}: ${result.data.subject}`,
          action_url: "/admin#contact",
          priority: "normal",
        });

        // Broadcast badge count update
        const counts = await storage.getCategoryUnreadCounts(admin.id);
        wsService.broadcastBadgeCounts(admin.id, counts);
      }

      const adminIds = admins.map(a => a.id);
      if (adminIds.length > 0) {
        wsService.broadcastToUsers(adminIds, {
          type: "new_contact_message",
          message: contactMessage,
        });
        console.log(`📡 Broadcasted new_contact_message to ${adminIds.length} admins`);
      }
    } catch (wsError) {
      console.error("Failed to broadcast contact message via WebSocket:", wsError);
      // Non-blocking
    }

    res.status(201).json({
      success: true,
      message: "Your message has been sent successfully. Our team will be in touch soon.",
      id: contactMessage.id,
    });
  } catch (error) {
    console.error("Contact form submission error:", error);
    res.status(500).json({ error: "Failed to submit contact form. Please try again later." });
  }
}

// Get all contact messages (admin only)
export async function getContactMessages(req: Request, res: Response) {
  try {
    // Check if user is admin
    if (!(req as any).user || (req as any).user.role !== "admin") {
      return res.status(403).json({ error: "Only administrators can view contact messages" });
    }

    const messages = await storage.getAllContactMessages();
    res.json(messages);
  } catch (error) {
    console.error("Get contact messages error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
