import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import {
  sendBrief,
  getBriefForBooking,
  getBriefByTokenHandler,
  acknowledgeBriefHandler,
  getBriefTemplates,
  createBriefTemplate,
  deleteBriefTemplate,
  getBriefAttachmentUploadUrl,
  addBriefAttachment,
} from "../controllers/brief.controller.js";

const briefRouter = Router();

// Public routes — no auth required
briefRouter.get("/acknowledge/:token", getBriefByTokenHandler);
briefRouter.post("/acknowledge/:token", acknowledgeBriefHandler);

// Employer routes
briefRouter.post("/booking/:bookingId", authenticateJWT, requireRole("recruiter"), sendBrief);
briefRouter.get("/booking/:bookingId", authenticateJWT, requireRole("recruiter"), getBriefForBooking);
briefRouter.post("/booking/:bookingId/attachments", authenticateJWT, requireRole("recruiter"), addBriefAttachment);
briefRouter.get("/attachment-upload-url", authenticateJWT, requireRole("recruiter"), getBriefAttachmentUploadUrl);

// Template routes
briefRouter.get("/templates", authenticateJWT, requireRole("recruiter"), getBriefTemplates);
briefRouter.post("/templates", authenticateJWT, requireRole("recruiter"), createBriefTemplate);
briefRouter.delete("/templates/:templateId", authenticateJWT, requireRole("recruiter"), deleteBriefTemplate);

export default briefRouter;
