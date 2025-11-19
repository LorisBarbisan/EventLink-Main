/**
 * WebSocket Service - Handles WebSocket broadcast operations
 * Separated from storage layer to maintain separation of concerns
 */

export class WebSocketService {
  private broadcastToUser: ((userId: number, data: any) => void) | null = null;

  /**
   * Initialize the WebSocket service with the broadcast function
   * This should be called once when the WebSocket server is set up
   */
  initialize(broadcastFn: (userId: number, data: any) => void) {
    this.broadcastToUser = broadcastFn;
  }

  /**
   * Broadcast a notification to a specific user
   */
  broadcastNotification(userId: number, notification: any) {
    try {
      if (this.broadcastToUser) {
        this.broadcastToUser(userId, {
          type: "new_notification",
          notification,
        });
      } else {
        console.warn("WebSocket broadcast function not initialized");
      }
    } catch (error) {
      console.error("Failed to broadcast notification:", error);
      throw error; // Rethrow so caller knows broadcast failed
    }
  }

  /**
   * Broadcast badge count updates to a specific user
   */
  broadcastBadgeCounts(userId: number, counts: any) {
    try {
      if (this.broadcastToUser) {
        this.broadcastToUser(userId, {
          type: "badge_counts_update",
          counts,
        });
      } else {
        console.warn("WebSocket broadcast function not initialized");
      }
    } catch (error) {
      console.error("Failed to broadcast badge counts:", error);
      throw error;
    }
  }

  /**
   * Broadcast a new message event to a specific user
   * Sends both new_message (for MessagingInterface refetch) and new_message (for LiveNotificationPopups toast)
   */
  broadcastNewMessage(userId: number, message: any, sender: any, conversationId: number) {
    try {
      if (this.broadcastToUser) {
        // Send new_message event with full data for toast and refetch
        this.broadcastToUser(userId, {
          type: "new_message",
          message: message,
          sender: sender,
          conversation_id: conversationId,
        });
      } else {
        console.warn("WebSocket broadcast function not initialized");
      }
    } catch (error) {
      console.error("Failed to broadcast new message:", error);
      throw error;
    }
  }

  /**
   * Broadcast a conversation deletion event to a specific user
   * Notifies the user that a conversation was deleted so they can refresh their list
   */
  broadcastConversationDeleted(userId: number, conversationId: number) {
    try {
      if (this.broadcastToUser) {
        this.broadcastToUser(userId, {
          type: "conversation_deleted",
          conversation_id: conversationId,
        });
      } else {
        console.warn("WebSocket broadcast function not initialized");
      }
    } catch (error) {
      console.error("Failed to broadcast conversation deletion:", error);
      throw error;
    }
  }

  /**
   * Broadcast a conversation update event to a specific user
   * Notifies the user that a conversation was updated (e.g., restored after deletion) so they can refresh their list
   */
  broadcastConversationUpdated(userId: number, conversationId: number) {
    try {
      if (this.broadcastToUser) {
        this.broadcastToUser(userId, {
          type: "conversation_updated",
          conversation_id: conversationId,
        });
      } else {
        console.warn("WebSocket broadcast function not initialized");
      }
    } catch (error) {
      console.error("Failed to broadcast conversation update:", error);
      throw error;
    }
  }

  /**
   * Broadcast a notification update event to a specific user
   * Sends the full updated notification object from database for real-time updates
   */
  broadcastNotificationUpdated(userId: number, updatedNotification: any) {
    try {
      if (this.broadcastToUser) {
        this.broadcastToUser(userId, {
          type: "notification_updated",
          notification: updatedNotification,
        });
      } else {
        console.warn("WebSocket broadcast function not initialized");
      }
    } catch (error) {
      console.error("Failed to broadcast notification update:", error);
      throw error;
    }
  }

  /**
   * Broadcast that all notifications were updated for a specific user
   * Sends the full updated notifications array from database for real-time updates
   */
  broadcastAllNotificationsUpdated(userId: number, updatedNotifications: any[]) {
    try {
      if (this.broadcastToUser) {
        this.broadcastToUser(userId, {
          type: "all_notifications_updated",
          notifications: updatedNotifications,
        });
      } else {
        console.warn("WebSocket broadcast function not initialized");
      }
    } catch (error) {
      console.error("Failed to broadcast all notifications update:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
