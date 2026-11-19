import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { bookings, job_applications, jobs as jobsTable } from "@shared/schema";
import { addDays, jobLastDay, ukToday } from "@shared/job-dates";
import { AUTO_COMPLETE_AFTER_DAYS, FILLED_STATUSES } from "@shared/hiring";
import { db } from "../config/db";
import { storage } from "../../storage";
import { seedEntryFromBooking } from "./earnings.service";

/**
 * Complete a job: the posting, plus its hires and bookings — which may only
 * move forward (a booking already completed by date is left as it is).
 * Idempotent.
 */
export async function completeJobRecords(jobId: number): Promise<void> {
  const job = await storage.getJobById(jobId);
  if (!job) return;
  if ((job.status as string) !== "completed" || !(job as any).completed_at) {
    await db
      .update(jobsTable)
      .set({ status: "completed" as any, completed_at: new Date(), updated_at: new Date() })
      .where(eq(jobsTable.id, jobId));
  }

  // Mark all hired applications on this job as completed
  const allApps = await storage.getJobApplications(jobId);
  const hiredApps = allApps.filter((a) => a.status === "hired");
  await Promise.all(
    hiredApps.map((a) => storage.updateApplicationStatus(a.id, "completed" as any))
  );

  // Reconcile ALL non-cancelled bookings for this job — including ones already
  // at "completed" that may have been stranded without an earnings entry.
  const jobBookings = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.jobId, jobId),
        inArray(bookings.status, ["confirmed", "briefed", "completed"])
      )
    );
  if (jobBookings.length === 0) return;

  const [jobRow] = await db
    .select({
      id: jobsTable.id,
      title: jobsTable.title,
      company: jobsTable.company,
      recruiter_id: jobsTable.recruiter_id,
      currency: jobsTable.currency,
      event_date: jobsTable.event_date,
      end_date: jobsTable.end_date,
    })
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));

  await Promise.all(
    jobBookings.map(async (b) => {
      if (b.status !== "completed") {
        await db
          .update(bookings)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(bookings.id, b.id));
      }
      const entry = await storage.getEarningsEntryByBooking(b.id);
      if (entry) {
        if (entry.work_status !== "completed") {
          await storage.updateEarningsEntry(entry.id, { work_status: "completed" });
        }
      } else if (jobRow) {
        await seedEntryFromBooking({ ...b, status: "completed" } as typeof b, jobRow);
      }
    })
  );
}

type Candidate = {
  id: number;
  title: string;
  recruiter_id: number | null;
  event_date: string | null;
  end_date: string | null;
  duration_type: string | null;
  days: number | null;
  completion_snoozed_on: string | null;
};

/** Jobs that had someone hired, aren't completed, and whose start is past. */
async function finishedCandidates(recruiterId?: number): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: jobsTable.id,
      title: jobsTable.title,
      recruiter_id: jobsTable.recruiter_id,
      event_date: jobsTable.event_date,
      end_date: jobsTable.end_date,
      duration_type: jobsTable.duration_type,
      days: jobsTable.days,
      completion_snoozed_on: jobsTable.completion_snoozed_on,
    })
    .from(jobsTable)
    .where(
      and(
        isNull(jobsTable.completed_at),
        ne(jobsTable.status, "completed" as any),
        isNull(jobsTable.deleted_at),
        sql`${jobsTable.event_date} IS NOT NULL AND ${jobsTable.event_date} <> ''`,
        recruiterId != null ? eq(jobsTable.recruiter_id, recruiterId) : sql`true`,
        sql`EXISTS (SELECT 1 FROM ${job_applications} a WHERE a.job_id = ${jobsTable.id}
              AND a.status IN (${sql.raw(FILLED_STATUSES.map((s) => `'${s}'`).join(","))}))`
      )
    );
  return rows as Candidate[];
}

/**
 * The day-after prompt: finished jobs (last day before today) that the
 * employer hasn't completed, and hasn't answered "Not yet" to today.
 */
export async function jobsDueForCompletion(
  recruiterId: number,
  today: string = ukToday()
): Promise<Array<{ id: number; title: string; last_day: string }>> {
  const out: Array<{ id: number; title: string; last_day: string }> = [];
  for (const j of await finishedCandidates(recruiterId)) {
    const last = jobLastDay(j);
    if (!last || last >= today) continue;
    if (j.completion_snoozed_on && String(j.completion_snoozed_on).slice(0, 10) === today) continue;
    out.push({ id: j.id, title: j.title, last_day: last });
  }
  return out;
}

export async function snoozeJobCompletion(jobId: number, today: string = ukToday()) {
  await db.update(jobsTable).set({ completion_snoozed_on: today }).where(eq(jobsTable.id, jobId));
}

/** Fallback: complete jobs nobody answered for, 7 days after their last day. */
export async function autoCompleteFinishedJobs(today: string = ukToday()): Promise<number> {
  let n = 0;
  for (const j of await finishedCandidates()) {
    const last = jobLastDay(j);
    if (!last || addDays(last, AUTO_COMPLETE_AFTER_DAYS) > today) continue;
    try {
      await completeJobRecords(j.id);
      n++;
    } catch (err) {
      console.error(`[job-completion] auto-complete failed for job ${j.id}:`, err);
    }
  }
  return n;
}
