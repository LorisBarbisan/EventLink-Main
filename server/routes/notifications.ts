import type { Express } from "express";
import { storage } from "../storage";
import { insertNotificationSchema } from "@shared/schema";
import { authenticateJWT } from "./auth";

export function registerNotificationRoutes(app: Express) {
  // Get user notifications
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const notifications = await storage.getUserNotifications(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", authenticateJWT, async (req, res) => {
    try {
      const unreadCount = await storage.getUnreadNotificationCount(req.user.id);
      res.json({ count: unreadCount });
    } catch (error) {
      console.error("Get unread notification count error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get category-specific unread notification counts for tab badges
  app.get("/api/notifications/category-counts", authenticateJWT, async (req, res) => {
    try {
      const counts = await storage.getCategoryUnreadCounts(req.user.id);
      res.json(counts);
    } catch (error) {
      console.error("Get category notification counts error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create notification (usually called internally)
  app.post("/api/notifications", async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: "Only admins can create notifications directly" });
      }

      const result = insertNotificationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const notification = await storage.createNotification(result.data);
      res.status(201).json(notification);
    } catch (error) {
      console.error("Create notification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const notificationId = parseInt(req.params.id);
      
      // Check if notification belongs to user
      const notification = await storage.getNotification(notificationId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      if (notification.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Not authorized to mark this notification as read" });
      }

      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Mark notification as read error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/mark-all-read", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark category-specific notifications as read
  app.patch("/api/notifications/mark-category-read/:category", authenticateJWT, async (req, res) => {
    try {
      const category = req.params.category as 'messages' | 'applications' | 'jobs' | 'ratings';
      
      if (!['messages', 'applications', 'jobs', 'ratings'].includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }

      await storage.markCategoryNotificationsAsRead(req.user.id, category);
      res.json({ message: `${category} notifications marked as read` });
    } catch (error) {
      console.error("Mark category notifications as read error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const notificationId = parseInt(req.params.id);
      
      // Check if notification belongs to user
      const notification = await storage.getNotification(notificationId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      if (notification.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: "Not authorized to delete this notification" });
      }

      await storage.deleteNotification(notificationId);
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}