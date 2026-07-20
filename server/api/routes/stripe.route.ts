import { type Express } from "express";
import {
  createCheckoutSession,
  createIdentitySession,
  createPortalSession,
} from "../controllers/stripe.controller";
import { authenticateJWT } from "../middleware/auth.middleware";

export function registerStripeRoutes(app: Express) {
  // Authenticated endpoints
  app.post("/api/stripe/checkout", authenticateJWT, createCheckoutSession);
  app.post("/api/stripe/portal", authenticateJWT, createPortalSession);
  app.post("/api/stripe/identity", authenticateJWT, createIdentitySession);
}
