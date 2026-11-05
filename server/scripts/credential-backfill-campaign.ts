// ============================================================
// One-off backfill campaign (Epic 2) — asks freelancers who have certificates
// on file without an expiry date to add the dates, so the renewal-reminder cron
// can start working for them. SEPARATE from the daily cron.
//
// Safety:
//   • Dry-run by default — prints who WOULD be emailed. Pass --send to actually send.
//   • Capped per run (--cap, default 200) so a mistake is small and recoverable.
//   • Round 1 goes to everyone with an undated credential who hasn't been asked.
//     Round 2 (pass --round=2) goes ONLY to round-1 recipients who were emailed
//     at least 10 days ago and STILL have an undated credential — then stops.
//   • Honours credential_reminders_opt_out.
//
// Usage (DATABASE_URL pointing at the target DB):
//   npx tsx server/scripts/credential-backfill-campaign.ts            # round 1, dry-run
//   npx tsx server/scripts/credential-backfill-campaign.ts --send     # round 1, for real
//   npx tsx server/scripts/credential-backfill-campaign.ts --round=2 --send --cap=300
// ============================================================

import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "../api/config/db";
import { users, freelancer_documents, credential_backfill_campaign } from "@shared/schema";
import type { DocumentType } from "@shared/schema";
import { DOCUMENT_TYPE_META } from "@shared/schema";
import { sendEmail } from "../api/utils/emailService";

const BASE_URL = process.env.FRONTEND_URL || "https://eventlink.one";

