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
  uploadCV,
} from "../controllers/file.controller";
import {
  deleteDocument,
  downloadDocument,
  getDocuments,
  getDocumentTypes,
  getIncompleteCredentials,
  saveCredentialDates,
  uploadDocument,
} from "../controllers/document.controller";
import { authenticateJWT, authenticateOptionalJWT } from "../middleware/auth.middleware";

export function registerFileRoutes(app: Express) {
  // Upload CV - combined endpoint that receives base64 file data and uploads to storage
  app.post("/api/cv", authenticateJWT, uploadCV);

  // Delete CV
  app.delete("/api/cv", authenticateJWT, deleteCV);

  // Download CV — JWT required OR valid ?pt= public profile token
  app.get("/api/cv/download/:freelancerId", authenticateOptionalJWT, downloadCV);

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

  // FREELANCER DOCUMENTS/CERTIFICATIONS

  // Get document types
  app.get("/api/documents/types", getDocumentTypes);

  // Upload document
  app.post("/api/documents", authenticateJWT, uploadDocument);

  // Credential backfill — the signed-in freelancer's undated credentials, and a
  // batch save. Registered before "/:freelancerId" so the literal path wins.
  app.get("/api/documents/incomplete", authenticateJWT, getIncompleteCredentials);
  app.post("/api/documents/backfill", authenticateJWT, saveCredentialDates);

  // Freelancer's credential list — same access rule as the download below:
  // employers and admins, the owner, or (signed out) a public profile / share token
  app.get("/api/documents/:freelancerId", authenticateOptionalJWT, getDocuments);

  // Download document — JWT optional (owner access) OR valid ?pt= public profile token
  app.get("/api/documents/:documentId/download", authenticateOptionalJWT, downloadDocument);

  // Delete document
  app.delete("/api/documents/:documentId", authenticateJWT, deleteDocument);
}
