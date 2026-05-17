import { db } from "../config/db";
import { teamMembers } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { Request, Response, NextFunction } from "express";

export async function resolveCompanyId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) return next();

  try {
    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, req.user.id))
      .limit(1);

    if (membership && membership.inviteAccepted) {
      req.companyId = membership.companyId;
      req.teamRole = membership.role as "admin" | "manager" | "viewer";
    } else {
      req.companyId = req.user.id;
      req.teamRole = "owner";
    }
  } catch (err) {
    console.error("resolveCompanyId error:", err);
    req.companyId = req.user.id;
    req.teamRole = "owner";
  }

  next();
}
