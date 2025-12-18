import type { Express } from "express";
import {
  createConversation,
  deleteConversation,
  deleteMessage,
  getConversationMessages,
  getConversations,
  getUnreadMessageCount,
  markConversationMessagesAsRead,
  sendMessage,
  startConversation,
} from "../controllers/message.controller";
import { authenticateJWT } from "../middleware/auth.middleware";

export function registerMessagingRoutes(app: Express) {
  // Get all conversations for the current user
  app.get("/api/conversations", authenticateJWT, getConversations);

  // Get messages in a conversation
  app.get("/api/conversations/:id/messages", authenticateJWT, getConversationMessages);

  // Get or create a conversation with a specific user (without sending a message)
  app.post("/api/conversations/create", authenticateJWT, createConversation);

  // Start a new conversation
  app.post("/api/conversations", authenticateJWT, startConversation);

  // Send a message
  app.post("/api/messages", authenticateJWT, sendMessage);

  // Get unread message count
  app.get("/api/messages/unread-count", authenticateJWT, getUnreadMessageCount);

  // Delete message (soft delete from user's view only)
  app.delete("/api/messages/:messageId", authenticateJWT, deleteMessage);

  // Delete conversation
  app.delete("/api/conversations/:id", authenticateJWT, deleteConversation);

  // Mark conversation messages as read (used when conversation is open)
  app.patch("/api/conversations/:id/mark-read", authenticateJWT, markConversationMessagesAsRead);
}
