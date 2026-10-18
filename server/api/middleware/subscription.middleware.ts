import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage.js";

export const requireFmsAccess =
  (requiredTier?: "pro" | "teams") => async (req: Request, res: Response, next: NextFunction) => {
    // When Stripe is not configured, subscription gating is disabled
    if (!process.env.STRIPE_SECRET_KEY) {
      return next();
    }
    try {
      const employerId = req.companyId ?? req.user?.id;
      if (!employerId) return res.status(401).json({ error: "Unauthorised" });

      const sub = await storage.getSubscription(employerId);
      const isActive = sub?.status === "active" || sub?.status === "trialing";

      if (!isActive) {
        return res.status(403).json({
          error: "FMS_ACCESS_REQUIRED",
          message: "An active EventLink Pro or Teams subscription is required.",
        });
      }

      if (requiredTier === "teams" && sub?.tier !== "teams") {
        return res.status(403).json({
          error: "TEAMS_TIER_REQUIRED",
          message: "This feature requires an EventLink Teams subscription.",
        });
      }

      next();
    } catch (err: any) {
      console.error("requireFmsAccess error:", err.message);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
