import { createHash, randomBytes } from "crypto";
import cron from "node-cron";
import { storage } from "../../storage";
import { sendGuestJobNudge } from "./guest-job-email.service";

// Send a nudge to guests who submitted but haven't clicked their magic link.
// Runs every hour. Nudges drafts that are >= 4 hours old, not yet consumed,
// not already nudged, and not expired. Rotates the token so the new link works.
async function processNudges(): Promise<void> {
  const MIN_AGE_HOURS = 4;

  const drafts = await storage.getDraftsReadyForNudge(MIN_AGE_HOURS);
  if (!drafts.length) return;

  console.log(`[guest-nudge] Found ${drafts.length} draft(s) ready to nudge.`);

  for (const draft of drafts) {
    try {
      // Rotate to a fresh token so the original link is invalidated
      const rawToken = randomBytes(32).toString("hex");
      const newHash = createHash("sha256").update(rawToken).digest("hex");

      const payload = draft.payload as Record<string, unknown>;
      const jobTitle = (payload.title as string) || "your job post";

      await sendGuestJobNudge({
        to: draft.contact_email,
        contactName: draft.contact_name,
        jobTitle,
        token: rawToken,
      });

      await storage.markDraftNudgeSent(draft.id, newHash);
      console.log(`[guest-nudge] Nudge sent for draft ${draft.id} (${draft.contact_email})`);
    } catch (err) {
      console.error(`[guest-nudge] Failed to nudge draft ${draft.id}:`, err);
    }
  }
}

export function registerGuestJobNudgeScheduler(): void {
  // Run at the top of every hour
  cron.schedule("0 * * * *", async () => {
    try {
      await processNudges();
    } catch (err) {
      console.error("[guest-nudge] Scheduler error:", err);
    }
  });

  console.log("✅ Guest job nudge scheduler registered (hourly).");
}
