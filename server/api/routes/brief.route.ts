import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { requireFmsAccess } from "../middleware/subscription.middleware.js";
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
const fms = [authenticateJWT, requireRole("recruiter"), requireFmsAccess] as any[];

briefRouter.post("/booking/:bookingId", ...fms, sendBrief);
briefRouter.get("/booking/:bookingId", ...fms, getBriefForBooking);
briefRouter.post("/booking/:bookingId/attachments", ...fms, addBriefAttachment);
briefRouter.get("/attachment-upload-url", ...fms, getBriefAttachmentUploadUrl);

// Template routes
briefRouter.get("/templates", ...fms, getBriefTemplates);
briefRouter.post("/templates", ...fms, createBriefTemplate);
briefRouter.delete("/templates/:templateId", ...fms, deleteBriefTemplate);

export default briefRouter;
