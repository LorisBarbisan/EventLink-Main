import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import {
  getCalendarStatus,
  initiateGoogleConnect,
  googleCallback,
  triggerSync,
  disconnect,
  updatePreferences,
  googleWebhookHandler,
  listAvailability,
  setAvailability,
  deleteAvailability,
  getExternalEvents,
} from "../controllers/calendar.controller";

const calendarRouter = Router();

// Status & preferences (authenticated)
calendarRouter.get("/status", authenticateJWT, getCalendarStatus);
calendarRouter.patch("/preferences", authenticateJWT, updatePreferences);
calendarRouter.post("/sync", authenticateJWT, triggerSync);
calendarRouter.delete("/disconnect", authenticateJWT, disconnect);

// OAuth flows (redirect — no auth middleware; uid rides in state)
calendarRouter.get("/google/connect", authenticateJWT, initiateGoogleConnect);
calendarRouter.get("/google/callback", googleCallback);

// Webhooks (unauthenticated — Google push notifications)
calendarRouter.post("/webhook/google", googleWebhookHandler);

// External calendar events (opt-in read)
calendarRouter.get("/external-events", authenticateJWT, getExternalEvents);

// Availability
calendarRouter.get("/availability", authenticateJWT, listAvailability);
calendarRouter.put("/availability", authenticateJWT, setAvailability);
calendarRouter.delete("/availability/:date", authenticateJWT, deleteAvailability);

export default calendarRouter;
