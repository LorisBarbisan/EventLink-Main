import type { Express } from "express";
import {
  addAttachmentToMessage,
  createAttachment,
  deleteCV,
  downloadAttachment,
  downloadCV,
  getMessageAttachments,
  getObjectAccess,
  getUploadURL,
  reportAttachment,
  uploadCV,
} from "../controllers/file.controller";
import {
  confirmDocumentUpload,
  deleteDocument,
  downloadDocument,
  getDocuments,
  getDocumentTypes,
  getDocumentUploadUrl,
} from "../controllers/document.controller";
import { authenticateJWT } from "../middleware/auth.middleware";

export function registerFileRoutes(app: Express) {
  // Upload CV - combined endpoint that receives base64 file data and uploads to storage
  app.post("/api/cv", authenticateJWT, uploadCV);

  // Delete CV
  app.delete("/api/cv", authenticateJWT, deleteCV);

  // Download CV
  app.get("/api/cv/download/:freelancerId", authenticateJWT, downloadCV);

  // Serve objects (DISABLED for security - use specific authenticated endpoints instead)
  app.get("/objects/:objectPath(*)", getObjectAccess);

  // MESSAGE ATTACHMENTS

  // Get attachment upload URL
  app.post("/api/objects/upload", authenticateJWT, getUploadURL);

  // Create attachment after file upload
  app.post("/api/attachments/create", authenticateJWT, createAttachment);

  // Add attachment to message
  app.post("/api/messages/:messageId/attachments", authenticateJWT, addAttachmentToMessage);

  // Get message attachments
  app.get("/api/messages/:messageId/attachments", authenticateJWT, getMessageAttachments);

  // Download attachment (secure access)
  app.get("/api/attachments/:attachmentId/download", authenticateJWT, downloadAttachment);

  // Report attachment
  app.post("/api/attachments/:attachmentId/report", authenticateJWT, reportAttachment);

  // FREELANCER DOCUMENTS/CERTIFICATIONS

  // Get document types
  app.get("/api/documents/types", getDocumentTypes);

  // Get document upload URL (step 1)
  app.post("/api/documents/upload-url", authenticateJWT, getDocumentUploadUrl);

  // Confirm document upload (step 2)
  app.post("/api/documents/confirm", authenticateJWT, confirmDocumentUpload);

  // Get freelancer documents
  app.get("/api/documents/:freelancerId", authenticateJWT, getDocuments);

  // Download document
  app.get("/api/documents/:documentId/download", authenticateJWT, downloadDocument);

  // Delete document
  app.delete("/api/documents/:documentId", authenticateJWT, deleteDocument);
}
