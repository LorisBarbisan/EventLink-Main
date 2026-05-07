import { Request, Response, NextFunction } from "express";

const ROLE_ALIASES: Record<string, string> = {
  employer: "recruiter",
};

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    const allowed = roles.map((r) => ROLE_ALIASES[r] ?? r);
    if (!userRole || !allowed.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}
