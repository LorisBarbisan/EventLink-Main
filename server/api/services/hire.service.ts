import { and, eq, inArray, sql } from "drizzle-orm";
import { job_applications, jobs } from "@shared/schema";
import { FILLED_STATUSES, fillsLastPosition, hireRefusal } from "@shared/hiring";
import { db } from "../config/db";
import { syncBookingForApplication, type BookingSyncResult } from "./booking-lifecycle.service";
import { seedEntryForBookingId } from "./earnings.service";

export type HireResult =
  | { kind: "hired"; filled: number; positions: number; jobClosed: boolean }
  | { kind: "already_hired"; filled: number; positions: number }
  | { kind: "refused"; reason: "job_closed" | "fully_crewed" }
  | { kind: "not_found" };

/** How many people are hired on a job. Derived, never stored. */
export async function filledPositions(jobId: number, q: typeof db = db): Promise<number> {
  const [row] = await q
    .select({ n: sql<number>`count(*)::int` })
    .from(job_applications)
    .where(
      and(
        eq(job_applications.job_id, jobId),
        // "completed" is set by completeJob but missing from the column type
        inArray(job_applications.status, [...FILLED_STATUSES] as unknown as ["hired"])
      )
    );
  return Number(row?.n ?? 0);
}

/**
 * One atomic hire. Inside a single transaction, with the job row locked so two
 * simultaneous accepts serialise: refuse if the job is closed or fully crewed,
 * return unchanged if this application is already hired, otherwise set it to
 * hired, confirm the booking, and close the job when the last position fills.
 *
 * Sends nothing. The caller notifies AFTER this resolves, so an email
 * provider timing out can never roll back a hire.
 */
export async function hireApplication(params: {
  applicationId: number;
  jobId: number;
  freelancerId: number;
  changedById: number;
}): Promise<HireResult> {
  let sync: BookingSyncResult | null = null;
  const result: HireResult = await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as typeof db;
    // Lock the job row: concurrent hires on the same job wait here
    const locked = (await tx.execute(
      sql`SELECT id, status, positions FROM jobs WHERE id = ${params.jobId} FOR UPDATE`
    )) as unknown as Array<{ id: number; status: string | null; positions: number }>;
    const job = locked[0];
    if (!job) return { kind: "not_found" } as const;

    const [app] = await tx
      .select({ status: job_applications.status })
      .from(job_applications)
      .where(eq(job_applications.id, params.applicationId));
    if (!app) return { kind: "not_found" } as const;

    const filled = await filledPositions(params.jobId, tx);
    const positions = Math.max(1, Number(job.positions ?? 1));

    if (app.status === "hired" || (app.status as string) === "completed") {
      return { kind: "already_hired", filled, positions } as const;
    }

    const refusal = hireRefusal({ status: job.status, positions }, filled);
    if (refusal) return { kind: "refused", reason: refusal } as const;

    await tx
      .update(job_applications)
      // Un-hide from the freelancer's view so they can see they were hired
      .set({ status: "hired", freelancer_deleted: false, updated_at: sql`now()` })
      .where(eq(job_applications.id, params.applicationId));

    sync = await syncBookingForApplication({
      jobId: params.jobId,
      freelancerId: params.freelancerId,
      targetStatus: "confirmed",
      changedById: params.changedById,
      note: "Freelancer hired",
      tx,
      strict: true,
    });

    const filledAfter = filled + 1;
    const jobClosed = fillsLastPosition(positions, filledAfter);
    if (jobClosed) {
      await tx
        .update(jobs)
        .set({ status: "closed", updated_at: new Date() })
        .where(eq(jobs.id, params.jobId));
    }
    return { kind: "hired", filled: filledAfter, positions, jobClosed } as const;
  });

  // The earnings entry, once the hire has committed: seeding reads the booking
  // through the root connection, which can't see it before then. A job whose
  // last day has passed is hired straight to completed, so nothing later would
  // seed it. Never fails the hire (seedEntryForBookingId doesn't throw).
  const synced = sync as BookingSyncResult | null;
  if (result.kind === "hired" && synced?.needsSeed) {
    await seedEntryForBookingId(synced.bookingId);
  }
  return result;
}
