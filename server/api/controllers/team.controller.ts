import { Request, Response } from "express";
import { db } from "../config/db";
import { teamMembers, users, recruiter_profiles } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "../utils/emailService";
import crypto from "crypto";

// ── Helpers ───────────────────────────────────────────────

async function getCompanyName(companyId: number): Promise<string> {
  const [profile] = await db
    .select({ company_name: recruiter_profiles.company_name })
    .from(recruiter_profiles)
    .where(eq(recruiter_profiles.user_id, companyId))
    .limit(1);
  return profile?.company_name || "Your Company";
}

function isOwnerOrAdmin(role: string | undefined) {
  return role === "owner" || role === "admin";
}

// ── GET /api/team ─────────────────────────────────────────
export async function getTeamMembers(req: Request, res: Response) {
  try {
    const companyId = req.companyId!;

    const members = await db
      .select({
        id: teamMembers.id,
        role: teamMembers.role,
        invitedEmail: teamMembers.invitedEmail,
        inviteAccepted: teamMembers.inviteAccepted,
        inviteSentAt: teamMembers.inviteSentAt,
        inviteAcceptedAt: teamMembers.inviteAcceptedAt,
        userId: teamMembers.userId,
        firstName: users.first_name,
        lastName: users.last_name,
      })
      .from(teamMembers)
      .leftJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.companyId, companyId));

    return res.json(members);
  } catch (error) {
    console.error("getTeamMembers error:", error);
    return res.status(500).json({ error: "Failed to fetch team members" });
  }
}

