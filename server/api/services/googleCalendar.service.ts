import { OAuth2Client } from "google-auth-library";
import { db } from "../config/db.js";
import { calendar_connections } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export function getRedirectUri(req?: { headers: { host?: string; "x-forwarded-host"?: string; "x-forwarded-proto"?: string } }): string {
  // 1. Explicit env var always wins
  if (process.env.GOOGLE_CALENDAR_REDIRECT_URI) {
    console.log("[Google Calendar] redirect URI from env:", process.env.GOOGLE_CALENDAR_REDIRECT_URI);
    return process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  }
  // 2. Derive from the real public host (Replit uses x-forwarded-host behind its proxy)
  if (req) {
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
    const proto = (req.headers["x-forwarded-proto"] as string) || (host.includes("localhost") ? "http" : "https");
    console.log("[Google Calendar] host:", host, "proto:", proto);
    if (host) return `${proto}://${host}/api/calendar/google/callback`;
  }
  // 3. APP_URL fallback
  return `${process.env.APP_URL ?? "http://localhost:3000"}/api/calendar/google/callback`;
}

export function getGoogleOAuthClient(req?: { headers: any }) {
  const redirectUri = getRedirectUri(req);
  console.log("[Google Calendar] Using redirect URI:", redirectUri);
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
}

export function getGoogleAuthUrl(state: string, req?: { headers: any }): string {
  const redirectUri = getRedirectUri(req);
  const client = getGoogleOAuthClient(req);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    redirect_uri: redirectUri,
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
}

export async function connectGoogleCalendar(employerId: number, code: string, req?: { headers: any }) {
  const client = getGoogleOAuthClient(req);
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) throw new Error("No access token returned from Google");
  await db
    .insert(calendar_connections)
    .values({
      employerId,
      provider: "google",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      calendarId: "primary",
    })
    .onConflictDoUpdate({
      target: calendar_connections.employerId,
      set: {
        provider: "google",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        updatedAt: new Date(),
      },
    });
}

export async function getValidGoogleToken(employerId: number): Promise<string> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(eq(calendar_connections.employerId, employerId));
  if (!conn || conn.provider !== "google") throw new Error("No Google Calendar connection");
  const isExpired =
    conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;
  if (!isExpired) return conn.accessToken;
  if (!conn.refreshToken) throw new Error("No refresh token — employer must reconnect");
  const client = getGoogleOAuthClient();
  client.setCredentials({ refresh_token: conn.refreshToken });
  const { credentials } = await client.refreshAccessToken();
  await db
    .update(calendar_connections)
    .set({
      accessToken: credentials.access_token!,
      tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      updatedAt: new Date(),
    })
    .where(eq(calendar_connections.employerId, employerId));
  return credentials.access_token!;
}

function buildGoogleEvent(booking: any): object {
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
  const title = `${prefix} ${booking.freelancerName ?? "Booking"} — EventLink`.trim();
  const description = [
    booking.freelancerName ? `Freelancer: ${booking.freelancerName}` : "",
    booking.roleRequired ? `Role: ${booking.roleRequired}` : "",
    booking.agreedRate ? `Rate: ${booking.agreedRate}` : "",
    booking.employerNotes ? `Notes: ${booking.employerNotes}` : "",
    `Status: ${booking.status}`,
    `EventLink booking ID: ${booking.id}`,
  ]
    .filter(Boolean)
    .join("\n");
  let start, end;
  if (booking.callTime) {
    const startDateTime = new Date(`${dateStr}T${booking.callTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 8 * 60 * 60 * 1000);
    start = { dateTime: startDateTime.toISOString(), timeZone: "Europe/London" };
    end = { dateTime: endDateTime.toISOString(), timeZone: "Europe/London" };
  } else {
    start = { date: dateStr };
    end = { date: dateStr };
  }
  return {
    summary: title,
    description,
    location: booking.venueAddress ?? undefined,
    start,
    end,
  };
}

export async function createGoogleEvent(
  employerId: number,
  booking: any
): Promise<string> {
  const token = await getValidGoogleToken(employerId);
  const event = buildGoogleEvent(booking);
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Calendar create failed: ${err}`);
  }
  const data = await response.json();
  return data.id;
}

export async function updateGoogleEvent(
  employerId: number,
  googleEventId: string,
  booking: any
): Promise<void> {
  const token = await getValidGoogleToken(employerId);
  const event = buildGoogleEvent(booking);
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );
  if (!response.ok && response.status !== 404) {
    const err = await response.text();
    throw new Error(`Google Calendar update failed: ${err}`);
  }
}

export async function deleteGoogleEvent(
  employerId: number,
  googleEventId: string
): Promise<void> {
  const token = await getValidGoogleToken(employerId);
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}
