import type { Request, Response } from "express";
import { db } from "../config/db";
import { calendar_connections, freelancer_date_availability } from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { createOAuthState, verifyOAuthState } from "../lib/oauth-state";
import { getGoogleAuthUrl, connectGoogleCalendar } from "../services/googleCalendar.service";
import { getOutlookAuthUrl, connectOutlookCalendar } from "../services/outlookCalendar.service";
import {
  syncAllBookings,
  disconnectCalendar,
  syncAvailabilityDay,
} from "../services/calendarSync.service";

const BASE_URL = process.env.FRONTEND_URL || "https://eventlink.one";

// ── Status ─────────────────────────────────────────────────────────────────

export async function getCalendarStatus(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [conn] = await db
    .select({
      provider: calendar_connections.provider,
      status: calendar_connections.status,
      last_error: calendar_connections.last_error,
      push_bookings: calendar_connections.push_bookings,
      push_availability: calendar_connections.push_availability,
      read_external: calendar_connections.read_external,
      last_write_sync_at: calendar_connections.last_write_sync_at,
      last_read_sync_at: calendar_connections.last_read_sync_at,
    })
    .from(calendar_connections)
    .where(eq(calendar_connections.user_id, userId))
    .limit(1);

  res.json({ connected: !!conn, connection: conn ?? null });
}

// ── Google OAuth ────────────────────────────────────────────────────────────

export function initiateGoogleConnect(req: Request, res: Response): void {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const state = createOAuthState(res, { uid: userId, purpose: "calendar" });
  const authUrl = getGoogleAuthUrl(state);
  console.log("[calendar] Google OAuth redirect URL:", authUrl);
  res.redirect(authUrl);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const { ok, payload } = verifyOAuthState(req, res);
  const code = req.query.code as string | undefined;

  if (!ok || !code || payload.purpose !== "calendar") {
    res.redirect(`${BASE_URL}/dashboard?tab=books&section=calendar&calError=invalid_state`);
    return;
  }

  try {
    await connectGoogleCalendar(payload.uid as number, code);
    await syncAllBookings(payload.uid as number);
    res.redirect(`${BASE_URL}/dashboard?tab=books&section=calendar&calSuccess=google`);
  } catch (err) {
    console.error("[calendar] Google connect failed:", err);
    res.redirect(`${BASE_URL}/dashboard?tab=books&section=calendar&calError=google_connect`);
  }
}

// ── Outlook OAuth ───────────────────────────────────────────────────────────

export function initiateOutlookConnect(req: Request, res: Response): void {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const state = createOAuthState(res, { uid: userId, purpose: "calendar" });
  res.redirect(getOutlookAuthUrl(state));
}

export async function outlookCallback(req: Request, res: Response): Promise<void> {
  const { ok, payload } = verifyOAuthState(req, res);
  const code = req.query.code as string | undefined;

  if (!ok || !code || payload.purpose !== "calendar") {
    res.redirect(`${BASE_URL}/dashboard?tab=books&section=calendar&calError=invalid_state`);
    return;
  }

  try {
    await connectOutlookCalendar(payload.uid as number, code);
    await syncAllBookings(payload.uid as number);
    res.redirect(`${BASE_URL}/dashboard?tab=books&section=calendar&calSuccess=outlook`);
  } catch (err) {
    console.error("[calendar] Outlook connect failed:", err);
    res.redirect(`${BASE_URL}/dashboard?tab=books&section=calendar&calError=outlook_connect`);
  }
}

// ── Manual sync ─────────────────────────────────────────────────────────────

export async function triggerSync(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await syncAllBookings(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[calendar] Sync failed:", err);
    res.status(500).json({ error: "Sync failed" });
  }
}

// ── Disconnect ──────────────────────────────────────────────────────────────

export async function disconnect(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await disconnectCalendar(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[calendar] Disconnect failed:", err);
    res.status(500).json({ error: "Disconnect failed" });
  }
}

