import { OAuth2Client } from "google-auth-library";
import { db } from "../config/db";
import { calendar_connections } from "@shared/schema";
import { eq } from "drizzle-orm";
import { encryptToken, decryptToken } from "./crypto.service";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];

const BASE_URL = process.env.FRONTEND_URL || "https://eventlink.one";
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";

export function getRedirectUri(): string {
  return `${BASE_URL}/api/calendar/google/callback`;
}

export function makeOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export function getGoogleAuthUrl(state: string): string {
  const client = makeOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/** Exchange the OAuth code for tokens and persist the connection. */
export async function connectGoogleCalendar(userId: number, code: string): Promise<void> {
  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) throw new Error("No access token returned from Google");

  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  await db
    .insert(calendar_connections)
    .values({
      user_id: userId,
      provider: "google",
      access_token_encrypted: encryptToken(tokens.access_token),
      refresh_token_encrypted: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      token_expires_at: expiresAt,
      status: "active",
    })
    .onConflictDoUpdate({
      target: calendar_connections.user_id,
      set: {
        provider: "google",
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token
          ? encryptToken(tokens.refresh_token)
          : undefined,
        token_expires_at: expiresAt,
        status: "active",
        last_error: null,
        updated_at: new Date(),
      },
    });
}

/** Returns a valid access token, refreshing silently if needed. */
export async function getValidGoogleToken(userId: number): Promise<string> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(eq(calendar_connections.user_id, userId))
    .limit(1);

  if (!conn || conn.provider !== "google") {
    throw new Error("No Google Calendar connection for this user");
  }

  const accessToken = decryptToken(conn.access_token_encrypted);
  const expires = conn.token_expires_at;
  const needsRefresh = !expires || expires.getTime() - Date.now() < 60_000;

  if (!needsRefresh) return accessToken;

  if (!conn.refresh_token_encrypted) {
    await db
      .update(calendar_connections)
      .set({ status: "needs_reconnect", last_error: "No refresh token; user must reconnect" })
      .where(eq(calendar_connections.user_id, userId));
    throw new Error("User must reconnect Google Calendar");
  }

  const refreshToken = decryptToken(conn.refresh_token_encrypted);
  const client = makeOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) throw new Error("Refresh returned no access token");

    const newExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
    await db
      .update(calendar_connections)
      .set({
        access_token_encrypted: encryptToken(credentials.access_token),
        token_expires_at: newExpiry,
        updated_at: new Date(),
      })
      .where(eq(calendar_connections.user_id, userId));

    return credentials.access_token;
  } catch (err) {
    await db
      .update(calendar_connections)
      .set({ status: "needs_reconnect", last_error: "Token refresh failed; user must reconnect" })
      .where(eq(calendar_connections.user_id, userId));
    throw err;
  }
}

type BookingForCalendar = {
  id: number;
  status: string;
  callTime: string | null;
  venueAddress: string | null;
  agreedRate: string | null;
  job: {
    title: string;
    company: string;
    event_date: string | null;
    end_date: string | null;
  };
};

/** Build a freelancer-centric Google Calendar event body. */
export function buildGoogleEvent(booking: BookingForCalendar): object {
  const statusPrefix = formatStatusPrefix(booking.status);
  const title = `${statusPrefix} ${booking.job.title} — ${booking.job.company}`;

  const descParts = [
    `Client: ${booking.job.company}`,
    booking.venueAddress ? `Venue: ${booking.venueAddress}` : null,
    booking.callTime ? `Call time: ${booking.callTime}` : null,
    booking.agreedRate ? `Agreed rate: ${booking.agreedRate}` : null,
    `Status: ${booking.status}`,
    ``,
    `EventLink booking: ${process.env.FRONTEND_URL || "https://eventlink.one"}/dashboard?tab=bookings`,
  ]
    .filter(Boolean)
    .join("\n");

  const { start, end } = buildEventTimes(
    booking.job.event_date,
    booking.job.end_date,
    booking.callTime
  );

  return {
    summary: title,
    description: descParts,
    location: booking.venueAddress ?? undefined,
    start,
    end,
    extendedProperties: {
      private: {
        eventlink_booking_id: String(booking.id),
        eventlink_kind: "booking",
      },
    },
  };
}

function buildEventTimes(
  eventDate: string | null,
  endDate: string | null,
  callTime: string | null
): { start: object; end: object } {
  if (!eventDate) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: { date: today }, end: { date: today } };
  }

  if (!callTime) {
    // All-day event
    const endDateStr = endDate ?? eventDate;
    return { start: { date: eventDate }, end: { date: endDateStr } };
  }

  // Timed event: callTime is the start, default 8 hours for a get-out
  const startDt = new Date(`${eventDate}T${callTime}:00`);
  const endDt = new Date(startDt.getTime() + 8 * 60 * 60 * 1000);
  return {
    start: { dateTime: startDt.toISOString() },
    end: { dateTime: endDt.toISOString() },
  };
}

