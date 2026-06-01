import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { requireFmsAccess } from "../middleware/subscription.middleware.js";
import {
  attachTeamContext,
  requireTeamAdmin,
  requireTeamOwner,
} from "../middleware/team.middleware.js";
import {
  getTeam,
  inviteMember,
  acceptInvite,
  updateMemberRole,
  removeMember,
  grantDelegate,
  revokeDelegate,
} from "../controllers/team.controller.js";

const teamRouter = Router();

teamRouter.get("/accept-invite/:token", authenticateJWT as any, acceptInvite);

teamRouter.use(
  ...[authenticateJWT, requireRole("recruiter"), requireFmsAccess, attachTeamContext] as any[]
);

teamRouter.get("/", getTeam);
teamRouter.post("/invite", ...[requireTeamAdmin, inviteMember] as any[]);
teamRouter.patch("/members/role", ...[requireTeamAdmin, updateMemberRole] as any[]);
teamRouter.delete("/members/:userId", ...[requireTeamOwner, removeMember] as any[]);
teamRouter.post("/delegate", ...[requireTeamAdmin, grantDelegate] as any[]);
teamRouter.delete("/delegate", ...[requireTeamAdmin, revokeDelegate] as any[]);

export default teamRouter;
