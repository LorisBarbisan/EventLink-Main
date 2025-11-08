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
          type: 'new_notification',
          notification
        });
      } else {
        console.warn('WebSocket broadcast function not initialized');
      }
    } catch (error) {
      console.error('Failed to broadcast notification:', error);
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
          type: 'badge_counts_update',
          counts
        });
      } else {
        console.warn('WebSocket broadcast function not initialized');
      }
    } catch (error) {
      console.error('Failed to broadcast badge counts:', error);
      throw error;
    }
  }

  /**
   * Broadcast a new message event to a specific user
   */
  broadcastNewMessage(userId: number, conversationId: number) {
    try {
      if (this.broadcastToUser) {
        this.broadcastToUser(userId, {
          type: 'NEW_MESSAGE',
          conversation_id: conversationId
        });
      } else {
        console.warn('WebSocket broadcast function not initialized');
      }
    } catch (error) {
      console.error('Failed to broadcast new message:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
