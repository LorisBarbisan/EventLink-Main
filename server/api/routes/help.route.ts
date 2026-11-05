// ============================================================
// Contextual help system — routes. Mounted at /api/help.
// ============================================================

import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import {
  getHelpState,
  postHelpEvents,
  patchHelpPreferences,
  getHelpContent,
  getHelpAdminMetrics,
  upsertHelpOverride,
  deleteHelpOverride,
} from "../controllers/help.controller";

const router = Router();

// Help is a logged-in-only feature; the user id always comes from the token.
router.use(authenticateJWT);

router.get("/state", getHelpState);
router.post("/events", postHelpEvents);
router.patch("/preferences", patchHelpPreferences);
router.get("/content", getHelpContent);

// Admin measurement + copy override (the controllers enforce the admin role).
router.get("/admin/metrics", getHelpAdminMetrics);
router.put("/admin/content/:key", upsertHelpOverride);
router.delete("/admin/content/:key", deleteHelpOverride);

export default router;
