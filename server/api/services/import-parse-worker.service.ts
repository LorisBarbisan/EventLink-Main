import { eq, and, lt, inArray } from "drizzle-orm";
import { db } from "../config/db";
import { import_batches, import_rows } from "@shared/schema";

// ── Parse job queue (in-process) ──────────────────────────────────────────────
// Jobs are picked up by setImmediate so the HTTP response returns before work
// starts. For PR 1 we stub the actual parsing logic and mark it complete; the
// real parser (PR 5) replaces runParse().

const queue: Array<{ batchId: number; jobId: string }> = [];
let workerRunning = false;

export async function enqueueParseJob(batchId: number, jobId: string): Promise<void> {
  queue.push({ batchId, jobId });
  if (!workerRunning) {
    setImmediate(drainQueue);
  }
}

async function drainQueue(): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;

  while (queue.length > 0) {
    const job = queue.shift()!;
    try {
      await runParse(job.batchId, job.jobId);
    } catch (err) {
      console.error(`[import-worker] unhandled error for batch ${job.batchId}:`, err);
      await markFailed(job.batchId, String(err));
    }
  }

  workerRunning = false;
}

async function runParse(batchId: number, jobId: string): Promise<void> {
  // Verify this job is still the current one (a re-parse may have been issued)
  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.parse_job_id, jobId)))
    .limit(1);

  if (!batch || batch.status !== "queued") {
    // Stale job — another parse was started or batch deleted; skip silently
    return;
  }

  await db
    .update(import_batches)
    .set({ status: "parsing", parse_started_at: new Date(), updated_at: new Date() })
    .where(eq(import_batches.id, batchId));

  try {
    // Delete any rows from a previous parse attempt so re-parsing is idempotent
    await db.delete(import_rows).where(eq(import_rows.batch_id, batchId));

    // ── Stub: real parsing is implemented in PR 5 ─────────────────────────
    // PR 5 will:
    //   1. Download the file from R2 via ObjectStorageService.downloadObjectBuffer()
    //   2. Parse CSV/XLSX/PDF into raw row objects
    //   3. Apply column_map from import_mappings (or heuristics if no mapping)
    //   4. Classify each row (income / expense / transfer / unknown)
    //   5. Insert import_rows with parsed/confidence/issues
    //   6. Update row_count on the batch
    // For now we move straight to "review" so the pipeline can be tested end-to-end.
    // ─────────────────────────────────────────────────────────────────────

    await db
      .update(import_batches)
      .set({
        status: "review",
        parse_completed_at: new Date(),
        parse_progress: 100,
        row_count: 0,
        updated_at: new Date(),
      })
      .where(eq(import_batches.id, batchId));
  } catch (err) {
    await markFailed(batchId, String(err));
  }
}

async function markFailed(batchId: number, error: string): Promise<void> {
  await db
    .update(import_batches)
    .set({ status: "failed", error, updated_at: new Date() })
    .where(eq(import_batches.id, batchId));
}

// ── Sweeper ────────────────────────────────────────────────────────────────────
// Runs on a cron to mark stuck "parsing" jobs as failed.
// A job is considered stuck if parse_started_at is more than 30 minutes ago.

export async function sweepStuckParseJobs(): Promise<void> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const stuck = await db
    .select({ id: import_batches.id })
    .from(import_batches)
    .where(
      and(
        inArray(import_batches.status, ["parsing", "queued"]),
        lt(import_batches.parse_started_at, thirtyMinutesAgo)
      )
    );

  if (stuck.length === 0) return;

  const ids = stuck.map((r) => r.id);
  await db
    .update(import_batches)
    .set({
      status: "failed",
      error: "Parse job timed out after 30 minutes",
      updated_at: new Date(),
    })
    .where(inArray(import_batches.id, ids));

  console.log(`[import-sweeper] marked ${ids.length} stuck parse job(s) as failed: ${ids}`);
}
