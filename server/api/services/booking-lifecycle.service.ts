// ============================================================
// Booking lifecycle — keeps the employer Bookings pipeline in
// sync with real application activity.
//
// Mapping (see product decision):
//   invite sent / conversation started  -> enquired
//   freelancer hired                     -> confirmed (or completed if the
//                                           job's last day has passed)
//   briefed / completed                  -> manual (handled in booking UI)
//   rejected / declined / invite withdrawn -> removed from the pipeline
//
// One booking per (job, freelancer). Transitions are forward-only: a later
// signal never regresses a booking to an earlier state, and a manually
// cancelled booking is left untouched.
// ============================================================

import { db } from "../config/db";
const rootDb = db;
import { bookings, bookingStatusHistory, jobs } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { jobHasFinished } from "@shared/job-dates";
import { bookingNeedsEarningsEntry } from "../utils/booking-earnings";
export { bookingNeedsEarningsEntry };

type PipelineStatus = "enquired" | "confirmed" | "briefed" | "completed";

// Forward-only ordering. "cancelled" is intentionally absent — it is a manual
// terminal state that automatic activity must never overwrite.
const STATUS_RANK: Record<string, number> = {
  enquired: 0,
  confirmed: 1,
  briefed: 2,
  completed: 3,
};

/** What a sync left behind, so the caller can seed earnings after its transaction commits. */
export interface BookingSyncResult {
  bookingId: number;
  status: string;
  /** At confirmed or beyond: needs an earnings entry (seeding is idempotent) */
  needsSeed: boolean;
}

/**
 * Create the booking for a (job, freelancer) pair, or advance it forward to at
 * least `targetStatus`. Idempotent and safe to call on every relevant event.
 *
 * - `employerId` is always set to the job's company/recruiter id so it lines up
 *   with how the employer Bookings tab queries (`companyId ?? user.id`).
 * - A `confirmed` target is auto-upgraded to `completed` when the job's event
 *   date is already in the past.
 * - Never regresses status and never revives a `cancelled` booking.
 *
 * Non-fatal: failures are logged and swallowed so the caller's main action
 * (invite, hire, message, …) still succeeds.
 *
 * Does NOT seed the earnings entry: under a caller's transaction the booking
 * isn't visible to the root connection seeding uses. The result says whether
 * one is needed; the caller seeds once its transaction has committed.
 */
export async function syncBookingForApplication(params: {
  jobId: number;
  freelancerId: number;
  targetStatus: "enquired" | "confirmed";
  changedById: number;
  note?: string;
  /** Run inside the caller's transaction */
  tx?: typeof rootDb;
  /** Throw instead of swallowing, so the caller's transaction rolls back */
  strict?: boolean;
}): Promise<BookingSyncResult | null> {
  const result = (bookingId: number, status: string): BookingSyncResult => ({
    bookingId,
    status,
    needsSeed: bookingNeedsEarningsEntry(status),
  });
  const { jobId, freelancerId, changedById } = params;
  const db: typeof rootDb = params.tx ?? rootDb;
  try {
    const [job] = await db
      .select({
        recruiterId: jobs.recruiter_id,
        postedByUserId: jobs.posted_by_user_id,
        isFreelancerPosted: jobs.is_freelancer_posted,
        eventDate: jobs.event_date,
        endDate: jobs.end_date,
        durationType: jobs.duration_type,
        days: jobs.days,
        currency: jobs.currency,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId));

    // Who the booking belongs to on the employer side: the company, or — for a
    // gig a freelancer posted themselves — that freelancer, who is genuinely
    // the employer for that engagement.
    const employerId =
      job?.recruiterId ?? (job?.isFreelancerPosted ? job.postedByUserId : null) ?? null;
    if (!job || employerId == null) {
      // Under strict (a hire), a skip must be loud: it would leave "hired"
      // with no booking. Otherwise (e.g. external listings) skipping is right.
      if (params.strict) throw new Error(`No party to attribute the booking to (job ${jobId})`);
      return null;
    }

    let targetStatus: PipelineStatus = params.targetStatus;
    // Completed only once the job's LAST day is over, not its first
    if (
      targetStatus === "confirmed" &&
      jobHasFinished({
        event_date: job.eventDate,
        end_date: job.endDate,
        duration_type: job.durationType,
        days: job.days,
      })
    ) {
      targetStatus = "completed";
    }

    const [existing] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.jobId, jobId), eq(bookings.freelancerId, freelancerId)));

    if (!existing) {
      const [created] = await db
        .insert(bookings)
        .values({
          jobId,
          employerId: employerId,
          freelancerId,
          status: targetStatus,
          currency: job.currency ?? "GBP",
        })
        .returning();

      await db.insert(bookingStatusHistory).values({
        bookingId: created.id,
        fromStatus: null,
        toStatus: targetStatus,
        changedById,
        note: params.note ?? "Booking created from application activity",
      });
      return result(created.id, targetStatus);
    }

    // Never overwrite a manually cancelled booking, and never regress status.
    if (existing.status === "cancelled") return null;
    const currentRank = STATUS_RANK[existing.status] ?? 0;
    const targetRank = STATUS_RANK[targetStatus] ?? 0;

    // Keep employerId correct even when we don't advance the status.
    if (targetRank <= currentRank) {
      if (existing.employerId !== employerId) {
        await db
          .update(bookings)
          .set({ employerId: employerId, updatedAt: new Date() })
          .where(eq(bookings.id, existing.id));
      }
      return result(existing.id, existing.status);
    }

    await db
      .update(bookings)
      .set({ status: targetStatus, employerId: employerId, updatedAt: new Date() })
      .where(eq(bookings.id, existing.id));

    await db.insert(bookingStatusHistory).values({
      bookingId: existing.id,
      fromStatus: existing.status,
      toStatus: targetStatus,
      changedById,
      note: params.note ?? "Booking advanced from application activity",
    });
    return result(existing.id, targetStatus);
  } catch (err) {
    if (params.strict) throw err;
    console.error("syncBookingForApplication failed (non-fatal):", err);
    return null;
  }
}

/**
 * Remove a booking from the employer pipeline entirely — used when an applicant
 * is rejected/declined or an invitation is withdrawn. Status history rows
 * cascade-delete via their foreign key. Non-fatal.
 */
export async function removeBookingFromPipeline(params: {
  jobId: number;
  freelancerId: number;
}): Promise<void> {
  try {
    await db
      .delete(bookings)
      .where(and(eq(bookings.jobId, params.jobId), eq(bookings.freelancerId, params.freelancerId)));
  } catch (err) {
    console.error("removeBookingFromPipeline failed (non-fatal):", err);
  }
}
