import { insertMessageAttachmentSchema } from "@shared/schema";
import type { Request, Response } from "express";
import { cvParserService } from "../services/cv-parser.service";
import { storage } from "../../storage";
import { ObjectNotFoundError, ObjectStorageService } from "../utils/object-storage";
import { isLocalPath, saveLocally, deleteLocally, readLocally } from "../utils/local-storage-fallback";

// Upload CV - combined endpoint that receives base64 file data and uploads to storage
export async function uploadCV(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "freelancer") {
      return res.status(403).json({ error: "Only freelancers can upload CVs" });
    }

    const { fileData, filename, fileSize, contentType } = req.body;

    if (!fileData || !filename || !contentType) {
      return res.status(400).json({ error: "File data, filename, and content type are required" });
    }

    // Generate object key with UUID for security
    const { randomUUID } = await import("crypto");
    const objectKey = `cvs/${(req as any).user.id}/${randomUUID()}`;

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, "base64");
    console.log(`📤 Uploading CV: objectKey=${objectKey}, size=${buffer.length} bytes`);

    // Try object storage first; fall back to local disk if unavailable
    let storedPath: string = objectKey;
    try {
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");

      const signedPutUrl = await ObjectStorageService.getUploadUrl(objectKey, contentType);
      const uploadResponse = await fetch(signedPutUrl, {
        method: "PUT",
        body: buffer,
        headers: { "Content-Type": contentType },
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text().catch(() => "");
        throw new Error(`Signed URL upload failed: ${uploadResponse.status} ${errText}`);
      }

      console.log(`✅ CV uploaded to object storage: ${objectKey}`);
    } catch (uploadError: any) {
      console.warn(`⚠️  Object storage unavailable (${uploadError?.message}), falling back to local disk`);
      storedPath = await saveLocally(objectKey, buffer);
      console.log(`✅ CV saved locally: ${storedPath}`);
    }

    // Update freelancer profile with CV information directly (no need to fetch first)
    const updatedProfile = await storage.updateFreelancerProfile((req as any).user.id, {
      cv_file_url: storedPath,
      cv_file_name: filename,
      cv_file_size: fileSize || null,
      cv_file_type: contentType || null,
    });

    console.log(`✅ CV metadata saved for user ${(req as any).user.id}: ${filename}`);

    // Set parsing status to "parsing" BEFORE sending response so frontend polling finds it immediately
    const userId = (req as any).user.id;
    await cvParserService.initParsingStatus(userId, storedPath);

    // Send response immediately, then start parsing in background
    res.json({
      message: "CV uploaded successfully",
      profile: updatedProfile,
      parsingStarted: true,
    });

    // Trigger CV parsing in the background (async, non-blocking)
    cvParserService.parseCV(userId, storedPath, contentType).catch(err => {
      console.error(`Background CV parsing failed for user ${userId}:`, err);
    });
  } catch (error) {
    console.error("❌ Save CV error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to save CV" });
  }
}

// Delete CV
export async function deleteCV(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "freelancer") {
      return res.status(403).json({ error: "Only freelancers can delete their CVs" });
    }

    // Get profile to find the CV file URL for deletion (but immediately clear it from cache)
    const profile = await storage.getFreelancerProfile((req as any).user.id);
    if (!profile || !profile.cv_file_url) {
      return res.status(404).json({ error: "No CV found to delete" });
    }

    // Delete file — handle both local disk and object storage paths
    try {
      if (isLocalPath(profile.cv_file_url)) {
        await deleteLocally(profile.cv_file_url);
      } else {
        await ObjectStorageService.deleteObject(profile.cv_file_url);
      }
    } catch (deleteError) {
      console.error("CV file delete error:", deleteError);
      // Continue with metadata cleanup even if file deletion fails
    }

    // Update profile to remove CV metadata
    const updatedProfile = await storage.updateFreelancerProfile((req as any).user.id, {
      cv_file_url: null,
      cv_file_name: null,
      cv_file_size: null,
      cv_file_type: null,
    });

    // Delete any CV parsed data
    try {
      await storage.deleteCvParsedData((req as any).user.id);
    } catch (err) {
      console.log("No CV parsed data to delete or error:", err);
    }

    res.json({
      message: "CV deleted successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Delete CV error:", error);
    res.status(500).json({ error: "Failed to delete CV" });
  }
}

// Download CV
const EVENTLINK_PROMOTIONAL_EMAIL = "eventlink@eventlink.one";

