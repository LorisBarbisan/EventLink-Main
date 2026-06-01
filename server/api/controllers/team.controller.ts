import type { Request, Response } from "express";
import { storage } from "../../storage.js";

export const getTeam = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const membership = await storage.getTeamByMember(userId);
    if (!membership) return res.json({ team: null, role: null });
    const members = await storage.getTeamMembers(membership.team.id);
    const delegateAccess = await storage.getTeamDelegateAccess(membership.team.id);
    const sub = await storage.getSubscription(membership.team.ownerId);
    const limit = sub?.tier === "teams" ? 10 : 3;
    const activeCount = members.filter(
      (m) => m.member.status === "active" || m.member.status === "invited"
    ).length;
    return res.json({
      team: membership.team,
      role: membership.role,
      isOwner: membership.team.ownerId === userId,
      members,
      delegateAccess,
      seatLimit: limit,
      seatsUsed: activeCount,
    });
  } catch (err: any) {
    console.error("getTeam error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const inviteMember = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const ctx = (req as any).teamContext;
    if (!ctx) return res.status(403).json({ error: "Not a team member" });
    const { email, role } = req.body;
    if (!email || !["admin", "manager"].includes(role)) {
      return res.status(400).json({ error: "Valid email and role required" });
    }
    const { invite, token } = await storage.inviteTeamMember({
      teamId: ctx.teamId,
      invitedByUserId: userId,
      email,
      role,
    });
    const { sendEmail } = await import("../utils/emailService.js");
    const inviter = await storage.getUser(userId);
    const membership = await storage.getTeamByMember(userId);
    const team = membership ? await storage.getTeamByOwner(membership.team.ownerId) : null;
    const baseUrl = req.protocol + "://" + req.get("host");
    const inviteUrl = `${baseUrl}/team/accept-invite/${token}`;
    await sendEmail({
      to: email,
      subject: `You've been invited to join ${team?.name ?? "a team"} on EventLink`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1E3A5F;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;">EventLink</h1>
          </div>
          <div style="padding:32px;">
            <p>${inviter?.first_name ?? "A colleague"} has invited you to join
            <strong>${team?.name ?? "their team"}</strong> on EventLink FMS
            as a <strong>${role}</strong>.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${inviteUrl}" style="background:#E8610A;color:#fff;
                padding:16px 32px;text-decoration:none;border-radius:6px;
                font-weight:bold;font-size:16px;">Accept Invitation</a>
            </div>
            <p style="color:#888;font-size:13px;">
              This invitation expires in 7 days.
              If you did not expect this email, you can ignore it.
            </p>
          </div>
        </div>
      `,
    });
    return res.status(201).json({ success: true, inviteEmail: email });
  } catch (err: any) {
    console.error("inviteMember error:", err.message);
    if (err.message.startsWith("SEAT_LIMIT_REACHED")) {
      const limit = err.message.split(":")[1];
      return res.status(409).json({
        error: "SEAT_LIMIT_REACHED",
        message: `Your plan allows up to ${limit} team members.`,
      });
    }
    if (err.message === "User is already a team member") {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const acceptInvite = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.redirect(`/team/accept-invite/${token}`);
    }
    await storage.acceptTeamInvite(token, userId);
    return res.redirect("/dashboard?team_joined=true");
  } catch (err: any) {
    console.error("acceptInvite error:", err.message);
    const msg = encodeURIComponent(err.message);
    return res.redirect(`/dashboard?invite_error=${msg}`);
  }
};

export const updateMemberRole = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const ctx = (req as any).teamContext;
    const { targetUserId, role } = req.body;
    const updated = await storage.updateMemberRole(ctx.teamId, targetUserId, role, userId);
    return res.json(updated);
  } catch (err: any) {
    console.error("updateMemberRole error:", err.message);
    return res
      .status(err.message === "Insufficient permissions" ? 403 : 500)
      .json({ error: err.message });
  }
};

export const removeMember = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const ctx = (req as any).teamContext;
    const targetUserId = parseInt(req.params.userId);
    await storage.removeTeamMember(ctx.teamId, targetUserId, userId);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("removeMember error:", err.message);
    return res.status(403).json({ error: err.message });
  }
};

export const grantDelegate = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const ctx = (req as any).teamContext;
    const { delegatorUserId, delegateUserId } = req.body;
    const access = await storage.grantDelegateAccess({
      teamId: ctx.teamId,
      delegatorUserId,
      delegateUserId,
      grantedByUserId: userId,
    });
    return res.status(201).json(access);
  } catch (err: any) {
    console.error("grantDelegate error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const revokeDelegate = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const ctx = (req as any).teamContext;
    const { delegatorUserId, delegateUserId } = req.body;
    await storage.revokeDelegateAccess(ctx.teamId, delegatorUserId, delegateUserId);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("revokeDelegate error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
