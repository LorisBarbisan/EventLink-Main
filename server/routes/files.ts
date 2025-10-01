import type { Express } from "express";
import { storage } from "../storage";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { authenticateJWT } from "./auth";
import { z } from "zod";
import { insertMessageAttachmentSchema } from "@shared/schema";

export function registerFileRoutes(app: Express) {
  // Upload CV - combined endpoint that receives base64 file data and uploads to storage
  app.post("/api/cv", authenticateJWT, async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'freelancer') {
        return res.status(403).json({ error: "Only freelancers can upload CVs" });
      }

      const { fileData, filename, fileSize, contentType } = req.body;

      if (!fileData || !filename || !contentType) {
        return res.status(400).json({ error: "File data, filename, and content type are required" });
      }

      // Generate object key with UUID for security
      const { randomUUID } = await import('crypto');
      const objectKey = `cvs/${req.user.id}/${randomUUID()}`;

      // Upload file to storage from backend (avoids CORS issues)
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      if (!privateDir) {
        throw new Error("PRIVATE_OBJECT_DIR not set");
      }

      const fullPath = `${privateDir}/${objectKey}`;
      
      // Parse the path to get bucket name and object name
      const pathParts = fullPath.startsWith("/") ? fullPath.split("/") : `/${fullPath}`.split("/");
      if (pathParts.length < 3) {
        throw new Error("Invalid storage path");
      }
      const bucketName = pathParts[1];
      const objectName = pathParts.slice(2).join("/");
      
      const { objectStorageClient } = await import('../objectStorage');
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Convert base64 to buffer and upload
      const buffer = Buffer.from(fileData, 'base64');
      console.log(`📤 Uploading CV to storage: bucket=${bucketName}, object=${objectName}, size=${buffer.length} bytes`);
      
      try {
        await file.save(buffer, {
          contentType,
          metadata: {
            contentType,
          },
        });
        console.log(`✅ CV uploaded to storage successfully: ${objectKey}`);
      } catch (uploadError) {
        console.error("❌ Object storage upload error:", uploadError);
        throw new Error("Failed to upload CV to storage");
      }

      // Update freelancer profile with CV information directly (no need to fetch first)
      const updatedProfile = await storage.updateFreelancerProfile(req.user.id, {
        cv_file_url: objectKey,
        cv_file_name: filename,
        cv_file_size: fileSize || null,
        cv_file_type: contentType || null
      });

      console.log(`✅ CV metadata saved for user ${req.user.id}: ${filename}`);
      res.json({
        message: "CV uploaded successfully",
        profile: updatedProfile
      });
    } catch (error) {
      console.error("❌ Save CV error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to save CV" });
    }
  });

  // Delete CV
  app.delete("/api/cv", authenticateJWT, async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'freelancer') {
        return res.status(403).json({ error: "Only freelancers can delete their CVs" });
      }

      // Get profile to find the CV file URL for deletion (but immediately clear it from cache)
      const profile = await storage.getFreelancerProfile(req.user.id);
      if (!profile || !profile.cv_file_url) {
        return res.status(404).json({ error: "No CV found to delete" });
      }

      // Delete from object storage
      try {
        await ObjectStorageService.deleteObject(profile.cv_file_url);
      } catch (deleteError) {
        console.error("Object storage delete error:", deleteError);
        // Continue with metadata cleanup even if object deletion fails
      }

      // Update profile to remove CV metadata
      const updatedProfile = await storage.updateFreelancerProfile(req.user.id, {
        cv_file_url: null,
        cv_file_name: null,
        cv_file_size: null,
        cv_file_type: null
      });

      res.json({
        message: "CV deleted successfully",
        profile: updatedProfile
      });
    } catch (error) {
      console.error("Delete CV error:", error);
      res.status(500).json({ error: "Failed to delete CV" });
    }
  });

  // Download CV
  app.get("/api/cv/download/:freelancerId", authenticateJWT, async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);

      // Check authorization - recruiters and admins can download, freelancers can download their own
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (req.user.role === 'freelancer' && req.user.id !== freelancerId) {
        return res.status(403).json({ error: "Not authorized to download this CV" });
      }

      const profile = await storage.getFreelancerProfile(freelancerId);
      if (!profile || !profile.cv_file_url) {
        return res.status(404).json({ error: "CV not found" });
      }

      try {
        // Get presigned download URL
        const downloadUrl = await ObjectStorageService.getDownloadUrl(profile.cv_file_url);
        
        // Return the download URL as JSON so frontend can handle the download
        res.json({ 
          downloadUrl,
          fileName: profile.cv_file_name || 'CV.pdf'
        });
      } catch (objectError) {
        if (objectError instanceof ObjectNotFoundError) {
          return res.status(404).json({ error: "CV file not found in storage" });
        }
        throw objectError;
      }
    } catch (error) {
      console.error("Download CV error:", error);
      res.status(500).json({ error: "Failed to download CV" });
    }
  });

  // Serve objects (DISABLED for security - use specific authenticated endpoints instead)
  // CVs must be downloaded through /api/cv/download/:freelancerId
  // Attachments must be downloaded through /api/attachments/:attachmentId/download
  app.get("/objects/:objectPath(*)", async (req, res) => {
    res.status(403).json({ 
      error: "Direct object access is not allowed. Use the appropriate authenticated endpoint." 
    });
  });

  // MESSAGE ATTACHMENTS

  // Get attachment upload URL
  app.post("/api/objects/upload", authenticateJWT, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Get upload URL error:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Create attachment after file upload
  app.post("/api/attachments/create", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { uploadURL, originalFilename, fileType, fileSize } = req.body;

      // Validate file type and size
      const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

      if (!ALLOWED_FILE_TYPES.includes(fileType)) {
        return res.status(400).json({ 
          error: "File type not allowed",
          allowed: ALLOWED_FILE_TYPES
        });
      }

      if (fileSize > MAX_FILE_SIZE) {
        return res.status(400).json({ error: "File size must be less than 5MB" });
      }

      // Normalize object path from upload URL
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      // Set ACL policy for the uploaded file
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, {
        owner: req.user.id.toString(),
        visibility: "private",
      });

      res.json({ 
        objectPath: normalizedPath,
        scanResult: { safe: true }, // Placeholder - would implement virus scanning
        moderationResult: { approved: true } // Placeholder - would implement content moderation
      });

    } catch (error) {
      console.error("Create attachment error:", error);
      res.status(500).json({ error: "Failed to process attachment" });
    }
  });

  // Add attachment to message
  app.post("/api/messages/:messageId/attachments", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const messageId = parseInt(req.params.messageId);
      
      if (Number.isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      // Verify user owns the message or is participant in conversation
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const conversations = await storage.getConversationsByUserId(req.user.id);
      const hasAccess = conversations.some(c => c.id === message.conversation_id);
      
      if (!hasAccess && message.sender_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Security: Enforce that attachment paths must start with /objects/uploads/
      const objectPath = req.body.objectPath;
      if (!objectPath || !objectPath.startsWith('/objects/uploads/')) {
        return res.status(400).json({ 
          error: "Invalid attachment path. Attachments must be in the uploads directory." 
        });
      }

      const attachmentData = {
        message_id: messageId,
        object_path: objectPath,
        original_filename: req.body.originalFilename,
        file_type: req.body.fileType,
        file_size: req.body.fileSize,
        scan_status: 'safe' as const,
        scan_result: JSON.stringify(req.body.scanResult || {}),
        moderation_status: 'approved' as const,
        moderation_result: JSON.stringify(req.body.moderationResult || {}),
      };

      const result = insertMessageAttachmentSchema.safeParse(attachmentData);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid attachment data",
          details: result.error.issues
        });
      }

      const attachment = await storage.createMessageAttachment(result.data);
      res.status(201).json(attachment);

    } catch (error) {
      console.error("Add attachment to message error:", error);
      res.status(500).json({ error: "Failed to add attachment" });
    }
  });

  // Get message attachments
  app.get("/api/messages/:messageId/attachments", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const messageId = parseInt(req.params.messageId);
      
      if (Number.isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      // Verify user has access to the message
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const conversations = await storage.getConversationsByUserId(req.user.id);
      const hasAccess = conversations.some(c => c.id === message.conversation_id);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const attachments = await storage.getMessageAttachments(messageId);
      res.json(attachments);

    } catch (error) {
      console.error("Get message attachments error:", error);
      res.status(500).json({ error: "Failed to get attachments" });
    }
  });

  // Download attachment (secure access)
  app.get("/api/attachments/:attachmentId/download", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const attachmentId = parseInt(req.params.attachmentId);
      
      if (Number.isNaN(attachmentId)) {
        return res.status(400).json({ error: "Invalid attachment ID" });
      }

      const attachment = await storage.getMessageAttachmentById(attachmentId);
      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      // Verify user has access to the attachment's message
      const message = await storage.getMessageById(attachment.message_id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const conversations = await storage.getConversationsByUserId(req.user.id);
      const hasAccess = conversations.some(c => c.id === message.conversation_id);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get the file from object storage and stream it
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(attachment.object_path);
      await objectStorageService.downloadObject(objectFile, res);

    } catch (error) {
      console.error("Download attachment error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download attachment" });
      }
    }
  });

  // Report attachment
  app.post("/api/attachments/:attachmentId/report", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const attachmentId = parseInt(req.params.attachmentId);
      
      if (Number.isNaN(attachmentId)) {
        return res.status(400).json({ error: "Invalid attachment ID" });
      }

      const { reason, details } = req.body;
      
      if (!['malware', 'inappropriate', 'harassment', 'other'].includes(reason)) {
        return res.status(400).json({ error: "Invalid report reason" });
      }

      const attachment = await storage.getMessageAttachmentById(attachmentId);
      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      const report = await storage.createFileReport({
        attachment_id: attachmentId,
        reporter_id: req.user.id,
        report_reason: reason,
        report_details: details || null,
      });

      res.status(201).json(report);

    } catch (error) {
      console.error("Report attachment error:", error);
      res.status(500).json({ error: "Failed to report attachment" });
    }
  });
}