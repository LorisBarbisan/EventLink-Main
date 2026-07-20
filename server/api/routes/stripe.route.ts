import express, { type Express } from "express";
import {
  createCheckoutSession,
  createIdentitySession,
  createPortalSession,
  handleIdentityWebhook,
  handleWebhook,
} from "../controllers/stripe.controller";
import { authenticateJWT } from "../middleware/auth.middleware";

export function registerStripeRoutes(app: Express) {
  // Webhooks must receive the raw body — register BEFORE json middleware would parse them
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleWebhook);

  app.post(
    "/api/stripe/identity-webhook",
    express.raw({ type: "application/json" }),
    handleIdentityWebhook
  );

  // Authenticated endpoints
  app.post("/api/stripe/checkout", authenticateJWT, createCheckoutSession);
  app.post("/api/stripe/portal", authenticateJWT, createPortalSession);
  app.post("/api/stripe/identity", authenticateJWT, createIdentitySession);
}
