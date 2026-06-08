import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { resolveCompanyId, resolveCompanyIdOptional } from "../middleware/team.middleware";
import {
  uploadJobDocument,
  uploadFreelancerJobDocument,
  getJobDocuments,
  deleteJobDocument,
  downloadJobDocumentLocal,
} from "../controllers/job-document.controller";

const router = Router();

router.use(authenticateJWT);

// Employer — upload document to their job
router.post(
  "/:jobId/documents",
  requireRole("employer"),
  resolveCompanyId,
  uploadJobDocument
);

// Employer — delete a document
router.delete(
  "/:jobId/documents/:docId",
  requireRole("employer"),
  resolveCompanyId,
  deleteJobDocument
);

// Hired freelancer — upload their own document to a job
router.post("/:jobId/documents/freelancer", requireRole("freelancer"), uploadFreelancerJobDocument);

// Employer or hired freelancer — get documents for a job
router.get("/:jobId/documents", resolveCompanyIdOptional, getJobDocuments);

// Serve locally-stored document (fallback when object storage sidecar is unavailable)
router.get("/:jobId/documents/:docId/download", resolveCompanyIdOptional, downloadJobDocumentLocal);

export default router;
