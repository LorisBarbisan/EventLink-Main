import { db } from "../config/db";
import { calendar_connections } from "@shared/schema";
import { eq } from "drizzle-orm";
import { encryptToken, decryptToken } from "./crypto.service";

const GRAPH = "https://graph.microsoft.com/v1.0/me";
const TENANT = "common";
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const AUTH_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
const SCOPES = "Calendars.ReadWrite offline_access openid email User.Read";

const BASE_URL = process.env.FRONTEND_URL || "https://eventlink.one";

export function getOutlookRedirectUri(): string {
  return process.env.MICROSOFT_REDIRECT_URI || `${BASE_URL}/api/calendar/outlook/callback`;
}

export function getOutlookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: getOutlookRedirectUri(),
    scope: SCOPES,
    state,
    response_mode: "query",
  });
  return `${AUTH_URL}?${params}`;
}

/** Exchange the OAuth code for tokens and persist the connection. */
export async function connectOutlookCalendar(userId: number, code: string): Promise<void> {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    redirect_uri: getOutlookRedirectUri(),
    grant_type: "authorization_code",
    code,
    scope: SCOPES,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outlook token exchange failed: ${err}`);
  }
  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

  await db
    .insert(calendar_connections)
    .values({
      user_id: userId,
      provider: "outlook",
      access_token_encrypted: encryptToken(tokens.access_token),
      refresh_token_encrypted: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      token_expires_at: expiresAt,
      status: "active",
    })
    .onConflictDoUpdate({
      target: calendar_connections.user_id,
      set: {
        provider: "outlook",
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
export async function getValidOutlookToken(userId: number): Promise<string> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(eq(calendar_connections.user_id, userId))
    .limit(1);

  if (!conn || conn.provider !== "outlook") {
    throw new Error("No Outlook Calendar connection for this user");
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
    throw new Error("User must reconnect Outlook Calendar");
  }

  const refreshToken = decryptToken(conn.refresh_token_encrypted);
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPES,
  });

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(await res.text());
    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const newExpiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;
    await db
      .update(calendar_connections)
      .set({
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token
          ? encryptToken(tokens.refresh_token)
          : undefined,
        token_expires_at: newExpiry,
        updated_at: new Date(),
      })
      .where(eq(calendar_connections.user_id, userId));
    return tokens.access_token;
  } catch (err) {
    await db
      .update(calendar_connections)
      .set({
        status: "needs_reconnect",
        last_error: "Token refresh failed; user must reconnect",
      })
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

function buildOutlookEventTimes(
  eventDate: string | null,
  endDate: string | null,
  callTime: string | null
): { start: object; end: object; isAllDay: boolean } {
  if (!eventDate) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      start: { dateTime: `${today}T00:00:00`, timeZone: "UTC" },
      end: { dateTime: `${today}T23:59:00`, timeZone: "UTC" },
      isAllDay: true,
    };
  }

  if (!callTime) {
    const endDateStr = endDate ?? eventDate;
    return {
      start: { dateTime: `${eventDate}T00:00:00`, timeZone: "UTC" },
      end: { dateTime: `${endDateStr}T23:59:00`, timeZone: "UTC" },
      isAllDay: true,
    };
  }

  const startDt = new Date(`${eventDate}T${callTime}:00`);
  const endDt = new Date(startDt.getTime() + 8 * 60 * 60 * 1000);
  return {
    start: { dateTime: startDt.toISOString(), timeZone: "UTC" },
    end: { dateTime: endDt.toISOString(), timeZone: "UTC" },
    isAllDay: false,
  };
}

function buildOutlookEvent(booking: BookingForCalendar): object {
  const statusPrefix = formatStatusPrefix(booking.status);
  const subject = `${statusPrefix} ${booking.job.title} — ${booking.job.company}`;
  const { start, end, isAllDay } = buildOutlookEventTimes(
    booking.job.event_date,
    booking.job.end_date,
    booking.callTime
  );

  const bodyLines: string[] = [
    `Client: ${booking.job.company}`,
    booking.venueAddress ? `Venue: ${booking.venueAddress}` : "",
    booking.callTime ? `Call time: ${booking.callTime}` : "",
    booking.agreedRate ? `Agreed rate: ${booking.agreedRate}` : "",
    `Status: ${booking.status}`,
    "",
    `EventLink: ${process.env.FRONTEND_URL || "https://eventlink.one"}/dashboard?tab=bookings`,
  ].filter((l, i) => i === 0 || l !== "");

  return {
    subject,
    body: { contentType: "Text", content: bodyLines.join("\n") },
    start,
    end,
    isAllDay,
    location: booking.venueAddress ? { displayName: booking.venueAddress } : undefined,
    singleValueExtendedProperties: [
      {
        id: "String {00020329-0000-0000-C000-000000000046} Name eventlink_booking_id",
        value: String(booking.id),
      },
      { id: "String {00020329-0000-0000-C000-000000000046} Name eventlink_kind", value: "booking" },
    ],
  };
}

export async function upsertOutlookEvent(
  userId: number,
  booking: BookingForCalendar,
  existingEventId?: string | null
): Promise<string> {
  const token = await getValidOutlookToken(userId);
  const body = buildOutlookEvent(booking);

  if (existingEventId) {
    const res = await fetch(`${GRAPH}/events/${existingEventId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Outlook Calendar update failed: ${err}`);
    }
    return existingEventId;
  }

  const res = await fetch(`${GRAPH}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outlook Calendar create failed: ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function deleteOutlookEvent(userId: number, eventId: string): Promise<void> {
  const token = await getValidOutlookToken(userId);
  const res = await fetch(`${GRAPH}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Outlook Calendar delete failed: ${err}`);
  }
}

export async function upsertOutlookAvailability(
  userId: number,
  date: string,
  existingEventId?: string | null
): Promise<string> {
  const token = await getValidOutlookToken(userId);
  const body = {
    subject: "Unavailable — EventLink",
    start: { dateTime: `${date}T00:00:00`, timeZone: "UTC" },
    end: { dateTime: `${date}T23:59:00`, timeZone: "UTC" },
    isAllDay: true,
    singleValueExtendedProperties: [
      {
        id: "String {00020329-0000-0000-C000-000000000046} Name eventlink_kind",
        value: "availability",
      },
      { id: "String {00020329-0000-0000-C000-000000000046} Name eventlink_date", value: date },
    ],
  };

  if (existingEventId) {
    const res = await fetch(`${GRAPH}/events/${existingEventId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Outlook availability update failed: ${err}`);
    }
    return existingEventId;
  }

  const res = await fetch(`${GRAPH}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outlook availability create failed: ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Fetch delta changes via calendarView/delta. */
export async function fetchOutlookDelta(
  userId: number,
  deltaLink?: string | null
): Promise<{ events: any[]; nextDeltaLink: string | null }> {
  const token = await getValidOutlookToken(userId);
  const url =
    deltaLink ??
    `${GRAPH}/calendarView/delta?startDateTime=${new Date(Date.now() - 30 * 86400_000).toISOString()}&endDateTime=${new Date(Date.now() + 90 * 86400_000).toISOString()}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outlook delta failed: ${err}`);
  }
  const data = (await res.json()) as { value?: any[]; "@odata.deltaLink"?: string };
  return {
    events: data.value ?? [],
    nextDeltaLink: data["@odata.deltaLink"] ?? null,
  };
}

/** Register a Graph subscription (webhook) for calendar changes. */
export async function registerOutlookWebhook(
  userId: number,
  webhookUrl: string
): Promise<{ subscriptionId: string; expiration: Date }> {
  const token = await getValidOutlookToken(userId);
  const expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 60_000); // ~3 days

  const res = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      changeType: "created,updated,deleted",
      notificationUrl: webhookUrl,
      resource: "me/events",
      expirationDateTime: expiration.toISOString(),
      clientState: `el-${userId}`,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outlook webhook registration failed: ${err}`);
  }
  const data = (await res.json()) as { id: string; expirationDateTime: string };
  return {
    subscriptionId: data.id,
    expiration: new Date(data.expirationDateTime),
  };
}

/** Renew an existing Graph subscription. */
export async function renewOutlookWebhook(userId: number, subscriptionId: string): Promise<Date> {
  const token = await getValidOutlookToken(userId);
  const expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 60_000);

  const res = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expirationDateTime: expiration.toISOString() }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outlook webhook renewal failed: ${err}`);
  }
  return expiration;
}