// ── Update preferences ──────────────────────────────────────────────────────

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { push_bookings, push_availability, read_external } = req.body as {
    push_bookings?: boolean;
    push_availability?: boolean;
    read_external?: boolean;
  };

  await db
    .update(calendar_connections)
    .set({
      ...(push_bookings !== undefined && { push_bookings }),
      ...(push_availability !== undefined && { push_availability }),
      ...(read_external !== undefined && { read_external }),
      updated_at: new Date(),
    })
    .where(eq(calendar_connections.user_id, userId));

  res.json({ ok: true });
}

// ── Webhook handlers ────────────────────────────────────────────────────────

export async function googleWebhookHandler(req: Request, res: Response): Promise<void> {
  // Google sends a sync notification; acknowledge immediately then trigger read sync
  res.status(200).send();

  const channelId = req.headers["x-goog-channel-id"] as string | undefined;
  if (!channelId) return;

  // Find the connection by channel id
  const [conn] = await db
    .select({ user_id: calendar_connections.user_id })
    .from(calendar_connections)
    .where(eq(calendar_connections.webhook_channel_id, channelId))
    .limit(1);

  if (!conn) return;

  try {
    const { readExternalEvents } = await import("../services/calendarSync.service");
    await readExternalEvents(conn.user_id);
  } catch (err) {
    console.error("[calendar] Google webhook read failed:", err);
  }
}

export async function outlookWebhookHandler(req: Request, res: Response): Promise<void> {
  // Graph requires validation token echo on subscription creation
  const validationToken = req.query.validationToken as string | undefined;
  if (validationToken) {
    res.status(200).contentType("text/plain").send(validationToken);
    return;
  }

  res.status(202).send();

  const notifications: any[] = req.body?.value ?? [];
  for (const n of notifications) {
    const clientState: string = n.clientState ?? "";
    const uid = parseInt(clientState.replace("el-", ""), 10);
    if (!uid) continue;
    try {
      const { readExternalEvents } = await import("../services/calendarSync.service");
      await readExternalEvents(uid);
    } catch (err) {
      console.error("[calendar] Outlook webhook read failed:", err);
    }
  }
}

// ── Availability ────────────────────────────────────────────────────────────

export async function listAvailability(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { from, to } = req.query as { from?: string; to?: string };

  const query = db
    .select()
    .from(freelancer_date_availability)
    .where(eq(freelancer_date_availability.freelancer_id, userId));

  const rows = await (from && to
    ? db
        .select()
        .from(freelancer_date_availability)
        .where(
          and(
            eq(freelancer_date_availability.freelancer_id, userId),
            gte(freelancer_date_availability.date, from),
            lte(freelancer_date_availability.date, to)
          )
        )
    : query);

  res.json(rows);
}

export async function setAvailability(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { date, status, note } = req.body as {
    date: string;
    status: "available" | "tentative" | "unavailable";
    note?: string;
  };

  if (!date || !status) {
    res.status(400).json({ error: "date and status are required" });
    return;
  }

  const [row] = await db
    .insert(freelancer_date_availability)
    .values({ freelancer_id: userId, date, status, note: note ?? null })
    .onConflictDoUpdate({
      target: [freelancer_date_availability.freelancer_id, freelancer_date_availability.date],
      set: { status, note: note ?? null, updated_at: new Date() },
    })
    .returning();

  // Push to calendar if status is unavailable (and optionally tentative - user preference)
  if (status === "unavailable") {
    // Look for existing calendar event id in a simple per-user JSON store (use booking_event_ids pattern)
    const eventId = await syncAvailabilityDay(userId, date, null);
    // Store the returned event id for later delete/update (future enhancement)
    console.log(`[calendar] Availability ${date} -> eventId: ${eventId}`);
  }

  res.json(row);
}

export async function deleteAvailability(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { date } = req.params;

  await db
    .delete(freelancer_date_availability)
    .where(
      and(
        eq(freelancer_date_availability.freelancer_id, userId),
        eq(freelancer_date_availability.date, date)
      )
    );

  res.json({ ok: true });
}
