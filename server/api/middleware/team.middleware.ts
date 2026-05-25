import { db } from "../config/db";
import { teamMembers } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { Request, Response, NextFunction } from "express";
import { resolveTeamContextForUser } from "../utils/team.util";

export async function resolveCompanyId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) return next();

  try {
    const [membership] = await db
      .select({
        companyId: teamMembers.companyId,
        role: teamMembers.role,
        inviteAccepted: teamMembers.inviteAccepted,
      })
      .from(teamMembers)
      .where(
        and(eq(teamMembers.userId, req.user.id), eq(teamMembers.inviteAccepted, true))
      )
      .limit(1);

    const ctx = resolveTeamContextForUser(req.user.id, membership ?? undefined);
    req.companyId = ctx.companyId;
    req.teamRole = ctx.teamRole;
  } catch (err) {
    console.error("resolveCompanyId error:", err);
    req.companyId = req.user.id;
    req.teamRole = "owner";
  }

  next();
}

/** Same as resolveCompanyId but no-op when unauthenticated (e.g. optional-auth routes). */
export async function resolveCompanyIdOptional(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return next();
  }
  return resolveCompanyId(req, res, next);
}
