import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import {
  getCalendarStatus,
  initiateGoogleConnect,
  googleCallback,
  initiateOutlookConnect,
  outlookCallback,
  triggerSync,
  disconnect,
  updatePreferences,
  googleWebhookHandler,
  outlookWebhookHandler,
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
calendarRouter.get("/outlook/connect", authenticateJWT, initiateOutlookConnect);
calendarRouter.get("/outlook/callback", outlookCallback);

// Webhooks (unauthenticated — Google/Microsoft push notifications)
calendarRouter.post("/webhook/google", googleWebhookHandler);
calendarRouter.post("/webhook/outlook", outlookWebhookHandler);

// External calendar events (opt-in read)
calendarRouter.get("/external-events", authenticateJWT, getExternalEvents);

// Availability
calendarRouter.get("/availability", authenticateJWT, listAvailability);
calendarRouter.put("/availability", authenticateJWT, setAvailability);
calendarRouter.delete("/availability/:date", authenticateJWT, deleteAvailability);

export default calendarRouter;
