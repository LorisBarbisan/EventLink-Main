import type { Express } from "express";
import { storage } from "../storage";
import { insertNotificationSchema, insertNotificationPreferencesSchema, insertJobAlertFilterSchema } from "@shared/schema";
import { authenticateJWT } from "./auth";

export function registerNotificationRoutes(app: Express) {
  // Get user notifications
  app.get("/api/notifications", authenticateJWT, async (req, res) => {
    try {
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
  app.patch("/api/notifications/:id/read", authenticateJWT, async (req, res) => {
    try {
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
      
      // Send WebSocket update for badge counts
      try {
        const counts = await storage.getCategoryUnreadCounts(req.user.id);
        const broadcastToUser = (global as any).broadcastToUser;
        if (broadcastToUser) {
          broadcastToUser(req.user.id, {
            type: 'badge_counts_update',
            counts: counts
          });
        }
      } catch (wsError) {
        console.error("WebSocket broadcast error:", wsError);
      }
      
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Mark notification as read error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/mark-all-read", authenticateJWT, async (req, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      
      // Send WebSocket update for badge counts
      try {
        const counts = await storage.getCategoryUnreadCounts(req.user.id);
        const broadcastToUser = (global as any).broadcastToUser;
        if (broadcastToUser) {
          broadcastToUser(req.user.id, {
            type: 'badge_counts_update',
            counts: counts
          });
        }
      } catch (wsError) {
        console.error("WebSocket broadcast error:", wsError);
      }
      
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
      
      // Send WebSocket update for badge counts
      try {
        const counts = await storage.getCategoryUnreadCounts(req.user.id);
        const broadcastToUser = (global as any).broadcastToUser;
        if (broadcastToUser) {
          broadcastToUser(req.user.id, {
            type: 'badge_counts_update',
            counts: counts
          });
        }
      } catch (wsError) {
        console.error("WebSocket broadcast error:", wsError);
      }
      
      res.json({ message: `${category} notifications marked as read` });
    } catch (error) {
      console.error("Mark category notifications as read error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", authenticateJWT, async (req, res) => {
    try {
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
      
      // Send WebSocket update for badge counts
      try {
        const counts = await storage.getCategoryUnreadCounts(req.user.id);
        const broadcastToUser = (global as any).broadcastToUser;
        if (broadcastToUser) {
          broadcastToUser(req.user.id, {
            type: 'badge_counts_update',
            counts: counts
          });
        }
      } catch (wsError) {
        console.error("WebSocket broadcast error:", wsError);
      }
      
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get notification preferences
  app.get("/api/notifications/settings", authenticateJWT, async (req, res) => {
    try {
      let preferences = await storage.getNotificationPreferences(req.user.id);
      
      // Create default preferences if they don't exist
      if (!preferences) {
        preferences = await storage.createNotificationPreferences(req.user.id);
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Get notification preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update notification preferences
  app.post("/api/notifications/settings", authenticateJWT, async (req, res) => {
    try {
      // Validate request body with Zod schema
      const validationResult = insertNotificationPreferencesSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: validationResult.error.issues 
        });
      }

      // Get or create preferences first
      let preferences = await storage.getNotificationPreferences(req.user.id);
      if (!preferences) {
        preferences = await storage.createNotificationPreferences(req.user.id);
      }

      // Update with validated settings only (no user_id allowed in updates)
      const { user_id, ...updateData } = validationResult.data;
      const updatedPreferences = await storage.updateNotificationPreferences(req.user.id, updateData);
      res.json(updatedPreferences);
    } catch (error) {
      console.error("Update notification preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get job alert filters (returns first active filter for user)
  app.get("/api/notifications/job-alerts", authenticateJWT, async (req, res) => {
    try {
      const filters = await storage.getJobAlertFilters(req.user.id);
      // Return the first active filter, or null if none exists
      res.json(filters.length > 0 ? filters[0] : null);
    } catch (error) {
      console.error("Get job alert filters error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create or update job alert filter (upsert pattern)
  app.post("/api/notifications/job-alerts", authenticateJWT, async (req, res) => {
    try {
      // Validate request body with Zod schema
      const validationResult = insertJobAlertFilterSchema.partial().safeParse({
        ...req.body,
        user_id: req.user.id, // Force user_id to authenticated user
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: validationResult.error.issues 
        });
      }

      // Check if user already has a filter
      const existingFilters = await storage.getJobAlertFilters(req.user.id);
      
      let filter;
      if (existingFilters.length > 0) {
        // Update existing filter
        const { user_id, ...updateData } = validationResult.data;
        filter = await storage.updateJobAlertFilter(existingFilters[0].id, updateData);
      } else {
        // Create new filter
        filter = await storage.createJobAlertFilter({
          user_id: req.user.id,
          skills: validationResult.data.skills || null,
          locations: validationResult.data.locations || null,
          date_from: validationResult.data.date_from || null,
          date_to: validationResult.data.date_to || null,
          job_types: validationResult.data.job_types || null,
          keywords: validationResult.data.keywords || null,
          is_active: validationResult.data.is_active ?? true,
        });
      }
      
      res.json(filter);
    } catch (error) {
      console.error("Create/update job alert filter error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update job alert filter
  app.patch("/api/notifications/job-alerts/:id", authenticateJWT, async (req, res) => {
    try {
      const filterId = parseInt(req.params.id);
      
      // Verify ownership before updating
      const existingFilters = await storage.getJobAlertFilters(req.user.id);
      const ownedFilter = existingFilters.find(f => f.id === filterId);
      
      if (!ownedFilter) {
        return res.status(404).json({ error: "Job alert filter not found or access denied" });
      }

      // Validate request body
      const validationResult = insertJobAlertFilterSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: validationResult.error.issues 
        });
      }

      // Prevent user_id changes
      const { user_id, ...updateData } = validationResult.data;
      const updatedFilter = await storage.updateJobAlertFilter(filterId, updateData);
      res.json(updatedFilter);
    } catch (error) {
      console.error("Update job alert filter error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete job alert filter
  app.delete("/api/notifications/job-alerts/:id", authenticateJWT, async (req, res) => {
    try {
      const filterId = parseInt(req.params.id);
      
      // Verify ownership before deleting
      const existingFilters = await storage.getJobAlertFilters(req.user.id);
      const ownedFilter = existingFilters.find(f => f.id === filterId);
      
      if (!ownedFilter) {
        return res.status(404).json({ error: "Job alert filter not found or access denied" });
      }

      await storage.deleteJobAlertFilter(filterId);
      res.json({ message: "Job alert filter deleted successfully" });
    } catch (error) {
      console.error("Delete job alert filter error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}