const args = process.argv.slice(2);
const SEND = args.includes("--send");
const ROUND = args.some((a) => a === "--round=2") ? 2 : 1;
const CAP = (() => {
  const a = args.find((x) => x.startsWith("--cap="));
  const n = a ? parseInt(a.split("=")[1], 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : 200;
})();

type Target = {
  userId: number;
  email: string;
  firstName: string | null;
  unsubscribeToken: string | null;
  round1_sent_at: Date | null;
};

async function freelancersWithUndatedCredentials(): Promise<Map<number, Target>> {
  const rows = await db
    .select({
      user_id: freelancer_documents.freelancer_id,
      document_type: freelancer_documents.document_type,
      email: users.email,
      first_name: users.first_name,
      unsubscribe_token: users.unsubscribe_token,
      opt_out: users.credential_reminders_opt_out,
      deleted_at: users.deleted_at,
      round1_sent_at: credential_backfill_campaign.round1_sent_at,
    })
    .from(freelancer_documents)
    .innerJoin(users, eq(users.id, freelancer_documents.freelancer_id))
    .leftJoin(
      credential_backfill_campaign,
      eq(credential_backfill_campaign.user_id, freelancer_documents.freelancer_id)
    )
    .where(
      and(
        isNull(freelancer_documents.expiry_date),
        isNull(freelancer_documents.archived_at),
        eq(users.role, "freelancer"),
        isNull(users.deleted_at),
        eq(users.credential_reminders_opt_out, false)
      )
    );

  const map = new Map<number, Target>();
  for (const r of rows) {
    // Only credentials can be "incomplete" — job_documents never need a date.
    if (DOCUMENT_TYPE_META[r.document_type as DocumentType]?.class !== "credential") continue;
    if (!r.email) continue;
    if (!map.has(r.user_id)) {
      map.set(r.user_id, {
        userId: r.user_id,
        email: r.email,
        firstName: r.first_name,
        unsubscribeToken: r.unsubscribe_token,
        round1_sent_at: r.round1_sent_at,
      });
    }
  }
  return map;
}

async function run() {
  console.log(
    `Credential backfill campaign — round ${ROUND}, cap ${CAP}, mode ${SEND ? "SEND" : "DRY-RUN"}`
  );

  const withUndated = await freelancersWithUndatedCredentials();

  let targets: Target[];
  if (ROUND === 1) {
    // Not yet asked (no ledger row, so round1_sent_at is null).
    targets = Array.from(withUndated.values()).filter((t) => !t.round1_sent_at);
  } else {
    // Round-1 recipients from >= 10 days ago who still appear here (still undated).
    const cutoff = new Date(Date.now() - 10 * 86_400_000);
    const followups = await db
      .select({ user_id: credential_backfill_campaign.user_id })
      .from(credential_backfill_campaign)
      .where(
        and(
          isNull(credential_backfill_campaign.round2_sent_at),
          lte(credential_backfill_campaign.round1_sent_at, cutoff)
        )
      );
    const eligible = new Set(followups.map((f) => f.user_id));
    targets = Array.from(withUndated.values()).filter((t) => eligible.has(t.userId));
  }

  const batch = targets.slice(0, CAP);
  console.log(`${targets.length} eligible; sending to ${batch.length} this run.`);

  let sent = 0;
  for (const t of batch) {
    console.log(`  ${SEND ? "→" : "(dry)"} user ${t.userId} <${t.email}>`);
    if (!SEND) continue;

    const ok = await sendCampaignEmail(t).catch((err) => {
      console.error(`   email failed for user ${t.userId}:`, err);
      return false;
    });
    if (!ok) continue;

    const now = new Date();
    if (ROUND === 1) {
      await db
        .insert(credential_backfill_campaign)
        .values({ user_id: t.userId, round1_sent_at: now })
        .onConflictDoUpdate({
          target: credential_backfill_campaign.user_id,
          set: { round1_sent_at: now },
        });
    } else {
      await db
        .update(credential_backfill_campaign)
        .set({ round2_sent_at: now })
        .where(eq(credential_backfill_campaign.user_id, t.userId));
    }
    sent++;
  }

  console.log(`Done. ${SEND ? `Sent ${sent}.` : "Dry-run — nothing sent."}`);
}

async function sendCampaignEmail(t: Target): Promise<boolean> {
  const firstName = t.firstName || "there";
  const link = `${BASE_URL}/credentials`;
  const unsubscribe = `${BASE_URL}/unsubscribe?type=credentials${
    t.unsubscribeToken ? `&token=${t.unsubscribeToken}` : ""
  }`;
  const subject = "Add expiry dates to your EventLink certificates";
  const text = `
Hi ${firstName},

Some of the certificates on your EventLink profile don't have an expiry date yet. Adding them takes under a minute — you don't need to re-upload anything — and it means we can remind you before any of them lapse, so you stay bookable.

Add your dates here:
${link}

Thanks,
The EventLink Team
eventlink.one

Don't want these reminders? ${unsubscribe}
`.trim();
  const html = `
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <tr><td style="background-color:#1B2A4A;padding:28px 36px 20px 36px;border-bottom:4px solid #D8690E;">
        <p style="margin:0;font-size:22px;font-weight:bold;color:#D8690E;letter-spacing:1px;">EventLink</p>
      </td></tr>
      <tr><td style="padding:36px 36px 24px 36px;">
        <p style="margin:0 0 16px 0;font-size:16px;color:#1F2937;">Hi ${firstName},</p>
        <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.6;">
          Some of the certificates on your EventLink profile don't have an expiry date yet. Adding them takes under a minute — you don't need to re-upload anything — and it means we can remind you before any of them lapse, so you stay bookable.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:8px 0 20px 0;"><tr><td style="background-color:#D8690E;border-radius:8px;">
          <a href="${link}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">&#8594; Add my expiry dates</a>
        </td></tr></table>
        <p style="margin:24px 0 0 0;font-size:14px;color:#374151;">Thanks,<br/><strong>The EventLink Team</strong><br/><a href="${BASE_URL}" style="color:#D8690E;text-decoration:none;">eventlink.one</a></p>
      </td></tr>
      <tr><td style="background-color:#F9FAFB;padding:20px 36px;border-top:1px solid #E5E7EB;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;"><a href="${unsubscribe}" style="color:#9CA3AF;">Don't want these reminders?</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>
`.trim();

  return sendEmail({ to: t.email, subject, text, html, fromName: "EventLink Team" });
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("credential-backfill-campaign failed:", err);
    process.exit(1);
  });
