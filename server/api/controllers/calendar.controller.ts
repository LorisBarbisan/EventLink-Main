import type { Request, Response } from "express";
import { db } from "../config/db.js";
import { calendar_connections } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";
import { getGoogleAuthUrl, connectGoogleCalendar } from "../services/googleCalendar.service.js";
import { getOutlookAuthUrl, connectOutlookCalendar } from "../services/outlookCalendar.service.js";
import { syncAllBookings } from "../services/calendarSync.service.js";

// Simple tamper-evident state token: base64(json) — employer ID stored in session for security
function makeStateToken(employerId: number): string {
  return Buffer.from(JSON.stringify({ uid: employerId, ts: Date.now() })).toString("base64url");
}

function parseStateToken(state: string): number | null {
  try {
    const { uid, ts } = JSON.parse(Buffer.from(state, "base64url").toString());
    // Expire after 10 minutes
    if (Date.now() - ts > 10 * 60 * 1000) return null;
    return typeof uid === "number" ? uid : null;
  } catch {
    return null;
  }
}

// GET /api/calendar/debug — temporary, shows what redirect URI the server will use
export const debugCalendar = (req: Request, res: Response) => {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const envVar = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  const appUrl = process.env.APP_URL;
  const derived = `${proto}://${host}/api/calendar/google/callback`;
  return res.json({
    GOOGLE_CALENDAR_REDIRECT_URI: envVar || "(not set)",
    APP_URL: appUrl || "(not set)",
    x_forwarded_host: req.headers["x-forwarded-host"] || "(not set)",
    host_header: req.headers.host || "(not set)",
    redirect_uri_that_will_be_used: envVar || derived,
  });
};

// GET /api/calendar/status
export const getCalendarStatus = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const [conn] = await db
      .select({
        provider: calendar_connections.provider,
        connectedAt: calendar_connections.connectedAt,
      })
      .from(calendar_connections)
      .where(eq(calendar_connections.employerId, employerId));
    return res.json({
      connected: !!conn,
      provider: conn?.provider ?? null,
      connectedAt: conn?.connectedAt ?? null,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/calendar/google/connect
// Returns JSON { url } so the frontend can redirect with its auth header intact
export const connectGoogle = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorised" });
    const state = makeStateToken(req.user.id);
    const url = getGoogleAuthUrl(state, req);
    return res.json({ url });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/calendar/google/callback — public, OAuth redirect target
export const googleCallback = async (req: Request, res: Response) => {
  try {
    const state = req.query.state as string | undefined;
    const employerId = state ? parseStateToken(state) : null;
    if (!employerId) return res.redirect("/dashboard?tab=calendar&error=auth");
    const code = req.query.code as string;
    if (!code) return res.redirect("/dashboard?tab=calendar&error=no_code");
    await connectGoogleCalendar(employerId, code, req);
    return res.redirect("/dashboard?tab=calendar&connected=google");
  } catch (err: any) {
    console.error("Google calendar callback error:", err.message);
    return res.redirect("/dashboard?tab=calendar&error=connect_failed");
  }
};

// GET /api/calendar/outlook/connect
// Returns JSON { url } so the frontend can redirect with its auth header intact
export const connectOutlook = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorised" });
    const state = makeStateToken(req.user.id);
    const url = getOutlookAuthUrl(state);
    return res.json({ url });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/calendar/outlook/callback — public, OAuth redirect target
export const outlookCallback = async (req: Request, res: Response) => {
  try {
    const state = req.query.state as string | undefined;
    const employerId = state ? parseStateToken(state) : null;
    if (!employerId) return res.redirect("/dashboard?tab=calendar&error=auth");
    const code = req.query.code as string;
    if (!code) return res.redirect("/dashboard?tab=calendar&error=no_code");
    await connectOutlookCalendar(employerId, code);
    return res.redirect("/dashboard?tab=calendar&connected=outlook");
  } catch (err: any) {
    console.error("Outlook calendar callback error:", err.message);
    return res.redirect("/dashboard?tab=calendar&error=connect_failed");
  }
};

// POST /api/calendar/sync — manual full sync
export const syncCalendar = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const results = await syncAllBookings(employerId);
    return res.json({ success: true, ...results });
  } catch (err: any) {
    console.error("Calendar sync error:", err.message);
    if (err.message === "No calendar connected") {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE /api/calendar/disconnect
export const disconnectCalendar = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    await db.delete(calendar_connections).where(eq(calendar_connections.employerId, employerId));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
};
