import type { Express } from "express";
import { storage } from "../storage";
import { insertMessageSchema } from "@shared/schema";
import { authenticateJWT } from "./auth";

export function registerMessagingRoutes(app: Express) {
  // Get all conversations for the current user
  app.get("/api/conversations", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`🔵 GET /api/conversations for user ${req.user.id}`);
      const conversations = await storage.getConversationsByUserId(req.user.id);
      console.log(`🔵 Returning ${conversations.length} conversations for user ${req.user.id}`);
      if (conversations.length > 0) {
        console.log(`🔵 First conversation:`, JSON.stringify(conversations[0], null, 2));
      }
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get messages in a conversation
  app.get("/api/conversations/:id/messages", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const conversationId = parseInt(req.params.id);
      
      // First verify that the user is a participant in this conversation
      const userConversations = await storage.getConversationsByUserId(req.user.id);
      const isParticipant = userConversations.some(conv => conv.id === conversationId);
      
      if (!isParticipant) {
        return res.status(403).json({ error: "You are not a participant in this conversation" });
      }
      
      // Get messages for this conversation
      const messages = await storage.getConversationMessages(conversationId);
      
      // Mark messages as read
      await storage.markMessagesAsRead(conversationId, req.user.id);
      
      res.json(messages);
    } catch (error) {
      console.error("Get conversation messages error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get or create a conversation with a specific user (without sending a message)
  app.post("/api/conversations/create", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { recipientId } = req.body;

      if (!recipientId) {
        return res.status(400).json({ error: "Recipient ID is required" });
      }

      // Check if recipient exists
      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      // Get or create conversation
      const conversation = await storage.getOrCreateConversation(req.user.id, recipientId);
      
      res.status(200).json({ id: conversation.id });
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Start a new conversation
  app.post("/api/conversations", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { userTwoId, initialMessage } = req.body;
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`💬 Creating conversation: user ${req.user.id} -> user ${userTwoId}`);
      }

      if (!userTwoId || !initialMessage) {
        return res.status(400).json({ error: "User ID and initial message are required" });
      }

      // Check if recipient exists
      const recipient = await storage.getUser(userTwoId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      // Check if messaging to deleted user is allowed
      const validation = await storage.canSendMessageToUser(req.user.id, userTwoId);
      if (!validation.canSend) {
        return res.status(403).json({ error: validation.error });
      }

      // Get or create conversation
      const conversation = await storage.getOrCreateConversation(req.user.id, userTwoId);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ Conversation ${conversation.id} ready`);
      }

      // Create the initial message
      const messageData = {
        conversation_id: conversation.id,
        sender_id: req.user.id,
        content: initialMessage,
        is_read: false,
        is_system_message: false
      };

      const result = insertMessageSchema.safeParse(messageData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const newMessage = await storage.sendMessage(result.data);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ Message ${newMessage.id} sent in conversation ${conversation.id}`);
      }
      
      // Create notification for recipient (only if not deleted)
      if (!await storage.isUserDeleted(userTwoId)) {
        // Get sender's display name (company name for recruiters, name for freelancers)
        let senderDisplayName = req.user.email; // fallback
        console.log(`📨 Getting display name for ${req.user.role} user ${req.user.id}`);
        
        try {
          if (req.user.role === 'recruiter') {
            const recruiterProfile = await storage.getRecruiterProfile(req.user.id);
            console.log('Recruiter profile:', recruiterProfile);
            senderDisplayName = recruiterProfile?.company_name || req.user.email;
            console.log(`✅ Recruiter display name: ${senderDisplayName}`);
          } else if (req.user.role === 'freelancer') {
            const freelancerProfile = await storage.getFreelancerProfile(req.user.id);
            console.log('Freelancer profile:', freelancerProfile);
            if (freelancerProfile?.first_name || freelancerProfile?.last_name) {
              const firstName = freelancerProfile.first_name || '';
              const lastName = freelancerProfile.last_name || '';
              senderDisplayName = `${firstName} ${lastName}`.trim() || req.user.email;
            }
            console.log(`✅ Freelancer display name: ${senderDisplayName}`);
          }
        } catch (profileError) {
          console.error("❌ Error fetching sender profile for notification:", profileError);
          // Keep fallback to email
        }
        
        console.log(`📬 Creating notification with sender name: ${senderDisplayName}`);
        await storage.createNotification({
          user_id: userTwoId,
          type: 'new_message',
          title: 'New Message',
          message: `You have a new message from ${senderDisplayName}`,
          related_entity_type: 'message',
          related_entity_id: newMessage.id,
          action_url: `/dashboard?tab=messages&recipientId=${req.user.id}`,
          metadata: JSON.stringify({ sender_id: req.user.id, conversation_id: conversation.id })
        });
        
        if (process.env.NODE_ENV !== 'production') {
          console.log(`🔔 Notification sent to user ${userTwoId}`);
        }
      }

      res.status(201).json({ id: conversation.id, message: newMessage });
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📤 Response sent: conversation ${conversation.id}`);
      }
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send a message
  app.post("/api/messages", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { conversation_id, content, attachment } = req.body;

      if (!conversation_id || (!content && !attachment)) {
        return res.status(400).json({ error: "Conversation ID and either content or attachment are required" });
      }

      // Get conversation to find the recipient
      const conversations = await storage.getConversationsByUserId(req.user.id);
      const conversation = conversations.find(c => c.id === conversation_id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Check if messaging to deleted user is allowed
      const validation = await storage.canSendMessageToUser(req.user.id, conversation.otherUser.id);
      if (!validation.canSend) {
        return res.status(403).json({ error: validation.error });
      }

      const messageData = {
        conversation_id: conversation_id,
        sender_id: req.user.id,
        content: content,
        is_read: false,
        is_system_message: false
      };

      const result = insertMessageSchema.safeParse(messageData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const message = await storage.sendMessage(result.data);
      
      // Create file attachment if provided
      if (attachment) {
        await storage.createMessageAttachment({
          message_id: message.id,
          object_path: attachment.path,
          original_filename: attachment.name,
          file_type: attachment.type,
          file_size: attachment.size,
          scan_status: 'pending' as const,
          moderation_status: 'pending' as const
        });
      }
      
      // Create notification for other participant in conversation (only if recipient is not deleted)
      if (conversation.otherUser && !await storage.isUserDeleted(conversation.otherUser.id)) {
        // Get sender's display name (company name for recruiters, name for freelancers)
        let senderDisplayName = req.user.email; // fallback
        console.log(`📨 Getting display name for ${req.user.role} user ${req.user.id}`);
        
        try {
          if (req.user.role === 'recruiter') {
            const recruiterProfile = await storage.getRecruiterProfile(req.user.id);
            console.log('Recruiter profile:', recruiterProfile);
            senderDisplayName = recruiterProfile?.company_name || req.user.email;
            console.log(`✅ Recruiter display name: ${senderDisplayName}`);
          } else if (req.user.role === 'freelancer') {
            const freelancerProfile = await storage.getFreelancerProfile(req.user.id);
            console.log('Freelancer profile:', freelancerProfile);
            if (freelancerProfile?.first_name || freelancerProfile?.last_name) {
              const firstName = freelancerProfile.first_name || '';
              const lastName = freelancerProfile.last_name || '';
              senderDisplayName = `${firstName} ${lastName}`.trim() || req.user.email;
            }
            console.log(`✅ Freelancer display name: ${senderDisplayName}`);
          }
        } catch (profileError) {
          console.error("❌ Error fetching sender profile for notification:", profileError);
          // Keep fallback to email
        }
        
        console.log(`📬 Creating notification with sender name: ${senderDisplayName}`);
        await storage.createNotification({
          user_id: conversation.otherUser.id,
          type: 'new_message',
          title: 'New Message',
          message: `You have a new message from ${senderDisplayName}`,
          related_entity_type: 'message',
          related_entity_id: message.id,
          action_url: `/dashboard?tab=messages&recipientId=${req.user.id}`,
          metadata: JSON.stringify({ sender_id: req.user.id, conversation_id: conversation_id })
        });
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get unread message count
  app.get("/api/messages/unread-count", authenticateJWT, async (req, res) => {
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

  // Delete message (soft delete from user's view only)
  app.delete("/api/messages/:messageId", authenticateJWT, async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      
      if (Number.isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }
      
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get user's conversations to verify access
      const conversations = await storage.getConversationsByUserId(req.user.id);
      
      // Check if user has access to delete this message by checking their conversations
      let hasAccess = false;
      for (const conversation of conversations) {
        const messages = await storage.getConversationMessages(conversation.id);
        const targetMessage = messages.find(m => m.id === messageId);
        if (targetMessage) {
          hasAccess = true;
          break;
        }
      }
      
      if (!hasAccess) {
        return res.status(404).json({ error: "Message not found or access denied" });
      }

      // Mark message as deleted for this user only
      await storage.markMessageDeletedForUser(messageId, req.user.id);
      
      res.set('Cache-Control', 'no-store');
      res.json({ 
        success: true, 
        messageId: messageId,
        message: "Message deleted from your view successfully"
      });
    } catch (error) {
      console.error("Delete message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", authenticateJWT, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      
      if (Number.isNaN(conversationId)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }
      
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Verify that the user is a participant in this conversation
      const userConversations = await storage.getConversationsByUserId(req.user.id);
      const conversation = userConversations.find(conv => conv.id === conversationId);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found or access denied" });
      }

      // Soft delete the conversation for this user
      await storage.deleteConversation(conversationId, req.user.id);
      
      res.set('Cache-Control', 'no-store');
      res.json({ 
        success: true, 
        conversationId: conversationId,
        message: "Conversation deleted successfully"
      });
    } catch (error) {
      console.error("Delete conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}