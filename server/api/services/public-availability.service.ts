import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { bookings, freelancer_date_availability, jobs } from "@shared/schema";
import {
  buildPublicAvailability,
  datesBetween,
  PUBLIC_WINDOW_DAYS,
  type PublicAvailability,
} from "@shared/public-availability";
import { jobLastDay, ukToday } from "@shared/job-dates";
import { db } from "../config/db";

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * The public calendar for one freelancer: today to +90 days. Reads ONLY date,
 * status and updated_at from their marks — never the note — and only the
 * dates of their confirmed bookings, never who or where. External calendar
 * events are not read at all.
 */
export async function publicAvailabilityForFreelancer(
  freelancerId: number,
  from: string = ukToday(),
  to: string = addDays(from, PUBLIC_WINDOW_DAYS)
): Promise<PublicAvailability> {
  const [marks, booked] = await Promise.all([
    db
      .select({
        date: freelancer_date_availability.date,
        status: freelancer_date_availability.status,
        updated_at: freelancer_date_availability.updated_at,
      })
      .from(freelancer_date_availability)
      .where(
        and(
          eq(freelancer_date_availability.freelancer_id, freelancerId),
          gte(freelancer_date_availability.date, from),
          lte(freelancer_date_availability.date, to)
        )
      ),
    db
      .select({
        event_date: jobs.event_date,
        end_date: jobs.end_date,
        duration_type: jobs.duration_type,
        days: jobs.days,
      })
      .from(bookings)
      .innerJoin(jobs, eq(jobs.id, bookings.jobId))
      .where(
        and(
          eq(bookings.freelancerId, freelancerId),
          inArray(bookings.status, ["confirmed", "briefed", "completed"])
        )
      ),
  ]);

  const bookedDates: string[] = [];
  for (const b of booked) {
    const start = b.event_date?.slice(0, 10);
    const last = jobLastDay(b);
    if (!start || !last || last < from || start > to) continue;
    bookedDates.push(...datesBetween(start < from ? from : start, last > to ? to : last));
  }
  return buildPublicAvailability({ from, to, marks, bookedDates });
}
