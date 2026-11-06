import { db } from "../config/db";
import { calendar_connections, bookings, jobs } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  upsertGoogleEvent,
  deleteGoogleEvent,
  fetchGoogleDelta,
  upsertGoogleAvailability,
} from "./googleCalendar.service";
import {
  upsertOutlookEvent,
  deleteOutlookEvent,
  fetchOutlookDelta,
  upsertOutlookAvailability,
} from "./outlookCalendar.service";

const SYNCABLE_STATUSES = ["enquired", "confirmed", "briefed", "completed"];

/** Sync all bookings for a freelancer to their connected calendar. */
export async function syncAllBookings(userId: number): Promise<void> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(
      and(eq(calendar_connections.user_id, userId), eq(calendar_connections.push_bookings, true))
    )
    .limit(1);

  if (!conn) return;

  const rows = await db
    .select({
      booking: bookings,
      job: jobs,
    })
    .from(bookings)
    .innerJoin(jobs, eq(bookings.jobId, jobs.id))
    .where(and(eq(bookings.freelancerId, userId), inArray(bookings.status, SYNCABLE_STATUSES)));

  const eventIds: Record<string, string> = (conn.booking_event_ids as Record<string, string>) ?? {};

  for (const { booking, job } of rows) {
    const payload = {
      id: booking.id,
      status: booking.status,
      callTime: booking.callTime,
      venueAddress: booking.venueAddress,
      agreedRate: booking.agreedRate,
      job: {
        title: job.title,
        company: job.company,
        event_date: job.event_date,
        end_date: job.end_date,
      },
    };

    try {
      const existing = eventIds[String(booking.id)] ?? null;
      let eventId: string;

      if (conn.provider === "google") {
        eventId = await upsertGoogleEvent(userId, payload, existing);
      } else {
        eventId = await upsertOutlookEvent(userId, payload, existing);
      }

      eventIds[String(booking.id)] = eventId;
    } catch (err) {
      console.error(`[calendarSync] Failed to sync booking ${booking.id} for user ${userId}:`, err);
    }
  }

  await db
    .update(calendar_connections)
    .set({ booking_event_ids: eventIds, last_write_sync_at: new Date() })
    .where(eq(calendar_connections.user_id, userId));
}

/** Sync a single booking (called after status change). */
export async function syncSingleBooking(userId: number, bookingId: number): Promise<void> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(
      and(eq(calendar_connections.user_id, userId), eq(calendar_connections.push_bookings, true))
    )
    .limit(1);

  if (!conn) return;

  const [row] = await db
    .select({ booking: bookings, job: jobs })
    .from(bookings)
    .innerJoin(jobs, eq(bookings.jobId, jobs.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.freelancerId, userId)))
    .limit(1);

  if (!row) return;

  const eventIds: Record<string, string> = (conn.booking_event_ids as Record<string, string>) ?? {};
  const existing = eventIds[String(bookingId)] ?? null;

  const payload = {
    id: row.booking.id,
    status: row.booking.status,
    callTime: row.booking.callTime,
    venueAddress: row.booking.venueAddress,
    agreedRate: row.booking.agreedRate,
    job: {
      title: row.job.title,
      company: row.job.company,
      event_date: row.job.event_date,
      end_date: row.job.end_date,
    },
  };

  try {
    let eventId: string;

    if (row.booking.status === "cancelled") {
      if (existing) {
        if (conn.provider === "google") {
          await deleteGoogleEvent(userId, existing);
        } else {
          await deleteOutlookEvent(userId, existing);
        }
        delete eventIds[String(bookingId)];
      }
    } else if (SYNCABLE_STATUSES.includes(row.booking.status)) {
      if (conn.provider === "google") {
        eventId = await upsertGoogleEvent(userId, payload, existing);
      } else {
        eventId = await upsertOutlookEvent(userId, payload, existing);
      }
      eventIds[String(bookingId)] = eventId!;
    }

    await db
      .update(calendar_connections)
      .set({ booking_event_ids: eventIds, last_write_sync_at: new Date() })
      .where(eq(calendar_connections.user_id, userId));
  } catch (err) {
    console.error(`[calendarSync] Failed to sync booking ${bookingId} for user ${userId}:`, err);
  }
}

