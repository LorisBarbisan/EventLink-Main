import {
    insertJobAlertFilterSchema,
    insertNotificationPreferencesSchema,
    insertNotificationSchema,
} from "@shared/schema";
import type { Request, Response } from "express";
import { storage } from "../../storage.js";

// Get user notifications
export async function getUserNotifications(req: Request, res: Response) {
  try {
    const notifications = await storage.getUserNotifications((req as any).user!.id);
    res.json(notifications);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get unread notification count
export async function getUnreadNotificationCount(req: Request, res: Response) {
  try {
    const unreadCount = await storage.getUnreadNotificationCount((req as any).user!.id);
    // CRITICAL: Set no-cache headers to prevent browser/HTTP caching of counts
    // Counts are real-time and should always be fresh
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.json({ count: unreadCount });
  } catch (error) {
    console.error("Get unread notification count error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get category-specific unread notification counts for tab badges
export async function getCategoryUnreadCounts(req: Request, res: Response) {
  try {
    const counts = await storage.getCategoryUnreadCounts((req as any).user!.id);
    // CRITICAL: Set no-cache headers to prevent browser/HTTP caching of counts
    // Counts are real-time and should always be fresh
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.json(counts);
  } catch (error) {
    console.error("Get category notification counts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Create notification (usually called internally)
export async function createNotification(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "admin") {
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
}

// Mark notification as read
export async function markNotificationAsRead(req: Request, res: Response) {
  try {
    const notificationId = parseInt(req.params.id);

    // Check if notification belongs to user
    const notification = await storage.getNotification(notificationId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (notification.user_id !== (req as any).user.id && (req as any).user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to mark this notification as read" });
    }

    await storage.markNotificationAsRead(notificationId);

    // Send WebSocket updates for badge counts and notification list
    try {
      const { wsService } = await import("../websocket/websocketService.js");
      const counts = await storage.getCategoryUnreadCounts((req as any).user.id);
      wsService.broadcastBadgeCounts((req as any).user.id, counts);

      // Fetch updated notification from database to send real data
      const updatedNotification = await storage.getNotification(notificationId);
      if (updatedNotification) {
        wsService.broadcastNotificationUpdated((req as any).user.id, updatedNotification);
      }
      console.log(
        `✅ Badge counts and notification update broadcast to user ${(req as any).user.id} after marking notification ${notificationId} as read`
      );
    } catch (wsError) {
      console.error("WebSocket broadcast error:", wsError);
      // Don't fail the request if WebSocket broadcast fails
    }

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(req: Request, res: Response) {
  try {
    await storage.markAllNotificationsAsRead((req as any).user.id);

    // Send WebSocket updates for badge counts and notification list
    try {
      const { wsService } = await import("../websocket/websocketService.js");
      const counts = await storage.getCategoryUnreadCounts((req as any).user.id);
      wsService.broadcastBadgeCounts((req as any).user.id, counts);

      // Fetch all updated notifications from database to send real data
      const updatedNotifications = await storage.getUserNotifications((req as any).user.id);
      wsService.broadcastAllNotificationsUpdated((req as any).user.id, updatedNotifications);
      console.log(
        `✅ Badge counts and all notifications update broadcast to user ${(req as any).user.id} after marking all notifications as read`
      );
    } catch (wsError) {
      console.error("WebSocket broadcast error:", wsError);
      // Don't fail the request if WebSocket broadcast fails
    }

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Mark category-specific notifications as read
export async function markCategoryNotificationsAsRead(req: Request, res: Response) {
  try {
    const category = req.params.category as
      | "messages"
      | "applications"
      | "jobs"
      | "ratings"
      | "feedback"
      | "contact_messages";

    if (
      !["messages", "applications", "jobs", "ratings", "feedback", "contact_messages"].includes(
        category
      )
    ) {
      return res.status(400).json({ error: "Invalid category" });
    }

    await storage.markCategoryNotificationsAsRead((req as any).user.id, category);

    // Send WebSocket update for badge counts
    try {
      const counts = await storage.getCategoryUnreadCounts((req as any).user.id);
      const broadcastToUser = (global as any).broadcastToUser;
      if (broadcastToUser) {
        broadcastToUser((req as any).user.id, {
          type: "badge_counts_update",
          counts: counts,
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
}

// Delete notification
export async function deleteNotification(req: Request, res: Response) {
  try {
    console.log("Deleting notification:", req.params.id);
    const notificationId = parseInt(req.params.id);

    // Check if notification belongs to user
    const notification = await storage.getNotification(notificationId);
    if (!notification) {
      console.log("Notification with id " + notificationId + " not found");
      return res.status(404).json({ error: "Notification not found" });
    }

    if (notification.user_id !== (req as any).user.id && (req as any).user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this notification" });
    }

    await storage.deleteNotification(notificationId);

    // Send WebSocket update for badge counts
    try {
      const counts = await storage.getCategoryUnreadCounts((req as any).user.id);
      const broadcastToUser = (global as any).broadcastToUser;
      if (broadcastToUser) {
        broadcastToUser((req as any).user.id, {
          type: "badge_counts_update",
          counts: counts,
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
}

// Get notification preferences
export async function getNotificationPreferences(req: Request, res: Response) {
  try {
    let preferences = await storage.getNotificationPreferences((req as any).user.id);

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await storage.createNotificationPreferences((req as any).user.id);
    }

    res.json(preferences);
  } catch (error) {
    console.error("Get notification preferences error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update notification preferences
export async function updateNotificationPreferences(req: Request, res: Response) {
  try {
    // Validate request body with Zod schema
    const validationResult = insertNotificationPreferencesSchema.partial().safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: validationResult.error.issues,
      });
    }

    // Get or create preferences first
    let preferences = await storage.getNotificationPreferences((req as any).user.id);
    if (!preferences) {
      preferences = await storage.createNotificationPreferences((req as any).user.id);
    }

    // Update with validated settings only (no user_id allowed in updates)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id, ...updateData } = validationResult.data;
    const updatedPreferences = await storage.updateNotificationPreferences(
      (req as any).user.id,
      updateData
    );
    res.json(updatedPreferences);
  } catch (error) {
    console.error("Update notification preferences error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get job alert filters (returns first active filter for user)
export async function getJobAlertFilters(req: Request, res: Response) {
  try {
    const filters = await storage.getJobAlertFilters((req as any).user.id);
    // Return the first active filter, or null if none exists
    res.json(filters.length > 0 ? filters[0] : null);
  } catch (error) {
    console.error("Get job alert filters error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Create or update job alert filter (upsert pattern)
export async function createOrUpdateJobAlertFilter(req: Request, res: Response) {
  try {
    // Validate request body with Zod schema
    const validationResult = insertJobAlertFilterSchema.partial().safeParse({
      ...req.body,
      user_id: (req as any).user.id, // Force user_id to authenticated user
    });

    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: validationResult.error.issues,
      });
    }

    // Check if user already has a filter
    const existingFilters = await storage.getJobAlertFilters((req as any).user.id);

    let filter;
    if (existingFilters.length > 0) {
      // Update existing filter
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { user_id, ...updateData } = validationResult.data;
      filter = await storage.updateJobAlertFilter(existingFilters[0].id, updateData);
    } else {
      // Create new filter
      filter = await storage.createJobAlertFilter({
        user_id: (req as any).user.id,
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
}

// Update job alert filter
export async function updateJobAlertFilter(req: Request, res: Response) {
  try {
    const filterId = parseInt(req.params.id);

    // Verify ownership before updating
    const existingFilters = await storage.getJobAlertFilters((req as any).user.id);
    const ownedFilter = existingFilters.find(f => f.id === filterId);

    if (!ownedFilter) {
      return res.status(404).json({ error: "Job alert filter not found or access denied" });
    }

    // Validate request body
    const validationResult = insertJobAlertFilterSchema.partial().safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: validationResult.error.issues,
      });
    }

    // Prevent user_id changes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id, ...updateData } = validationResult.data;
    const updatedFilter = await storage.updateJobAlertFilter(filterId, updateData);
    res.json(updatedFilter);
  } catch (error) {
    console.error("Update job alert filter error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Delete job alert filter
export async function deleteJobAlertFilter(req: Request, res: Response) {
  try {
    const filterId = parseInt(req.params.id);

    // Verify ownership before deleting
    const existingFilters = await storage.getJobAlertFilters((req as any).user.id);
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
}
