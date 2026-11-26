import type { Express } from "express";
import {
  addFeedbackResponse,
  adminDeleteUser,
  adminLinkTeamMember,
  adminListTaxRates,
  adminUpdateTaxRate,
  adminCheckGovuk,
  adminUpdateDocumentDates,
  getAdminDocuments,
  bulkUpdateSubscription,
  exportAdminXLSX,
  getAdminJobDetail,
  getAdminJobs,
  getAdminTeamDetail,
  getAdminTeams,
  getAdminUsers,
  getAllContactMessages,
  getAllFeedback,
  getAllUsers,
  getAnalyticsOverview,
  getFeedbackStats,
  getBroadcastAudience,
  sendBroadcastTest,
  getDirectOffers,
  getNotifyFreelancersPreview,
  getPendingGuestJobs,
  grantAdminAccess,
  moderateGuestJob,
  notifyFreelancersForJob,
  retriggerJobAlerts,
  revokeAdminAccess,
  sendBulkMessages,
  sendContactReply,
  updateFeedbackStatus,
  updateUserStatus,
  updateUserSubscription,
} from "../controllers/admin.controller";
import { requireAdminAuth } from "../middleware/admin.middleware";
import { booksUsage } from "../services/books-usage.service";

export function registerAdminRoutes(app: Express) {
  // Books usage: counts and dates only, never content (admin only)
  app.get("/api/admin/books-usage", requireAdminAuth, async (req, res) => {
    try {
      // Record who looked, so access to this view is itself accountable
      console.log(
        `[books-usage] viewed by admin user ${(req as any).user?.id} at ${new Date().toISOString()}`
      );
      res.json(await booksUsage());
    } catch (err) {
      console.error("[books-usage] failed:", err);
      res.status(500).json({ error: "Failed to load Books usage" });
    }
  });

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

  // Guest job moderation queue (admin only)
  app.get("/api/admin/jobs/pending-guest", requireAdminAuth, getPendingGuestJobs);
  app.get("/api/admin/direct-offers", requireAdminAuth, getDirectOffers);
  app.post("/api/admin/jobs/:id/moderate", requireAdminAuth, moderateGuestJob);

  // Get all jobs (admin only)
  app.get("/api/admin/jobs", requireAdminAuth, getAdminJobs);

  // Get job detail (admin only)
  app.get("/api/admin/jobs/:id", requireAdminAuth, getAdminJobDetail);

  // Manually retrigger job alert emails for a specific job (admin only)
  app.post("/api/admin/jobs/:id/send-alerts", requireAdminAuth, retriggerJobAlerts);

  // Get count of freelancers who would be notified for a job (admin only)
  app.get("/api/admin/jobs/:id/notify-preview", requireAdminAuth, getNotifyFreelancersPreview);

  // Send "Notify Freelancers" emails for a specific job (admin only)
  app.post("/api/admin/jobs/:id/notify-freelancers", requireAdminAuth, notifyFreelancersForJob);

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
  app.patch("/api/admin/users/:id/subscription", requireAdminAuth, updateUserSubscription);

  // Hard delete a user account (admin only)
  app.delete("/api/admin/users/:id", requireAdminAuth, adminDeleteUser);

  // Revoke admin access from user (admin only)
  app.post("/api/admin/users/revoke-admin", requireAdminAuth, revokeAdminAccess);

  // Send bulk in-app messages to filtered users (admin only)
  app.post("/api/admin/bulk-message", requireAdminAuth, sendBulkMessages);
  app.post("/api/admin/broadcast/audience", requireAdminAuth, getBroadcastAudience);
  app.post("/api/admin/broadcast/test", requireAdminAuth, sendBroadcastTest);

  // Export all dashboard data as XLSX workbook (admin only)
  app.get("/api/admin/export/xlsx", requireAdminAuth, exportAdminXLSX);

  // Admin Teams / Companies management
  app.get("/api/admin/teams", requireAdminAuth, getAdminTeams);
  app.get("/api/admin/teams/:id", requireAdminAuth, getAdminTeamDetail);

  // Admin: link two existing employer accounts as company + team member
  app.post("/api/admin/team/link", requireAdminAuth, adminLinkTeamMember);

  // Bulk subscription update (admin only)
  app.post("/api/admin/users/subscription/bulk", requireAdminAuth, bulkUpdateSubscription);

  // Admin Documents — see all uploaded docs + fill in missing expiry dates
  app.get("/api/admin/documents", requireAdminAuth, getAdminDocuments);
  app.patch("/api/admin/documents/:id/dates", requireAdminAuth, adminUpdateDocumentDates);

  // Tax rates management (admin only)
  app.get("/api/admin/tax-rates", requireAdminAuth, adminListTaxRates);
  app.patch("/api/admin/tax-rates/:taxYear", requireAdminAuth, adminUpdateTaxRate);
  app.post("/api/admin/tax-rates/check-govuk", requireAdminAuth, adminCheckGovuk);

  // Admin Dashboard Route (will be handled by frontend routing)
  app.get("/api/admin/*", (req, res, next) => {
    // This will be handled by the frontend router
    next();
  });
}
