import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { requireFmsAccess } from "../middleware/subscription.middleware.js";
import { getHistoryPool } from "../controllers/historyPool.controller.js";

const historyPoolRouter = Router();

historyPoolRouter.get(
  "/",
  authenticateJWT,
  requireRole("recruiter"),
  requireFmsAccess,
  getHistoryPool
);

export default historyPoolRouter;
