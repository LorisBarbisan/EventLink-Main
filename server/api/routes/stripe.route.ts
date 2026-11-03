import { type Express } from "express";
import {
  createCheckoutSession,
  createIdentitySession,
  createPortalSession,
} from "../controllers/stripe.controller";
import { authenticateJWT, requirePro } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

export function registerStripeRoutes(app: Express) {
  // Authenticated endpoints
  app.post("/api/stripe/checkout", authenticateJWT, createCheckoutSession);
  app.post("/api/stripe/portal", authenticateJWT, createPortalSession);
  // Identity verification is Pro-only — gate here so route files are the
  // single source of truth for what requires a paid subscription.
  app.post(
    "/api/stripe/identity",
    authenticateJWT,
    requirePro,
    requireRole("freelancer"),
    createIdentitySession
  );
}
