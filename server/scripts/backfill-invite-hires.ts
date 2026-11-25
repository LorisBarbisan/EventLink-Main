// ============================================================
// Retrospective: hire freelancers who accepted an invitation before
// acceptance auto-hired. Such applications sit at status 'applied' with an
// invitation_message set, waiting on an employer confirm that no longer
// happens. Running the real hire path makes them consistent (booking +
// earnings + close-when-full), exactly as a new accept now does.
//
// DRY RUN by default — lists what it would hire. Pass --apply to execute.
//
// Usage (from a folder linked to the Railway project):
//   railway run npx tsx server/scripts/backfill-invite-hires.ts          # preview
//   railway run npx tsx server/scripts/backfill-invite-hires.ts --apply  # do it
// ============================================================

import { sql } from "drizzle-orm";
import { db } from "../api/config/db";
import { hireApplication } from "../api/services/hire.service";

function rowsOf(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return result as any[];
}

async function main() {
  const apply = process.argv.includes("--apply");

  const rows = rowsOf(
    await db.execute(sql`
      SELECT ja.id, ja.job_id, ja.freelancer_id, j.title, j.status AS job_status
      FROM job_applications ja
      JOIN jobs j ON j.id = ja.job_id
      WHERE ja.status = 'applied'
        AND ja.invitation_message IS NOT NULL
      ORDER BY ja.id
    `)
  );

  console.log(`\nInvited-and-accepted applications not yet hired: ${rows.length}`);
  for (const r of rows) {
    console.log(
      `  app ${r.id} · job ${r.job_id} "${r.title}" (job: ${r.job_status}) · freelancer ${r.freelancer_id}`
    );
  }

  if (!apply) {
    console.log("\nDry run — nothing changed. Re-run with --apply to hire these.\n");
    process.exit(0);
  }

  console.log("\nApplying hires…");
  let hired = 0;
  let skipped = 0;
  for (const r of rows) {
    try {
      const result = await hireApplication({
        applicationId: Number(r.id),
        jobId: Number(r.job_id),
        freelancerId: Number(r.freelancer_id),
        changedById: Number(r.freelancer_id),
      });
      const detail = result.kind === "refused" ? ` (${(result as any).reason})` : "";
      console.log(`  app ${r.id}: ${result.kind}${detail}`);
      if (result.kind === "hired" || result.kind === "already_hired") hired++;
      else skipped++;
    } catch (e) {
      skipped++;
      console.error(`  app ${r.id}: ERROR`, e);
    }
  }
  console.log(`\nDone. Hired/confirmed: ${hired}, skipped (closed/full/error): ${skipped}.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
