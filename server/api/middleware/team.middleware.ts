import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage.js";

export const attachTeamContext = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();
    const membership = await storage.getTeamByMember(userId);
    if (membership) {
      (req as any).teamContext = {
        teamId: membership.team.id,
        role: membership.role,
        isOwner: membership.team.ownerId === userId,
      };
    }
    next();
  } catch (err: any) {
    console.error("attachTeamContext error:", err.message);
    next();
  }
};

export const requireTeamAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const ctx = (req as any).teamContext;
  if (!ctx) return res.status(403).json({ error: "Not a team member" });
  if (ctx.role !== "admin" && ctx.role !== "owner") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export const requireTeamOwner = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const ctx = (req as any).teamContext;
  if (!ctx || !ctx.isOwner) {
    return res.status(403).json({ error: "Account owner access required" });
  }
  next();
};
