import { db } from "../config/db.js";
import { bookings, calendar_connections } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";
import {
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "./googleCalendar.service.js";
import {
  createOutlookEvent,
  updateOutlookEvent,
  deleteOutlookEvent,
} from "./outlookCalendar.service.js";

export async function syncAllBookings(employerId: number): Promise<{
  synced: number;
  updated: number;
  deleted: number;
  errors: string[];
}> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(eq(calendar_connections.employerId, employerId));
  if (!conn) throw new Error("No calendar connected");

  const allBookings = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      eventDate: bookings.eventDate,
      callTime: bookings.callTime,
      venueAddress: bookings.venueAddress,
      agreedRate: bookings.agreedRate,
      employerNotes: bookings.employerNotes,
      googleEventId: bookings.googleEventId,
      outlookEventId: bookings.outlookEventId,
      freelancerId: bookings.freelancerId,
    })
    .from(bookings)
    .where(eq(bookings.employerId, employerId));

  const { storage } = await import("../../storage.js");
  const enriched = await Promise.all(
    allBookings.map(async (b) => {
      const user = await storage.getUser(b.freelancerId);
      const profile = await storage.getFreelancerProfile(b.freelancerId);
      return {
        ...b,
        freelancerName: `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
        roleRequired: (profile as any)?.title ?? null,
      };
    })
  );

  const results = { synced: 0, updated: 0, deleted: 0, errors: [] as string[] };
  const isGoogle = conn.provider === "google";

  for (const booking of enriched) {
    try {
      const existingEventId = isGoogle ? booking.googleEventId : booking.outlookEventId;
      if (booking.status === "cancelled") {
        if (existingEventId) {
          if (isGoogle) await deleteGoogleEvent(employerId, existingEventId);
          else await deleteOutlookEvent(employerId, existingEventId);
          await db
            .update(bookings)
            .set(isGoogle ? { googleEventId: null } : { outlookEventId: null })
            .where(eq(bookings.id, booking.id));
          results.deleted++;
        }
      } else if (existingEventId) {
        if (isGoogle) await updateGoogleEvent(employerId, existingEventId, booking);
        else await updateOutlookEvent(employerId, existingEventId, booking);
        results.updated++;
      } else {
        const eventId = isGoogle
          ? await createGoogleEvent(employerId, booking)
          : await createOutlookEvent(employerId, booking);
        await db
          .update(bookings)
          .set(isGoogle ? { googleEventId: eventId } : { outlookEventId: eventId })
          .where(eq(bookings.id, booking.id));
        results.synced++;
      }
    } catch (err: any) {
      results.errors.push(`Booking ${booking.id}: ${err.message}`);
    }
  }
  return results;
}

export async function syncSingleBooking(
  employerId: number,
  bookingId: number
): Promise<void> {
  const [conn] = await db
    .select()
    .from(calendar_connections)
    .where(eq(calendar_connections.employerId, employerId));
  if (!conn) return;

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  if (!booking) return;

  const { storage } = await import("../../storage.js");
  const user = await storage.getUser(booking.freelancerId);
  const profile = await storage.getFreelancerProfile(booking.freelancerId);
  const enriched = {
    ...booking,
    freelancerName: `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
    roleRequired: (profile as any)?.title ?? null,
  };

  const isGoogle = conn.provider === "google";
  const existingEventId = isGoogle ? booking.googleEventId : booking.outlookEventId;

  try {
    if (booking.status === "cancelled" && existingEventId) {
      if (isGoogle) await deleteGoogleEvent(employerId, existingEventId);
      else await deleteOutlookEvent(employerId, existingEventId);
      await db
        .update(bookings)
        .set(isGoogle ? { googleEventId: null } : { outlookEventId: null })
        .where(eq(bookings.id, bookingId));
    } else if (existingEventId) {
      if (isGoogle) await updateGoogleEvent(employerId, existingEventId, enriched);
      else await updateOutlookEvent(employerId, existingEventId, enriched);
    } else if (booking.status !== "cancelled") {
      const eventId = isGoogle
        ? await createGoogleEvent(employerId, enriched)
        : await createOutlookEvent(employerId, enriched);
      await db
        .update(bookings)
        .set(isGoogle ? { googleEventId: eventId } : { outlookEventId: eventId })
        .where(eq(bookings.id, bookingId));
    }
  } catch (err: any) {
    console.error(`Calendar sync failed for booking ${bookingId}:`, err.message);
  }
}
