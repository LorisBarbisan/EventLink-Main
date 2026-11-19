import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "../config/db";

/**
 * One instance at a time for every scheduled job.
 *
 * During a rolling deploy two instances run side by side, and every cron
 * fires on both. Each job therefore takes a Postgres advisory lock first and
 * skips if another instance holds it. The lock is TRANSACTION-scoped
 * (pg_try_advisory_xact_lock), so it is released on commit or rollback —
 * a job that throws can never strand it on a pooled connection.
 *
 * Keys are stable constants. Never reuse a number: a collision between two
 * jobs is silent (one would just stop running) and very hard to find.
 */
export const LOCK = {
  // server/index.ts
  UNDO_SWEEP: 7001, // nightly hard-delete of archived earnings/expenses
  BOOKS_EVENTS_PRUNE: 7002, // nightly 24-month prune of books_usage_events
  REPORTS_PRUNE: 7003, // nightly six-year prune of user_reports
  IMPORT_STUCK_SWEEP: 7004, // 15-min: marks timed-out import batches failed
  JOB_EXPIRY_HOURLY: 7005, // hourly: close jobs whose date has passed
  // job-notification-scheduler.service.ts
  JOB_BATCH_MORNING: 7101, // 09:00 job-alert batch
  JOB_BATCH_AFTERNOON: 7102, // 13:00 job-alert batch
  JOB_AUTO_CLOSE: 7103, // 10:00 close expired jobs + closure emails
  JOB_AUTO_COMPLETE: 7104, // 10:30 complete finished jobs
  JOB_CLOSE_REMINDERS: 7105, // 08:00 48h-before-close reminders
  // other schedulers
  CREDENTIAL_REMINDERS: 7201, // credential expiry reminder emails
  GUEST_JOB_NUDGE: 7202, // hourly guest-job nudges
  INVOICE_CHASER: 7203, // 09:00 overdue invoice chasers
  PROFILE_NUDGE_1: 7204, // Wed 12:00 profile nudge, stage 1
  PROFILE_NUDGE_2: 7205, // Sun 19:00 profile nudge, stage 2
  PROFILE_NUDGE_3: 7206, // Tue 15:30 profile nudge, stage 3
  // calendarScheduler.service.ts
  CAL_GOOGLE_RENEW: 7301, // 6-hourly Google webhook renewal
  CAL_OUTLOOK_RENEW: 7302, // 6-hourly Outlook webhook renewal (existing connections)
  CAL_RECONCILE: 7303, // 03:00 daily calendar reconcile
} as const;

/**
 * Run fn only if this instance wins the lock. The transaction exists only to
 * hold the lock; the work itself uses the normal pool.
 */
export async function runExclusive(
  key: number,
  fn: () => unknown | Promise<unknown>
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = (await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(${key}) AS locked`
    )) as unknown as Array<{ locked: boolean }>;
    if (!rows[0]?.locked) return; // another instance is running it
    await fn();
  });
}

/** cron.schedule, but only one instance runs each firing. */
export function scheduleExclusive(
  key: number,
  expression: string,
  fn: () => unknown | Promise<unknown>,
  options?: Parameters<typeof cron.schedule>[2]
) {
  return cron.schedule(
    expression,
    () => {
      runExclusive(key, fn).catch((err) => console.error(`[scheduler] job ${key} failed:`, err));
    },
    options
  );
}
