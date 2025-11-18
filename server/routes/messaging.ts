import { conversations, insertMessageSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { emailService } from "../emailNotificationService";
import { db, storage } from "../storage";
import { authenticateJWT } from "./auth";

export function registerMessagingRoutes(app: Express) {
  // Get all conversations for the current user
  app.get("/api/conversations", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`📋 Fetching conversations for user ${req.user.id}`);
      const conversations = await storage.getConversationsByUserId(req.user.id);
      console.log(`✅ Found ${conversations.length} conversations for user ${req.user.id}`);
      res.set("Cache-Control", "no-store"); // Prevent caching
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

      // Get messages for this conversation (filtered by user's deletion timestamp)
      const messages = await storage.getConversationMessagesForUser(conversationId, req.user.id);

      // Mark messages as read
      await storage.markMessagesAsRead(conversationId, req.user.id);

      // Send WebSocket update for badge counts
      try {
        const counts = await storage.getCategoryUnreadCounts(req.user.id);
        const broadcastToUser = (global as any).broadcastToUser;
        if (broadcastToUser) {
          broadcastToUser(req.user.id, {
            type: "badge_counts_update",
            counts: counts,
          });
        }
      } catch (error) {
        console.error("Failed to broadcast badge counts after marking messages as read:", error);
      }

      // CRITICAL: Set no-cache headers to prevent browser/HTTP caching of messages
      // Messages are real-time and should always be fresh
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
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

      // Create the initial message
      const messageData = {
        conversation_id: conversation.id,
        sender_id: req.user.id,
        content: initialMessage,
        is_read: false,
        is_system_message: false,
      };

      const result = insertMessageSchema.safeParse(messageData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      const newMessage = await storage.sendMessage(result.data);

      // Create notification for recipient (only if not deleted)
      if (!(await storage.isUserDeleted(userTwoId))) {
        // Get sender's display name (company name for recruiters, name for freelancers)
        let senderDisplayName = req.user.email; // fallback

        try {
          if (req.user.role === "recruiter") {
            const recruiterProfile = await storage.getRecruiterProfile(req.user.id);
            senderDisplayName = recruiterProfile?.company_name || req.user.email;
          } else if (req.user.role === "freelancer") {
            const freelancerProfile = await storage.getFreelancerProfile(req.user.id);
            if (freelancerProfile?.first_name || freelancerProfile?.last_name) {
              const firstName = freelancerProfile.first_name || "";
              const lastName = freelancerProfile.last_name || "";
              senderDisplayName = `${firstName} ${lastName}`.trim() || req.user.email;
            }
          }
        } catch (profileError) {
          console.error("Error fetching sender profile for notification:", profileError);
          // Keep fallback to email
        }

        await storage.createNotification({
          user_id: userTwoId,
          type: "new_message",
          title: "New Message",
          message: `You have a new message from ${senderDisplayName}`,
          related_entity_type: "message",
          related_entity_id: newMessage.id,
          action_url: `/dashboard?tab=messages&conversation=${conversation.id}`,
          metadata: JSON.stringify({ sender_id: req.user.id, conversation_id: conversation.id }),
        });

        // Send email notification
        try {
          // Get recipient's profile for name
          let recipientDisplayName = recipient.email; // fallback
          if (recipient.role === "recruiter") {
            const recruiterProfile = await storage.getRecruiterProfile(userTwoId);
            // Priority: company_name → user's full name → email
            if (recruiterProfile?.company_name) {
              recipientDisplayName = recruiterProfile.company_name;
            } else if (recipient.first_name || recipient.last_name) {
              const firstName = recipient.first_name || "";
              const lastName = recipient.last_name || "";
              recipientDisplayName = `${firstName} ${lastName}`.trim() || recipient.email;
            }
          } else if (recipient.role === "freelancer") {
            const freelancerProfile = await storage.getFreelancerProfile(userTwoId);
            if (freelancerProfile?.first_name || freelancerProfile?.last_name) {
              const firstName = freelancerProfile.first_name || "";
              const lastName = freelancerProfile.last_name || "";
              recipientDisplayName = `${firstName} ${lastName}`.trim() || recipient.email;
            }
          }

          // Send email notification (non-blocking)
          emailService
            .sendMessageNotification({
              recipientId: userTwoId,
              recipientEmail: recipient.email,
              recipientName: recipientDisplayName,
              senderName: senderDisplayName,
              messagePreview: initialMessage.substring(0, 100),
              conversationId: conversation.id,
            })
            .catch(error => {
              console.error("Failed to send message notification email:", error);
              // Don't fail the request if email fails
            });
        } catch (error) {
          console.error("Error preparing message notification email:", error);
          // Don't fail the request if email preparation fails
        }
      }

      res.status(201).json({ id: conversation.id, message: newMessage });
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
        return res
          .status(400)
          .json({ error: "Conversation ID and either content or attachment are required" });
      }

      // Get conversation directly from database (not filtered) to handle deleted conversations
      // This allows sending messages even if sender deleted the conversation
      const conversationRecord = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversation_id))
        .limit(1);

      if (!conversationRecord[0]) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const convRecord = conversationRecord[0];

      // Verify user is a participant
      if (
        convRecord.participant_one_id !== req.user.id &&
        convRecord.participant_two_id !== req.user.id
      ) {
        return res.status(403).json({ error: "You are not a participant in this conversation" });
      }

      // Get the other participant's ID
      const recipientId =
        convRecord.participant_one_id === req.user.id
          ? convRecord.participant_two_id
          : convRecord.participant_one_id;

      // Get recipient user info
      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      // Create conversation object for compatibility with existing code
      const conversation = {
        id: convRecord.id,
        participant_one_id: convRecord.participant_one_id,
        participant_two_id: convRecord.participant_two_id,
        otherUser: recipient,
      };

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
        is_system_message: false,
      };

      const result = insertMessageSchema.safeParse(messageData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.issues });
      }

      // TIMING: Start measuring message save time
      const messageSaveStartTime = Date.now();
      const message = await storage.sendMessage(result.data);
      const messageSaveEndTime = Date.now();
      console.log(
        `⏱️ [Timing] Message saved in ${messageSaveEndTime - messageSaveStartTime}ms (ID: ${message.id})`
      );

      // OPTIMIZATION: Broadcast WebSocket events IMMEDIATELY after message save
      // This ensures instant delivery to receivers before any notification/profile fetching delays
      const broadcastStartTime = Date.now();
      try {
        const { wsService } = await import("../websocketService.js");
        // OPTIMIZATION: Use req.user directly instead of redundant database fetch
        // req.user already contains all needed sender data (id, email, role, first_name, last_name, company_name, deleted_at, etc.)
        // Type assertion needed because Express.User type is minimal, but computeUserRole returns full user object
        const sender = req.user as typeof req.user & {
          first_name?: string | null;
          last_name?: string | null;
          company_name?: string | null;
          deleted_at?: string | Date | null;
        };

        // Broadcast to RECIPIENT (if not deleted) for instant UI update
        if (conversation.otherUser && !(await storage.isUserDeleted(conversation.otherUser.id))) {
          // Broadcast new_message event with full data (works for both MessagingInterface and LiveNotificationPopups)
          wsService.broadcastNewMessage(
            conversation.otherUser.id,
            message,
            sender,
            conversation_id
          );

          // Broadcast conversation update in case it was restored after deletion
          wsService.broadcastConversationUpdated(conversation.otherUser.id, conversation_id);

          console.log(
            `✅ [WebSocket] Broadcasts sent to recipient ${conversation.otherUser.id} (message ID: ${message.id})`
          );
        }

        // Broadcast to SENDER for instant UI update (so they see their message immediately)
        wsService.broadcastNewMessage(req.user.id, message, sender, conversation_id);

        // Broadcast conversation update to sender as well
        wsService.broadcastConversationUpdated(req.user.id, conversation_id);

        const broadcastEndTime = Date.now();
        console.log(
          `⏱️ [Timing] WebSocket broadcasts completed in ${broadcastEndTime - broadcastStartTime}ms (message ID: ${message.id})`
        );
        console.log(
          `✅ [WebSocket] Broadcasts sent to sender ${req.user.id} (message ID: ${message.id})`
        );
      } catch (error) {
        console.error("Failed to broadcast WebSocket events:", error);
        // Don't fail the request if WebSocket broadcast fails
      }

      // Create file attachment if provided
      if (attachment) {
        await storage.createMessageAttachment({
          message_id: message.id,
          object_path: attachment.path,
          original_filename: attachment.name,
          file_type: attachment.type,
          file_size: attachment.size,
          scan_status: "pending" as const,
          moderation_status: "pending" as const,
        });
      }

      // Create notification for other participant in conversation (only if recipient is not deleted)
      // NOTE: This happens AFTER WebSocket broadcast to ensure instant message delivery
      if (conversation.otherUser && !(await storage.isUserDeleted(conversation.otherUser.id))) {
        const notificationStartTime = Date.now();
        // Get sender's display name (company name for recruiters, name for freelancers)
        let senderDisplayName = req.user.email; // fallback

        try {
          if (req.user.role === "recruiter") {
            const recruiterProfile = await storage.getRecruiterProfile(req.user.id);
            senderDisplayName = recruiterProfile?.company_name || req.user.email;
          } else if (req.user.role === "freelancer") {
            const freelancerProfile = await storage.getFreelancerProfile(req.user.id);
            if (freelancerProfile?.first_name || freelancerProfile?.last_name) {
              const firstName = freelancerProfile.first_name || "";
              const lastName = freelancerProfile.last_name || "";
              senderDisplayName = `${firstName} ${lastName}`.trim() || req.user.email;
            }
          }
        } catch (profileError) {
          console.error("Error fetching sender profile for notification:", profileError);
          // Keep fallback to email
        }

        await storage.createNotification({
          user_id: conversation.otherUser.id,
          type: "new_message",
          title: "New Message",
          message: `You have a new message from ${senderDisplayName}`,
          related_entity_type: "message",
          related_entity_id: message.id,
          action_url: `/dashboard?tab=messages&conversation=${conversation_id}`,
          metadata: JSON.stringify({ sender_id: req.user.id, conversation_id: conversation_id }),
        });

        // NOTE: Badge counts are automatically broadcast by storage.createNotification()
        // No need to broadcast again here to avoid duplicate updates

        const notificationEndTime = Date.now();
        console.log(
          `⏱️ [Timing] Notification created in ${notificationEndTime - notificationStartTime}ms (message ID: ${message.id})`
        );

        // Send email notification
        try {
          // Get recipient user data
          const recipient = await storage.getUser(conversation.otherUser.id);
          if (recipient) {
            // Get recipient's profile for name
            let recipientDisplayName = recipient.email; // fallback
            if (recipient.role === "recruiter") {
              const recruiterProfile = await storage.getRecruiterProfile(conversation.otherUser.id);
              // Priority: company_name → user's full name → email
              if (recruiterProfile?.company_name) {
                recipientDisplayName = recruiterProfile.company_name;
              } else if (recipient.first_name || recipient.last_name) {
                const firstName = recipient.first_name || "";
                const lastName = recipient.last_name || "";
                recipientDisplayName = `${firstName} ${lastName}`.trim() || recipient.email;
              }
            } else if (recipient.role === "freelancer") {
              const freelancerProfile = await storage.getFreelancerProfile(
                conversation.otherUser.id
              );
              if (freelancerProfile?.first_name || freelancerProfile?.last_name) {
                const firstName = freelancerProfile.first_name || "";
                const lastName = freelancerProfile.last_name || "";
                recipientDisplayName = `${firstName} ${lastName}`.trim() || recipient.email;
              }
            }

            // Send email notification (non-blocking)
            emailService
              .sendMessageNotification({
                recipientId: conversation.otherUser.id,
                recipientEmail: recipient.email,
                recipientName: recipientDisplayName,
                senderName: senderDisplayName,
                messagePreview: content ? content.substring(0, 100) : "[Attachment]",
                conversationId: conversation_id,
              })
              .catch(error => {
                console.error("Failed to send message notification email:", error);
                // Don't fail the request if email fails
              });
          }
        } catch (error) {
          console.error("Error preparing message notification email:", error);
          // Don't fail the request if email preparation fails
        }
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

      res.set("Cache-Control", "no-store");
      res.json({
        success: true,
        messageId: messageId,
        message: "Message deleted from your view successfully",
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

      // Get the other participant's ID before deletion
      const otherParticipantId = conversation.otherUser.id;

      // Soft delete the conversation for this user
      await storage.deleteConversation(conversationId, req.user.id);

      // Broadcast deletion event to the other participant so their UI updates
      try {
        const { wsService } = await import("../websocketService.js");
        wsService.broadcastConversationDeleted(otherParticipantId, conversationId);
        console.log(`✅ Conversation deletion broadcast sent to user ${otherParticipantId}`);
      } catch (error) {
        console.error("Failed to broadcast conversation deletion:", error);
        // Don't fail the request if WebSocket broadcast fails
      }

      res.set("Cache-Control", "no-store");
      res.json({
        success: true,
        conversationId: conversationId,
        message: "Conversation deleted successfully",
      });
    } catch (error) {
      console.error("Delete conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
