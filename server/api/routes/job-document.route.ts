import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { resolveCompanyId, resolveCompanyIdOptional } from "../middleware/team.middleware";
import {
  requestUploadUrl,
  confirmUpload,
  getJobDocuments,
  deleteJobDocument,
} from "../controllers/job-document.controller";

const router = Router();

router.use(authenticateJWT);

// Step 1: Employer requests a signed PUT URL (tiny JSON, no file body)
router.post(
  "/:jobId/documents/request-upload",
  requireRole("employer"),
  resolveCompanyId,
  requestUploadUrl
);

// Step 2: Employer confirms upload after browser PUT to storage
router.post(
  "/:jobId/documents/confirm",
  requireRole("employer"),
  resolveCompanyId,
  confirmUpload
);

// Employer — delete a document
router.delete(
  "/:jobId/documents/:docId",
  requireRole("employer"),
  resolveCompanyId,
  deleteJobDocument
);

// Employer or hired freelancer — get documents for a job
router.get("/:jobId/documents", resolveCompanyIdOptional, getJobDocuments);

export default router;
