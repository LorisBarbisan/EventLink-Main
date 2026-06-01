import express from "express";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import {
  createCheckout,
  openPortal,
  getSubscriptionStatus,
} from "../controllers/subscription.controller.js";

const subscriptionRouter = express.Router();

subscriptionRouter.get("/status", authenticateJWT, requireRole("recruiter"), getSubscriptionStatus);
subscriptionRouter.post("/checkout", authenticateJWT, requireRole("recruiter"), createCheckout);
subscriptionRouter.post("/portal", authenticateJWT, requireRole("recruiter"), openPortal);

export default subscriptionRouter;
