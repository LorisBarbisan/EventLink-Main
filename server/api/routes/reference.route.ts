import express from "express";
import { authenticateJWT, authenticateOptionalJWT } from "../middleware/auth.middleware";
import {
  getReferenceFormInfo,
  submitReference,
  getMyReferenceToken,
  getPublicReferences,
  verifyRefereeEmail,
  startLinkedInReferenceAuth,
  linkedInReferenceCallback,
  createReferenceRequest,
  getReferenceRequests,
  cancelReferenceRequest,
  sendReferenceReminder,
  reportReference,
  getDomainTrustInfo,
} from "../controllers/reference.controller";

const router = express.Router();

router.get("/form/:token", getReferenceFormInfo);
router.post("/submit/:token", authenticateOptionalJWT, submitReference);
router.get("/verify-email", verifyRefereeEmail);
router.get("/linkedin-auth", startLinkedInReferenceAuth);
router.get("/linkedin-callback", linkedInReferenceCallback);
router.get("/my-token", authenticateJWT, getMyReferenceToken);
router.get("/freelancer/:freelancerId", getPublicReferences);
router.post("/requests", authenticateJWT, createReferenceRequest);
router.get("/requests", authenticateJWT, getReferenceRequests);
router.patch("/requests/:id/cancel", authenticateJWT, cancelReferenceRequest);
router.post("/requests/:id/remind", authenticateJWT, sendReferenceReminder);
router.post("/report/:referenceId", authenticateJWT, reportReference);
router.get("/domain-trust", getDomainTrustInfo);

export function registerReferenceRoutes(app: express.Router) {
  return router;
}

export default router;