function formatStatusPrefix(status: string): string {
  const map: Record<string, string> = {
    enquired: "[Enquired]",
    confirmed: "[Confirmed]",
    briefed: "[Briefed]",
    completed: "[Completed]",
    cancelled: "[Cancelled]",
  };
  return map[status] ?? `[${status}]`;
}

/** Create or update an event in the user's primary calendar. */
export async function upsertGoogleEvent(
  userId: number,
  booking: BookingForCalendar,
  existingEventId?: string | null
): Promise<string> {
  const token = await getValidGoogleToken(userId);
  const body = buildGoogleEvent(booking);

  if (existingEventId) {
    const res = await fetch(`${GOOGLE_API}/calendars/primary/events/${existingEventId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Calendar update failed: ${err}`);
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  const res = await fetch(`${GOOGLE_API}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar create failed: ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Delete an event (booking cancelled / connection removed). */
export async function deleteGoogleEvent(userId: number, eventId: string): Promise<void> {
  const token = await getValidGoogleToken(userId);
  const res = await fetch(`${GOOGLE_API}/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 410) {
    const err = await res.text();
    throw new Error(`Google Calendar delete failed: ${err}`);
  }
}

/** Push an availability block (all-day) event. */
export async function upsertGoogleAvailability(
  userId: number,
  date: string,
  existingEventId?: string | null
): Promise<string> {
  const token = await getValidGoogleToken(userId);
  const body = {
    summary: "Unavailable — EventLink",
    start: { date },
    end: { date },
    extendedProperties: {
      private: { eventlink_kind: "availability", eventlink_date: date },
    },
  };

  const url = existingEventId
    ? `${GOOGLE_API}/calendars/primary/events/${existingEventId}`
    : `${GOOGLE_API}/calendars/primary/events`;
  const method = existingEventId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar availability upsert failed: ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Fetch incremental changes using syncToken; returns new events and next token. */
export async function fetchGoogleDelta(
  userId: number,
  syncToken?: string | null
): Promise<{ events: any[]; nextSyncToken: string | null; fullResyncNeeded: boolean }> {
  const token = await getValidGoogleToken(userId);
  const url = syncToken
    ? `${GOOGLE_API}/calendars/primary/events?syncToken=${encodeURIComponent(syncToken)}&singleEvents=true`
    : `${GOOGLE_API}/calendars/primary/events?timeMin=${new Date(Date.now() - 30 * 86400_000).toISOString()}&singleEvents=true&maxResults=250`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 410) {
    return { events: [], nextSyncToken: null, fullResyncNeeded: true };
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar list failed: ${err}`);
  }
  const data = (await res.json()) as { items?: any[]; nextSyncToken?: string };
  return {
    events: data.items ?? [],
    nextSyncToken: data.nextSyncToken ?? null,
    fullResyncNeeded: false,
  };
}

/** Register a push-notification watch channel for primary calendar. */
export async function registerGoogleWebhook(
  userId: number,
  webhookUrl: string
): Promise<{ channelId: string; resourceId: string; expiration: Date }> {
  const token = await getValidGoogleToken(userId);
  const channelId = `el-${userId}-${Date.now()}`;

  const res = await fetch(`${GOOGLE_API}/calendars/primary/events/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar watch failed: ${err}`);
  }
  const data = (await res.json()) as {
    id: string;
    resourceId: string;
    expiration: string;
  };
  return {
    channelId: data.id,
    resourceId: data.resourceId,
    expiration: new Date(Number(data.expiration)),
  };
}

/** Fetch events from the user's primary Google Calendar for a date range. */
export async function fetchExternalGoogleEvents(
  userId: number,
  from: string,
  to: string
): Promise<{ id: string; title: string; start: string; end: string; allDay: boolean }[]> {
  const token = await getValidGoogleToken(userId);
  const url =
    `${GOOGLE_API}/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(new Date(from).toISOString())}` +
    `&timeMax=${encodeURIComponent(new Date(to).toISOString())}` +
    `&singleEvents=true&maxResults=250&orderBy=startTime`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status}`);
  }
  const data = (await res.json()) as { items?: any[] };
  return (data.items ?? []).map((ev: any) => ({
    id: ev.id,
    title: ev.summary ?? "(no title)",
    start: ev.start?.dateTime ?? ev.start?.date ?? from,
    end: ev.end?.dateTime ?? ev.end?.date ?? to,
    allDay: !ev.start?.dateTime,
  }));
}

/** Stop a push-notification channel. */
export async function stopGoogleWebhook(
  userId: number,
  channelId: string,
  resourceId: string
): Promise<void> {
  const token = await getValidGoogleToken(userId);
  await fetch(`${GOOGLE_API}/channels/stop`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: channelId, resourceId }),
  });
}
