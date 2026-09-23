// ============================================================
// One-off backfill: populate the employer Bookings pipeline from
// existing application activity.
//
//   invited application -> Enquired booking
//   hired application   -> Confirmed booking (Completed if event date passed)
//
// Plain "applied" applications are intentionally excluded (they stay in the
// Applications tab only). Past conversations cannot be backfilled because a
// conversation has no stored job link — only invited/hired applications do.
//
// Safe to run repeatedly: syncBookingForApplication is idempotent and never
// regresses an existing booking's status.
//
// Usage (with DATABASE_URL pointing at the target database):
//   npx tsx server/scripts/backfill-bookings.ts
// ============================================================

import { inArray, eq } from "drizzle-orm";
import { db } from "../api/config/db";
import { job_applications, jobs } from "@shared/schema";
import { syncBookingForApplication } from "../api/services/booking-lifecycle.service";

async function backfillBookings() {
  console.log("Starting bookings backfill (invited + hired applications)…");

  const apps = await db
    .select({
      id: job_applications.id,
      jobId: job_applications.job_id,
      freelancerId: job_applications.freelancer_id,
      status: job_applications.status,
      recruiterId: jobs.recruiter_id,
    })
    .from(job_applications)
    .innerJoin(jobs, eq(jobs.id, job_applications.job_id))
    .where(inArray(job_applications.status, ["invited", "hired"]));

  let processed = 0;
  let skipped = 0;

  for (const a of apps) {
    // No company to attribute the booking to (external job) — skip.
    if (a.recruiterId == null) {
      skipped++;
      continue;
    }

    await syncBookingForApplication({
      jobId: a.jobId,
      freelancerId: a.freelancerId,
      targetStatus: a.status === "hired" ? "confirmed" : "enquired",
      changedById: a.recruiterId,
      note: `Backfill from application #${a.id} (${a.status})`,
    });
    processed++;
  }

  console.log(
    `Backfill complete: ${processed} booking(s) synced, ${skipped} skipped (no company), from ${apps.length} invited/hired application(s).`
  );
}

backfillBookings()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
