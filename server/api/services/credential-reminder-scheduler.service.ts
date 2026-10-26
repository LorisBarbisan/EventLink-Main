import cron from "node-cron";
import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { db } from "../config/db";
import { users, freelancer_documents, credential_reminders } from "@shared/schema";
import type { CredentialReminderStage, DocumentType } from "@shared/schema";
import { DOCUMENT_TYPE_META } from "@shared/schema";
import { sendEmail } from "../utils/emailService";
import { storage } from "../../storage";

const BASE_URL = process.env.FRONTEND_URL || "https://eventlink.one";

// First-run safety: never email more than this many freelancers in one run, so
// the very first run (315 freelancers, several docs each, all suddenly in scope)
// can't turn into a blast. The narrow per-stage windows below already bound it;
// this is the backstop.
const MAX_FREELANCERS_PER_RUN = 150;

/**
 * Which rung of the ladder a credential is on today, by whole days until expiry.
 * Windows are a couple of days wide (not a single exact day) so a missed daily
 * run doesn't skip a rung, while staying narrow enough that the first run only
 * catches credentials genuinely near a threshold — not the whole backlog.
 * The ledger's unique (document_id, stage) index makes repeats impossible.
 */
function stageForDays(days: number): CredentialReminderStage | null {
  if (days >= 88 && days <= 90) return "d90";
  if (days >= 28 && days <= 30) return "d30";
  if (days >= 6 && days <= 7) return "d7";
  if (days === 0) return "day_of";
  // Any credential 7+ days past expiry that hasn't had an overdue nudge yet gets
  // one. The ledger's unique (document, 'overdue') guard means it still fires
  // exactly once — so this also catches credentials dated as already-expired
  // during backfill (which never went through the 90→7-day run-up).
  if (days <= -7) return "overdue";
  return null;
}

const STAGE_PHRASE: Record<CredentialReminderStage, string> = {
  d90: "expires in about 90 days",
  d30: "expires in about 30 days",
  d7: "expires in a week",
  day_of: "expires today",
  overdue: "has expired",
};

function daysUntil(expiry: string, now: Date): number {
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = expiry.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  const expiryUTC = Date.UTC(y, m - 1, d);
  return Math.round((expiryUTC - todayUTC) / 86_400_000);
}

