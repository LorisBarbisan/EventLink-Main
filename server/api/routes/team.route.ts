import { Router } from "express";
import { authenticateJWT, authenticateOptionalJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { resolveCompanyId } from "../middleware/team.middleware";
import { requireFmsAccess } from "../middleware/subscription.middleware";
import {
  getTeamMembers,
  inviteTeamMember,
  acceptInvitation,
  registerTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  grantDelegateAccess,
  revokeDelegateAccess,
} from "../controllers/team.controller";

const router = Router();

// ── Unauthenticated invite-acceptance routes ──────────────
router.get("/accept/:token", authenticateOptionalJWT, acceptInvitation);
router.post("/accept/:token", authenticateJWT, acceptInvitation);
router.post("/register/:token", registerTeamMember);

// ── Authenticated team-management routes (Teams tier) ─────
router.use(authenticateJWT, requireRole("employer"), resolveCompanyId, requireFmsAccess("teams"));

router.get("/", getTeamMembers);
router.post("/invite", inviteTeamMember);
router.patch("/:id/role", updateTeamMemberRole);
router.delete("/:id", removeTeamMember);
router.post("/delegate", grantDelegateAccess);
router.delete("/delegate", revokeDelegateAccess);

export default router;
