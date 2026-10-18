import express from "express";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { requireFmsAccess } from "../middleware/subscription.middleware.js";
import {
  getCalendarStatus,
  connectGoogle,
  googleCallback,
  connectOutlook,
  outlookCallback,
  syncCalendar,
  disconnectCalendar,
} from "../controllers/calendar.controller.js";

const calendarRouter = express.Router();

calendarRouter.get("/status", authenticateJWT, requireRole("recruiter"), requireFmsAccess, getCalendarStatus);
calendarRouter.get("/google/connect", authenticateJWT, requireRole("recruiter"), requireFmsAccess, connectGoogle);
calendarRouter.get("/google/callback", googleCallback);
calendarRouter.get("/outlook/connect", authenticateJWT, requireRole("recruiter"), requireFmsAccess, connectOutlook);
calendarRouter.get("/outlook/callback", outlookCallback);
calendarRouter.post("/sync", authenticateJWT, requireRole("recruiter"), requireFmsAccess, syncCalendar);
calendarRouter.delete("/disconnect", authenticateJWT, requireRole("recruiter"), requireFmsAccess, disconnectCalendar);

export default calendarRouter;