export async function downloadCV(req: Request, res: Response) {
  try {
    const freelancerId = parseInt(req.params.freelancerId);

    // Get profile first to check if it's the promotional account
    const profile = await storage.getFreelancerProfile(freelancerId);
    if (!profile || !profile.cv_file_url) {
      return res.status(404).json({ error: "CV not found" });
    }

    // Check if this is the promotional account (allow public access)
    const user = await storage.getUser(freelancerId);
    const isPromotionalAccount = user?.email?.toLowerCase() === EVENTLINK_PROMOTIONAL_EMAIL;

    // Check authorization: promotional account is public; others need JWT auth OR valid ?pt= token
    if (!isPromotionalAccount) {
      const requestingUser = (req as any).user;
      const publicToken = req.query.pt as string | undefined;

      if (!requestingUser) {
        if (!publicToken || !profile.reference_token || profile.reference_token !== publicToken) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        // Valid public token — allow access
      } else if (requestingUser.role === "freelancer" && requestingUser.id !== freelancerId) {
        return res.status(403).json({ error: "Not authorized to download this CV" });
      }
    }

    console.log(`📥 Download request for CV: ${profile.cv_file_url}`);

    try {
      const fileName = profile.cv_file_name || "CV.pdf";
      const contentType = profile.cv_file_type || "application/pdf";

      res.set({
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      });

      if (isLocalPath(profile.cv_file_url)) {
        // Local disk fallback (development)
        const buffer = await readLocally(profile.cv_file_url);
        res.send(buffer);
        console.log(`✅ Served CV from local disk for freelancer ${freelancerId}: ${fileName}`);
      } else {
        // Object storage via signed GET URL
        const signedGetUrl = await ObjectStorageService.getDownloadUrl(profile.cv_file_url);
        const storageRes = await fetch(signedGetUrl);

        if (!storageRes.ok) {
          if (storageRes.status === 404) {
            return res.status(404).json({ error: "CV file not found in storage" });
          }
          throw new Error(`Storage fetch failed: ${storageRes.status}`);
        }

        const { Readable } = await import("stream");
        const nodeStream = Readable.fromWeb(storageRes.body as any);
        nodeStream.on("error", (err: Error) => {
          console.error(`❌ Stream error for CV ${profile.cv_file_url}:`, err);
          if (!res.headersSent) res.status(500).json({ error: "Error streaming CV file" });
        });
        nodeStream.pipe(res);
        console.log(`✅ Streaming CV from object storage for freelancer ${freelancerId}: ${fileName}`);
      }
    } catch (objectError) {
      console.error(`❌ Failed to serve CV for ${profile.cv_file_url}:`, objectError);
      throw objectError;
    }
  } catch (error) {
    console.error("Download CV error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download CV" });
    }
  }
}

// Serve objects (DISABLED for security - use specific authenticated endpoints instead)
export async function getObjectAccess(req: Request, res: Response) {
  res.status(403).json({
    error: "Direct object access is not allowed. Use the appropriate authenticated endpoint.",
  });
}

// Get attachment upload URL
export async function getUploadURL(req: Request, res: Response) {
  try {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  } catch (error) {
    console.error("Get upload URL error:", error);
    res.status(500).json({ error: "Failed to get upload URL" });
  }
}

// Create attachment after file upload
export async function createAttachment(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { uploadURL, fileType, fileSize } = req.body;

    // Validate file type and size
    const ALLOWED_FILE_TYPES = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    if (!ALLOWED_FILE_TYPES.includes(fileType)) {
      return res.status(400).json({
        error: "File type not allowed",
        allowed: ALLOWED_FILE_TYPES,
      });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ error: "File size must be less than 5MB" });
    }

    // Normalize object path from upload URL
    const objectStorageService = new ObjectStorageService();

    // Set ACL policy for the uploaded file
    const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, {
      owner: (req as any).user.id.toString(),
      visibility: "private",
    });

    res.json({
      objectPath: normalizedPath,
      scanResult: { safe: true }, // Placeholder - would implement virus scanning
      moderationResult: { approved: true }, // Placeholder - would implement content moderation
    });
  } catch (error) {
    console.error("Create attachment error:", error);
    res.status(500).json({ error: "Failed to process attachment" });
  }
}

// Add attachment to message
export async function addAttachmentToMessage(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
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

    const conversations = await storage.getConversationsByUserId((req as any).user.id);
    const hasAccess = conversations.some(c => c.id === message.conversation_id);

    if (!hasAccess && message.sender_id !== (req as any).user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Security: Enforce that attachment paths must start with /objects/uploads/
    const objectPath = req.body.objectPath;
    if (!objectPath || !objectPath.startsWith("/objects/uploads/")) {
      return res.status(400).json({
        error: "Invalid attachment path. Attachments must be in the uploads directory.",
      });
    }

    const attachmentData = {
      message_id: messageId,
      object_path: objectPath,
      original_filename: req.body.originalFilename,
      file_type: req.body.fileType,
      file_size: req.body.fileSize,
      scan_status: "safe" as const,
      scan_result: JSON.stringify(req.body.scanResult || {}),
      moderation_status: "approved" as const,
      moderation_result: JSON.stringify(req.body.moderationResult || {}),
    };

    const result = insertMessageAttachmentSchema.safeParse(attachmentData);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid attachment data",
        details: result.error.issues,
      });
    }

    const attachment = await storage.createMessageAttachment(result.data);
    res.status(201).json(attachment);
  } catch (error) {
    console.error("Add attachment to message error:", error);
    res.status(500).json({ error: "Failed to add attachment" });
  }
}

// Get message attachments
export async function getMessageAttachments(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
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

    const conversations = await storage.getConversationsByUserId((req as any).user.id);
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
}

// Download attachment (secure access)
export async function downloadAttachment(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
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

    const conversations = await storage.getConversationsByUserId((req as any).user.id);
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
}

// Report attachment
export async function reportAttachment(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const attachmentId = parseInt(req.params.attachmentId);

    if (Number.isNaN(attachmentId)) {
      return res.status(400).json({ error: "Invalid attachment ID" });
    }

    const { reason, details } = req.body;

    if (!["malware", "inappropriate", "harassment", "other"].includes(reason)) {
      return res.status(400).json({ error: "Invalid report reason" });
    }

    const attachment = await storage.getMessageAttachmentById(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const report = await storage.createFileReport({
      attachment_id: attachmentId,
      reporter_id: (req as any).user.id,
      report_reason: reason,
      report_details: details || null,
    });

    res.status(201).json(report);
  } catch (error) {
    console.error("Report attachment error:", error);
    res.status(500).json({ error: "Failed to report attachment" });
  }
}
