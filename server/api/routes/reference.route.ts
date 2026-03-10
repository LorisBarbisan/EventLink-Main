import express from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import {
  getReferenceFormInfo,
  submitReference,
  getMyReferenceToken,
  getPublicReferences,
} from "../controllers/reference.controller";

const router = express.Router();

router.get("/form/:token", getReferenceFormInfo);
router.post("/submit/:token", submitReference);
router.get("/my-token", authenticateJWT, getMyReferenceToken);
router.get("/freelancer/:freelancerId", getPublicReferences);

export function registerReferenceRoutes(app: express.Router) {
  return router;
}

export default router;
