import { Router } from "express";
import { authenticateJWT, authenticateOptionalJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { resolveCompanyId } from "../middleware/team.middleware";
import {
  getTeamMembers,
  inviteTeamMember,
  acceptInvitation,
  registerTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
} from "../controllers/team.controller";

const router = Router();

router.get("/accept/:token", authenticateOptionalJWT, acceptInvitation);
router.post("/accept/:token", authenticateJWT, acceptInvitation);
router.post("/register/:token", registerTeamMember);

router.use(authenticateJWT, requireRole("employer"), resolveCompanyId);

router.get("/", getTeamMembers);
router.post("/invite", inviteTeamMember);
router.patch("/:id/role", updateTeamMemberRole);
router.delete("/:id", removeTeamMember);

export default router;
