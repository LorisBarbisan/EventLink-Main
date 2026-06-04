import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage.js";

export const requireFmsAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // When Stripe is not configured, subscription gating is disabled — all employers have access
  if (!process.env.STRIPE_SECRET_KEY) {
    return next();
  }
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const hasAccess = await storage.hasActiveSubscription(employerId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "FMS_ACCESS_REQUIRED",
        message: "An active EventLink Pro or Teams subscription is required.",
      });
    }
    next();
  } catch (err: any) {
    console.error("requireFmsAccess error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
