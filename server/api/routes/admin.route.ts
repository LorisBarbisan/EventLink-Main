import type { Express } from "express";
import {
  addFeedbackResponse,
  adminDeleteUser,
  bootstrapCreateFirstAdmin,
  bootstrapGrantAdminAccess,
  getAdminJobDetail,
  getAdminJobs,
  getAdminUsers,
  getAllContactMessages,
  getAllFeedback,
  getAllUsers,
  getAnalyticsOverview,
  getFeedbackStats,
  grantAdminAccess,
  retriggerJobAlerts,
  revokeAdminAccess,
  sendContactReply,
  updateFeedbackStatus,
  updateUserStatus,
} from "../controllers/admin.controller";
import { requireAdminAuth } from "../middleware/admin.middleware";

export function registerAdminRoutes(app: Express) {
  // Get all feedback (admin only)
  app.get("/api/admin/feedback", requireAdminAuth, getAllFeedback);

  // Get feedback statistics (admin only)
  app.get("/api/admin/feedback/stats", requireAdminAuth, getFeedbackStats);

  // Update feedback status (admin only)
  app.put("/api/admin/feedback/:id/status", requireAdminAuth, updateFeedbackStatus);

  // Add admin response to feedback (admin only)
  app.put("/api/admin/feedback/:id/response", requireAdminAuth, addFeedbackResponse);

  // Get all contact messages (admin only)
  app.get("/api/admin/contact-messages", requireAdminAuth, getAllContactMessages);

  // Send reply to contact message (admin only)
  app.post("/api/admin/contact-messages/:id/reply", requireAdminAuth, sendContactReply);

  // Get all jobs (admin only)
  app.get("/api/admin/jobs", requireAdminAuth, getAdminJobs);

  // Get job detail (admin only)
  app.get("/api/admin/jobs/:id", requireAdminAuth, getAdminJobDetail);

  // Manually retrigger job alert emails for a specific job (admin only)
  app.post("/api/admin/jobs/:id/send-alerts", requireAdminAuth, retriggerJobAlerts);

  // Get all users (admin only)
  app.get("/api/admin/users", requireAdminAuth, getAllUsers);

  // Get analytics overview (admin only)
  app.get("/api/admin/analytics/overview", requireAdminAuth, getAnalyticsOverview);

  // Get all admin users (admin only)
  app.get("/api/admin/users/admins", requireAdminAuth, getAdminUsers);

  // Grant admin access to user (admin only)
  app.post("/api/admin/users/grant-admin", requireAdminAuth, grantAdminAccess);

  // Update user status (admin only)
  app.patch("/api/admin/users/:id/status", requireAdminAuth, updateUserStatus);

  // Hard delete a user account (admin only)
  app.delete("/api/admin/users/:id", requireAdminAuth, adminDeleteUser);

  // Revoke admin access from user (admin only)
  app.post("/api/admin/users/revoke-admin", requireAdminAuth, revokeAdminAccess);

  // Bootstrap endpoint for initial admin setup (no auth required)
  // Special override endpoint for admin@eventlink.one production access
  app.post("/api/admin/grant-admin-access", bootstrapGrantAdminAccess);

  app.post("/api/admin/create-first-admin", bootstrapCreateFirstAdmin);

  // Admin Dashboard Route (will be handled by frontend routing)
  app.get("/api/admin/*", (req, res, next) => {
    // This will be handled by the frontend router
    next();
  });
}
