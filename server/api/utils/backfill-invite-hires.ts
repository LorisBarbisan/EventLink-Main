import { sql } from "drizzle-orm";
import { db } from "../config/db";
import { hireApplication } from "../services/hire.service";

/**
 * One-off, idempotent boot backfill.
 *
 * Invitations the freelancer accepted BEFORE acceptance auto-hired sit at
 * status 'applied' with an invitation_message set, waiting on an employer
 * confirm that no longer happens. Hire them through the real path (confirmed
 * booking, seeded earnings, close-when-full) so they're consistent. After the
 * first run they are 'hired' and no longer match, so this is a no-op on every
 * boot thereafter. Never throws — a failure must not block startup.
 */
export async function backfillInviteHires(): Promise<void> {
  try {
    const result = await db.execute(sql`
      SELECT id, job_id, freelancer_id
      FROM job_applications
      WHERE status = 'applied' AND invitation_message IS NOT NULL
    `);
    const rows = (Array.isArray(result) ? result : ((result as any).rows ?? [])) as Array<{
      id: number;
      job_id: number;
      freelancer_id: number;
    }>;
    if (rows.length === 0) return;

    console.log(`🔁 backfillInviteHires: hiring ${rows.length} accepted invitation(s)`);
    for (const r of rows) {
      try {
        const res = await hireApplication({
          applicationId: Number(r.id),
          jobId: Number(r.job_id),
          freelancerId: Number(r.freelancer_id),
          changedById: Number(r.freelancer_id),
        });
        console.log(`   app ${r.id} (job ${r.job_id}, freelancer ${r.freelancer_id}): ${res.kind}`);
      } catch (err) {
        console.error(`   app ${r.id}: hire failed`, err);
      }
    }
  } catch (err) {
    console.error("backfillInviteHires failed (non-fatal):", err);
  }
}
