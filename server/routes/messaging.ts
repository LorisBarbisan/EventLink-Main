import type { Express } from "express";
import { storage } from "../storage";
import { insertMessageSchema } from "@shared/schema";

export function registerMessagingRoutes(app: Express) {
  // Get all conversations for the current user
  app.get("/api/conversations", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const conversations = await storage.getConversationsByUserId(req.user.id);
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get messages in a conversation
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const otherUserId = parseInt(req.params.id);
      
      // Get or create conversation between users
      const conversation = await storage.getOrCreateConversation(req.user.id, otherUserId);
      
      // Get messages for this conversation
      const messages = await storage.getConversationMessages(conversation.id);
      
      // Mark messages as read
      await storage.markMessagesAsRead(conversation.id, req.user.id);
      
      res.json(messages);
    } catch (error) {
      console.error("Get conversation messages error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Start a new conversation
  app.post("/api/conversations", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { recipient_id, message } = req.body;

      if (!recipient_id || !message) {
        return res.status(400).json({ error: "Recipient ID and message are required" });
      }

      // Check if recipient exists
      const recipient = await storage.getUser(recipient_id);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      // Create the initial message
      const messageData = {
        sender_id: req.user.id,
        recipient_id: recipient_id,
        content: message,
        read: false
      };

      const result = insertMessageSchema.safeParse(messageData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const newMessage = await storage.sendMessage(result.data);
      
      // Create notification for recipient
      await storage.createNotification({
        user_id: recipient_id,
        type: 'new_message',
        title: 'New Message',
        message: `You have a new message from ${req.user.first_name || req.user.email}`,
        data: { sender_id: req.user.id, message_id: newMessage.id }
      });

      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send a message
  app.post("/api/messages", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { recipient_id, content } = req.body;

      if (!recipient_id || !content) {
        return res.status(400).json({ error: "Recipient ID and content are required" });
      }

      // Check if recipient exists
      const recipient = await storage.getUser(recipient_id);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      const messageData = {
        sender_id: req.user.id,
        recipient_id: recipient_id,
        content: content,
        read: false
      };

      const result = insertMessageSchema.safeParse(messageData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const message = await storage.sendMessage(result.data);
      
      // Create notification for recipient
      await storage.createNotification({
        user_id: recipient_id,
        type: 'new_message',
        title: 'New Message',
        message: `You have a new message from ${req.user.first_name || req.user.email}`,
        data: { sender_id: req.user.id, message_id: message.id }
      });

      res.status(201).json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get unread message count
  app.get("/api/messages/unread-count", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const unreadCount = await storage.getUnreadMessageCount(req.user.id);
      res.json({ count: unreadCount });
    } catch (error) {
      console.error("Get unread message count error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}