// ── POST /api/team/invite ─────────────────────────────────
export async function inviteTeamMember(req: Request, res: Response) {
  try {
    const companyId = req.companyId!;

    if (!isOwnerOrAdmin(req.teamRole)) {
      return res.status(403).json({ error: "Only owners and admins can invite team members" });
    }

    const { email, role = "manager", resend } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "A valid email address is required" });
    }

    const validRoles = ["admin", "manager", "viewer"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Role must be admin, manager, or viewer" });
    }

    // Check for existing invitation
    const [existing] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.companyId, companyId),
          eq(teamMembers.invitedEmail, email.toLowerCase())
        )
      )
      .limit(1);

    if (existing && existing.inviteAccepted && !resend) {
      return res.status(409).json({ error: "This person is already an active team member" });
    }

    const companyName = await getCompanyName(companyId);
    const token = crypto.randomUUID();

    if (existing && !existing.inviteAccepted) {
      // Update existing pending invitation with fresh token
      await db
        .update(teamMembers)
        .set({
          role,
          inviteToken: token,
          inviteSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(teamMembers.id, existing.id));
    } else if (!existing) {
      // Create new invitation
      await db.insert(teamMembers).values({
        companyId,
        userId: null,
        role,
        invitedEmail: email.toLowerCase(),
        inviteToken: token,
        inviteAccepted: false,
        inviteSentAt: new Date(),
      });
    } else {
      // resend for accepted member — just resend email (already accepted)
      return res.json({ success: true, message: "Member is already active" });
    }

    // Send invitation email
    const inviteUrl = `https://eventlink.one/join-team?token=${token}`;
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #D8690E 0%, #c45a08 100%); padding: 32px 40px; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .body { padding: 32px 40px; }
    .body p { color: #444; line-height: 1.6; margin: 0 0 16px; }
    .button { display: inline-block; background: #D8690E; color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 16px 0; }
    .footer { background: #f5f5f5; padding: 20px 40px; font-size: 12px; color: #999; }
    .footer a { color: #D8690E; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>EventLink</h1>
    </div>
    <div class="body">
      <p>Hi,</p>
      <p>You have been invited to join the <strong>${companyName}</strong> team on EventLink as a <strong>${roleLabel}</strong>.</p>
      <p>EventLink is a platform for the UK events industry connecting employers with verified freelance technicians.</p>
      <p>Click the button below to accept your invitation and set up your account:</p>
      <a href="${inviteUrl}" class="button">Accept Invitation</a>
      <p style="color:#999;font-size:13px;">Or copy this link: <a href="${inviteUrl}" style="color:#D8690E;">${inviteUrl}</a></p>
      <p style="color:#999;font-size:13px;">This invitation expires in 7 days.</p>
    </div>
    <div class="footer">
      <p>The EventLink Team &middot; <a href="https://eventlink.one">eventlink.one</a></p>
      <p>You received this because someone at ${companyName} invited you to EventLink.</p>
    </div>
  </div>
</body>
</html>`;

    try {
      await sendEmail({
        to: email.toLowerCase(),
        subject: `You have been invited to join ${companyName} on EventLink`,
        html,
      });
    } catch (emailErr) {
      console.error("Failed to send invitation email:", emailErr);
    }

    return res.status(201).json({ success: true, message: `Invitation sent to ${email}` });
  } catch (error) {
    console.error("inviteTeamMember error:", error);
    return res.status(500).json({ error: "Failed to send invitation" });
  }
}

// ── GET /api/team/accept/:token  (unauthenticated — check token) ──
// ── POST /api/team/accept/:token (authenticated — complete link) ──
export async function acceptInvitation(req: Request, res: Response) {
  try {
    const { token } = req.params;

    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.inviteToken, token))
      .limit(1);

    if (!membership) {
      return res.status(404).json({ error: "Invitation not found or already accepted" });
    }

    // Check expiry (7 days)
    if (membership.inviteSentAt) {
      const sentAt = new Date(membership.inviteSentAt).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - sentAt > sevenDays) {
        return res.status(410).json({
          error: "This invitation has expired. Please contact the company to send a new one.",
        });
      }
    }

    if (req.method === "GET") {
      // Return info for frontend to show login/signup form
      const companyName = await getCompanyName(membership.companyId);
      return res.json({
        requiresAuth: !req.user,
        invitedEmail: membership.invitedEmail,
        role: membership.role,
        companyName,
      });
    }

    // POST — authenticated user accepting the invitation
    if (!req.user) {
      return res.status(401).json({ error: "You must be signed in to accept this invitation" });
    }

    // Block freelancers from accepting team invitations
    const [acceptingUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (acceptingUser?.role === "freelancer") {
      return res.status(403).json({
        error: "freelancer_cannot_join_team",
        message: "Your account is registered as a freelancer. Team invitations are for employer accounts only. If you need to join a company team, please register with a new employer account.",
      });
    }

    if (membership.inviteAccepted) {
      return res.status(409).json({ error: "This invitation has already been accepted" });
    }

    // Check: the user shouldn't already be linked to another company
    const [existingLink] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, req.user.id))
      .limit(1);

    if (existingLink && existingLink.id !== membership.id) {
      return res.status(409).json({
        error: "Your account is already linked to another company",
      });
    }

    const companyName = await getCompanyName(membership.companyId);

    await db
      .update(teamMembers)
      .set({
        userId: req.user.id,
        inviteAccepted: true,
        inviteAcceptedAt: new Date(),
        inviteToken: null,
        updatedAt: new Date(),
      })
      .where(eq(teamMembers.id, membership.id));

    return res.json({ success: true, companyName });
  } catch (error) {
    console.error("acceptInvitation error:", error);
    return res.status(500).json({ error: "Failed to process invitation" });
  }
}

// ── PATCH /api/team/:id/role ──────────────────────────────
export async function updateTeamMemberRole(req: Request, res: Response) {
  try {
    const companyId = req.companyId!;
    const memberId = parseInt(req.params.id);
    const { role } = req.body;

    if (!isOwnerOrAdmin(req.teamRole)) {
      return res.status(403).json({ error: "Only owners and admins can change roles" });
    }

    const validRoles = ["admin", "manager", "viewer"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Role must be admin, manager, or viewer" });
    }

    if (isNaN(memberId)) {
      return res.status(400).json({ error: "Invalid member ID" });
    }

    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.companyId, companyId)))
      .limit(1);

    if (!member) {
      return res.status(404).json({ error: "Team member not found" });
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ role, updatedAt: new Date() })
      .where(eq(teamMembers.id, memberId))
      .returning();

    return res.json(updated);
  } catch (error) {
    console.error("updateTeamMemberRole error:", error);
    return res.status(500).json({ error: "Failed to update role" });
  }
}

// ── DELETE /api/team/:id ──────────────────────────────────
export async function removeTeamMember(req: Request, res: Response) {
  try {
    const companyId = req.companyId!;
    const memberId = parseInt(req.params.id);

    if (!isOwnerOrAdmin(req.teamRole)) {
      return res.status(403).json({ error: "Only owners and admins can remove team members" });
    }

    if (isNaN(memberId)) {
      return res.status(400).json({ error: "Invalid member ID" });
    }

    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.companyId, companyId)))
      .limit(1);

    if (!member) {
      return res.status(404).json({ error: "Team member not found" });
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, memberId));

    return res.json({ success: true });
  } catch (error) {
    console.error("removeTeamMember error:", error);
    return res.status(500).json({ error: "Failed to remove team member" });
  }
}