/** Push an availability block into the connected calendar. */
export async function syncAvailabilityDay(
  userId: number,
  date: string,
  existingEventId?: string | null
): Promise<string | null> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(
      and(
        eq(calendar_connections.user_id, userId),
        eq(calendar_connections.push_availability, true)
      )
    )
    .limit(1);

  if (!conn) return null;

  try {
    if (conn.provider === "google") {
      return await upsertGoogleAvailability(userId, date, existingEventId);
    } else {
      return await upsertOutlookAvailability(userId, date, existingEventId);
    }
  } catch (err) {
    console.error(`[calendarSync] Failed to push availability for ${date}, user ${userId}:`, err);
    return null;
  }
}

/** Remove an availability block from the connected calendar. */
export async function deleteAvailabilityEvent(userId: number, eventId: string): Promise<void> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(eq(calendar_connections.user_id, userId))
    .limit(1);

  if (!conn) return;

  try {
    if (conn.provider === "google") {
      await deleteGoogleEvent(userId, eventId);
    } else {
      await deleteOutlookEvent(userId, eventId);
    }
  } catch (err) {
    console.error(`[calendarSync] Failed to delete availability event ${eventId}:`, err);
  }
}

/** Pull external calendar events and store them as busy time (read path). */
export async function readExternalEvents(userId: number): Promise<void> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(
      and(eq(calendar_connections.user_id, userId), eq(calendar_connections.read_external, true))
    )
    .limit(1);

  if (!conn) return;

  try {
    if (conn.provider === "google") {
      const { events, nextSyncToken } = await fetchGoogleDelta(userId, conn.sync_token ?? null);
      // Skip our own events; store external ones as busy time (future: external_busy_times table)
      const external = events.filter((e: any) => {
        const ep = e.extendedProperties?.private ?? {};
        return !ep.eventlink_booking_id && !ep.eventlink_kind;
      });
      console.log(`[calendarSync] Google: ${external.length} external events for user ${userId}`);
      if (nextSyncToken) {
        await db
          .update(calendar_connections)
          .set({ sync_token: nextSyncToken, last_read_sync_at: new Date() })
          .where(eq(calendar_connections.user_id, userId));
      }
    } else {
      const { events, nextDeltaLink } = await fetchOutlookDelta(userId, conn.delta_link);
      const external = events.filter((e: any) => {
        const exts: any[] = e.singleValueExtendedProperties ?? [];
        return !exts.some((x: any) => x.id?.includes("eventlink_kind"));
      });
      console.log(`[calendarSync] Outlook: ${external.length} external events for user ${userId}`);
      if (nextDeltaLink) {
        await db
          .update(calendar_connections)
          .set({ delta_link: nextDeltaLink, last_read_sync_at: new Date() })
          .where(eq(calendar_connections.user_id, userId));
      }
    }
  } catch (err) {
    console.error(`[calendarSync] readExternalEvents failed for user ${userId}:`, err);
  }
}

/** Remove all EventLink-owned events from the calendar on disconnect. */
export async function disconnectCalendar(userId: number): Promise<void> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(eq(calendar_connections.user_id, userId))
    .limit(1);

  if (!conn) return;

  const eventIds: Record<string, string> = (conn.booking_event_ids as Record<string, string>) ?? {};

  for (const eventId of Object.values(eventIds)) {
    try {
      if (conn.provider === "google") {
        await deleteGoogleEvent(userId, eventId);
      } else {
        await deleteOutlookEvent(userId, eventId);
      }
    } catch {
      // Best effort — calendar may already not have the event
    }
  }

  await db.delete(calendar_connections).where(eq(calendar_connections.user_id, userId));
}
