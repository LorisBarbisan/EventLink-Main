// ============================================================
// Booking lifecycle — keeps the employer Bookings pipeline in
// sync with real application activity.
//
// Mapping (see product decision):
//   invite sent / conversation started  -> enquired
//   freelancer hired                     -> confirmed (or completed if the
//                                           job's event date has passed)
//   briefed / completed                  -> manual (handled in booking UI)
//   rejected / declined / invite withdrawn -> removed from the pipeline
//
// One booking per (job, freelancer). Transitions are forward-only: a later
// signal never regresses a booking to an earlier state, and a manually
// cancelled booking is left untouched.
// ============================================================

import { db } from "../config/db";
import { bookings, bookingStatusHistory, jobs } from "@shared/schema";
import { and, eq } from "drizzle-orm";

type PipelineStatus = "enquired" | "confirmed" | "briefed" | "completed";

// Forward-only ordering. "cancelled" is intentionally absent — it is a manual
// terminal state that automatic activity must never overwrite.
const STATUS_RANK: Record<string, number> = {
  enquired: 0,
  confirmed: 1,
  briefed: 2,
  completed: 3,
};

function isEventInPast(eventDate: string | null): boolean {
  if (!eventDate) return false;
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
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
 */
export async function syncBookingForApplication(params: {
  jobId: number;
  freelancerId: number;
  targetStatus: "enquired" | "confirmed";
  changedById: number;
  note?: string;
}): Promise<void> {
  const { jobId, freelancerId, changedById } = params;
  try {
    const [job] = await db
      .select({
        recruiterId: jobs.recruiter_id,
        eventDate: jobs.event_date,
        currency: jobs.currency,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId));

    // No company to attribute the booking to (e.g. external jobs) — skip.
    if (!job || job.recruiterId == null) return;

    let targetStatus: PipelineStatus = params.targetStatus;
    if (targetStatus === "confirmed" && isEventInPast(job.eventDate)) {
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
          employerId: job.recruiterId,
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
      return;
    }

    // Never overwrite a manually cancelled booking, and never regress status.
    if (existing.status === "cancelled") return;
    const currentRank = STATUS_RANK[existing.status] ?? 0;
    const targetRank = STATUS_RANK[targetStatus] ?? 0;

    // Keep employerId correct even when we don't advance the status.
    if (targetRank <= currentRank) {
      if (existing.employerId !== job.recruiterId) {
        await db
          .update(bookings)
          .set({ employerId: job.recruiterId, updatedAt: new Date() })
          .where(eq(bookings.id, existing.id));
      }
      return;
    }

    await db
      .update(bookings)
      .set({ status: targetStatus, employerId: job.recruiterId, updatedAt: new Date() })
      .where(eq(bookings.id, existing.id));

    await db.insert(bookingStatusHistory).values({
      bookingId: existing.id,
      fromStatus: existing.status,
      toStatus: targetStatus,
      changedById,
      note: params.note ?? "Booking advanced from application activity",
    });
  } catch (err) {
    console.error("syncBookingForApplication failed (non-fatal):", err);
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
