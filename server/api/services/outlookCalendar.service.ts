import { db } from "../config/db.js";
import { calendar_connections } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;
const MICROSOFT_REDIRECT_URI =
  process.env.MICROSOFT_CALENDAR_REDIRECT_URI ??
  `${process.env.APP_URL ?? "http://localhost:3000"}/api/calendar/outlook/callback`;
const MICROSOFT_TENANT = "common";

export function getOutlookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: MICROSOFT_REDIRECT_URI,
    scope: "Calendars.ReadWrite offline_access User.Read",
    response_mode: "query",
    state,
  });
  return `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize?${params}`;
}

export async function connectOutlookCalendar(employerId: number, code: string) {
  const response = await fetch(
    `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: MICROSOFT_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    }
  );
  if (!response.ok) throw new Error("Outlook token exchange failed");
  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await db
    .insert(calendar_connections)
    .values({
      employerId,
      provider: "outlook",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt: expiresAt,
      calendarId: "primary",
    })
    .onConflictDoUpdate({
      target: calendar_connections.employerId,
      set: {
        provider: "outlook",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    });
}

export async function getValidOutlookToken(employerId: number): Promise<string> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(eq(calendar_connections.employerId, employerId));
  if (!conn || conn.provider !== "outlook") throw new Error("No Outlook connection");
  const isExpired =
    conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;
  if (!isExpired) return conn.accessToken;
  if (!conn.refreshToken) throw new Error("No refresh token — employer must reconnect");
  const response = await fetch(
    `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        refresh_token: conn.refreshToken,
        grant_type: "refresh_token",
      }),
    }
  );
  if (!response.ok) throw new Error("Outlook token refresh failed");
  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await db
    .update(calendar_connections)
    .set({ accessToken: tokens.access_token, tokenExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(calendar_connections.employerId, employerId));
  return tokens.access_token;
}

function buildOutlookEvent(booking: any): object {
  const dateStr =
    booking.eventDate ?? booking.createdAt?.toISOString().split("T")[0];
  const STATUS_LABELS: Record<string, string> = {
    enquired: "[Enquired]",
    confirmed: "[Confirmed]",
    briefed: "[Briefed]",
    completed: "[Completed]",
    cancelled: "[Cancelled]",
  };
  const prefix = STATUS_LABELS[booking.status] ?? "";
  const subject = `${prefix} ${booking.freelancerName ?? "Booking"} — EventLink`.trim();
  const body = [
    booking.freelancerName ? `Freelancer: ${booking.freelancerName}` : "",
    booking.roleRequired ? `Role: ${booking.roleRequired}` : "",
    booking.agreedRate ? `Rate: ${booking.agreedRate}` : "",
    booking.employerNotes ? `Notes: ${booking.employerNotes}` : "",
    `Status: ${booking.status}`,
    `EventLink booking ID: ${booking.id}`,
  ]
    .filter(Boolean)
    .join("<br>");
  let start, end;
  if (booking.callTime) {
    const startDT = new Date(`${dateStr}T${booking.callTime}:00`);
    const endDT = new Date(startDT.getTime() + 8 * 60 * 60 * 1000);
    start = { dateTime: startDT.toISOString(), timeZone: "Europe/London" };
    end = { dateTime: endDT.toISOString(), timeZone: "Europe/London" };
  } else {
    start = { date: dateStr };
    end = { date: dateStr };
  }
  return {
    subject,
    body: { contentType: "HTML", content: body },
    location: booking.venueAddress ? { displayName: booking.venueAddress } : undefined,
    start,
    end,
    isAllDay: !booking.callTime,
  };
}

export async function createOutlookEvent(
  employerId: number,
  booking: any
): Promise<string> {
  const token = await getValidOutlookToken(employerId);
  const event = buildOutlookEvent(booking);
  const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Outlook event create failed: ${err}`);
  }
  const data = await response.json();
  return data.id;
}

export async function updateOutlookEvent(
  employerId: number,
  outlookEventId: string,
  booking: any
): Promise<void> {
  const token = await getValidOutlookToken(employerId);
  const event = buildOutlookEvent(booking);
  await fetch(`https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
}

export async function deleteOutlookEvent(
  employerId: number,
  outlookEventId: string
): Promise<void> {
  const token = await getValidOutlookToken(employerId);
  await fetch(`https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