function fmt(expiry: string): string {
  const d = new Date(expiry);
  return Number.isNaN(d.getTime())
    ? expiry
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

type Due = {
  documentId: number;
  typeLabel: string;
  expiry: string;
  stage: CredentialReminderStage;
};

type FreelancerBatch = {
  freelancerId: number;
  email: string;
  firstName: string | null;
  unsubscribeToken: string | null;
  optOut: boolean;
  due: Due[];
};

export async function runCredentialReminders(now: Date = new Date()): Promise<number> {
  // Live credentials with a date: not archived, not superseded, owner active.
  const rows = await db
    .select({
      id: freelancer_documents.id,
      document_type: freelancer_documents.document_type,
      custom_type_name: freelancer_documents.custom_type_name,
      expiry_date: freelancer_documents.expiry_date,
      freelancer_id: freelancer_documents.freelancer_id,
      email: users.email,
      first_name: users.first_name,
      unsubscribe_token: users.unsubscribe_token,
      opt_out: users.credential_reminders_opt_out,
    })
    .from(freelancer_documents)
    .innerJoin(users, eq(users.id, freelancer_documents.freelancer_id))
    .where(
      and(
        isNotNull(freelancer_documents.expiry_date),
        isNull(freelancer_documents.archived_at),
        isNull(freelancer_documents.superseded_by_id),
        isNull(users.deleted_at)
      )
    );

  // Which (document, stage) pairs are due today?
  const candidates: Array<FreelancerBatch["due"][number] & { row: (typeof rows)[number] }> = [];
  for (const r of rows) {
    if (!r.expiry_date) continue;
    if (DOCUMENT_TYPE_META[r.document_type as DocumentType]?.class !== "credential") continue;
    const stage = stageForDays(daysUntil(r.expiry_date, now));
    if (!stage) continue;
    const typeLabel =
      r.document_type === "Other" && r.custom_type_name ? r.custom_type_name : r.document_type;
    candidates.push({ documentId: r.id, typeLabel, expiry: r.expiry_date, stage, row: r });
  }
  if (candidates.length === 0) return 0;

  // Drop pairs already recorded in the ledger (idempotency).
  const docIds = Array.from(new Set(candidates.map((c) => c.documentId)));
  const existing = await db
    .select({ document_id: credential_reminders.document_id, stage: credential_reminders.stage })
    .from(credential_reminders)
    .where(inArray(credential_reminders.document_id, docIds));
  const sentKey = new Set(existing.map((e) => `${e.document_id}:${e.stage}`));
  const fresh = candidates.filter((c) => !sentKey.has(`${c.documentId}:${c.stage}`));
  if (fresh.length === 0) return 0;

  // Batch per freelancer — one email listing everything due, not one per doc.
  const batches = new Map<number, FreelancerBatch>();
  for (const c of fresh) {
    let b = batches.get(c.row.freelancer_id);
    if (!b) {
      b = {
        freelancerId: c.row.freelancer_id,
        email: c.row.email,
        firstName: c.row.first_name,
        unsubscribeToken: c.row.unsubscribe_token,
        optOut: c.row.opt_out,
        due: [],
      };
      batches.set(c.row.freelancer_id, b);
    }
    b.due.push({
      documentId: c.documentId,
      typeLabel: c.typeLabel,
      expiry: c.expiry,
      stage: c.stage,
    });
  }

  let processed = 0;
  for (const batch of Array.from(batches.values())) {
    if (processed >= MAX_FREELANCERS_PER_RUN) {
      console.log(
        `Credential reminders: hit per-run cap of ${MAX_FREELANCERS_PER_RUN}; remaining freelancers roll to the next run.`
      );
      break;
    }

    // Email only when not opted out; the in-app notification always goes.
    let emailOk = true;
    if (!batch.optOut) {
      emailOk = await sendReminderEmail(batch).catch((err) => {
        console.error(`Credential reminder email failed for user ${batch.freelancerId}:`, err);
        return false;
      });
    }

    // If a non-opted-out email failed, leave it for the next run rather than
    // recording the ledger (and so recording the in-app) prematurely.
    if (!batch.optOut && !emailOk) continue;

    await createInAppNotification(batch).catch((err) =>
      console.error(`Credential reminder in-app failed for user ${batch.freelancerId}:`, err)
    );

    // Record the ledger rows (idempotent via the unique index).
    await db
      .insert(credential_reminders)
      .values(batch.due.map((d) => ({ document_id: d.documentId, stage: d.stage })))
      .onConflictDoNothing();

    processed++;
  }

  console.log(`Credential reminders: processed ${processed} freelancer(s).`);
  return processed;
}

async function createInAppNotification(batch: FreelancerBatch): Promise<void> {
  const count = batch.due.length;
  const title =
    count === 1
      ? `${batch.due[0].typeLabel} ${STAGE_PHRASE[batch.due[0].stage]}`
      : `${count} credentials need renewing`;
  const lines = batch.due
    .map(
      (d) => `${d.typeLabel} — ${d.stage === "overdue" ? "expired on" : "expires"} ${fmt(d.expiry)}`
    )
    .join("; ");
  await storage.createNotification({
    user_id: batch.freelancerId,
    type: "credential_expiry",
    title,
    message: `${lines}. Renew and update the date on your profile so it stays current.`,
    priority: "normal",
  });
}

async function sendReminderEmail(batch: FreelancerBatch): Promise<boolean> {
  const firstName = batch.firstName || "there";
  const count = batch.due.length;
  const subject =
    count === 1
      ? `Reminder: your ${batch.due[0].typeLabel} ${STAGE_PHRASE[batch.due[0].stage]}`
      : `Reminder: ${count} of your certificates need renewing`;
  const link = `${BASE_URL}/dashboard`;
  // Unsubscribe points at the credential preference, NOT marketing — this is a
  // service message about the freelancer's own data.
  const unsubscribe = `${BASE_URL}/unsubscribe?type=credentials${
    batch.unsubscribeToken ? `&token=${batch.unsubscribeToken}` : ""
  }`;

  const itemsText = batch.due
    .map(
      (d) =>
        `• ${d.typeLabel} — ${d.stage === "overdue" ? "expired on" : "expires"} ${fmt(d.expiry)}`
    )
    .join("\n");
  const itemsHtml = batch.due
    .map(
      (d) =>
        `<li style="margin:0 0 6px 0;"><strong>${d.typeLabel}</strong> — ${d.stage === "overdue" ? "expired on" : "expires"} ${fmt(d.expiry)}</li>`
    )
    .join("");

  const text = `
Hi ${firstName},

A quick reminder about ${count === 1 ? "a certificate" : "some certificates"} on your EventLink profile:

${itemsText}

Renewing in good time keeps you bookable — employers filter on in-date credentials. Once you've renewed, upload the new certificate (or update the date) on your profile:
${link}

Thanks,
The EventLink Team
eventlink.one

You are receiving this because you have a credential on EventLink with an upcoming expiry.
Turn these reminders off: ${unsubscribe}
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <tr><td style="background-color:#1B2A4A;padding:28px 36px 20px 36px;border-bottom:4px solid #D8690E;">
        <p style="margin:0;font-size:22px;font-weight:bold;color:#D8690E;letter-spacing:1px;">EventLink</p>
        <p style="margin:4px 0 0 0;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Event Industry Professional Network</p>
      </td></tr>
      <tr><td style="padding:36px 36px 24px 36px;">
        <p style="margin:0 0 16px 0;font-size:16px;color:#1F2937;">Hi ${firstName},</p>
        <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.6;">
          A quick reminder about ${count === 1 ? "a certificate" : "some certificates"} on your EventLink profile:
        </p>
        <ul style="margin:0 0 20px 0;padding-left:20px;font-size:15px;color:#374151;line-height:1.6;">${itemsHtml}</ul>
        <p style="margin:0 0 20px 0;font-size:15px;color:#374151;line-height:1.6;">
          Renewing in good time keeps you bookable — employers filter on in-date credentials. Once you've renewed, upload the new certificate (or update the date) on your profile.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:8px 0 20px 0;"><tr><td style="background-color:#D8690E;border-radius:8px;">
          <a href="${link}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">&#8594; Update my certificates</a>
        </td></tr></table>
        <p style="margin:24px 0 0 0;font-size:14px;color:#374151;">Thanks,<br/><strong>The EventLink Team</strong><br/><a href="${BASE_URL}" style="color:#D8690E;text-decoration:none;">eventlink.one</a></p>
      </td></tr>
      <tr><td style="background-color:#F9FAFB;padding:20px 36px;border-top:1px solid #E5E7EB;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
          You are receiving this because you have a credential on EventLink with an upcoming expiry.<br/>
          <a href="${unsubscribe}" style="color:#9CA3AF;">Turn these reminders off</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>
`.trim();

  return sendEmail({ to: batch.email, subject, text, html, fromName: "EventLink Team" });
}

export function registerCredentialReminderScheduler(): void {
  // Daily at 07:17 UK (jittered minute, not :00, to avoid the top-of-hour crowd).
  cron.schedule(
    "17 7 * * *",
    () => {
      runCredentialReminders().catch((err) =>
        console.error("❌ Credential reminder scheduler error:", err)
      );
    },
    { timezone: "Europe/London" }
  );
  console.log("✅ Credential reminder scheduler registered (07:17 UK time daily).");
}
