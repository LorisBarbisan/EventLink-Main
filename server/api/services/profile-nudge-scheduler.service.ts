import cron from "node-cron";
import { and, eq, isNull, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../config/db";
import { users, freelancer_profiles, profile_nudge_emails } from "@shared/schema";
import { sendEmail } from "../utils/emailService";
import {
  profileNudgeEmail1,
  profileNudgeEmail2,
  profileNudgeEmail3,
} from "../utils/emailTemplates";

const BASE_URL = process.env.FRONTEND_URL || "https://eventlink.one";

type NudgeStage = 1 | 2 | 3;

const TEMPLATE: Record<
  NudgeStage,
  (d: { unsubscribeUrl: string }) => { subject: string; html: string }
> = {
  1: profileNudgeEmail1,
  2: profileNudgeEmail2,
  3: profileNudgeEmail3,
};

/**
 * Freelancers who signed up but never created a profile receive up to three
 * nudges. Stage 1 goes out on Wednesday to accounts 7+ days old; stage 2 (the
 * following Sunday) and stage 3 (the following Tuesday) only go to those who
 * received the previous nudge and STILL have no profile. Anyone who creates a
 * profile drops out automatically (freelancer_profiles.id IS NULL check).
 */
async function runNudgeStage(stage: NudgeStage): Promise<void> {
  // Common: verified freelancer, not deleted, opted in, with no profile yet.
  const conditions = [
    eq(users.role, "freelancer"),
    eq(users.email_verified, true),
    isNull(users.deleted_at),
    eq(users.marketing_emails_opt_out, false),
    isNull(freelancer_profiles.id),
  ];

  if (stage === 1) {
    // Signed up at least 7 days ago, but only recent signups — the upper bound
    // keeps this a drip for NEW users and stops the first run blasting the
    // entire existing backlog of old no-profile accounts. A user's first
    // qualifying Wednesday lands them at ~7–13 days old, so 14 days covers it.
    conditions.push(sql`${users.created_at} <= now() - interval '7 days'`);
    conditions.push(sql`${users.created_at} >= now() - interval '14 days'`);
    conditions.push(
      or(isNull(profile_nudge_emails.id), isNull(profile_nudge_emails.nudge_1_sent_at))!
    );
  } else if (stage === 2) {
    conditions.push(isNotNull(profile_nudge_emails.nudge_1_sent_at));
    conditions.push(isNull(profile_nudge_emails.nudge_2_sent_at));
  } else {
    conditions.push(isNotNull(profile_nudge_emails.nudge_2_sent_at));
    conditions.push(isNull(profile_nudge_emails.nudge_3_sent_at));
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      unsubscribe_token: users.unsubscribe_token,
    })
    .from(users)
    .leftJoin(freelancer_profiles, eq(freelancer_profiles.user_id, users.id))
    .leftJoin(profile_nudge_emails, eq(profile_nudge_emails.user_id, users.id))
    .where(and(...conditions));

  if (rows.length === 0) {
    console.log(`📭 Profile nudge ${stage}: no eligible users`);
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const unsubscribeUrl = row.unsubscribe_token
      ? `${BASE_URL}/unsubscribe?token=${row.unsubscribe_token}`
      : `${BASE_URL}/unsubscribe`;

    const template = TEMPLATE[stage]({ unsubscribeUrl });

    try {
      const ok = await sendEmail({
        to: row.email,
        subject: template.subject,
        html: template.html,
        fromName: "EventLink Team",
      });

      if (!ok) {
        failed++;
        continue;
      }

      const now = new Date();
      if (stage === 1) {
        await db
          .insert(profile_nudge_emails)
          .values({ user_id: row.id, nudge_1_sent_at: now })
          .onConflictDoUpdate({
            target: profile_nudge_emails.user_id,
            set: { nudge_1_sent_at: now },
          });
      } else if (stage === 2) {
        await db
          .update(profile_nudge_emails)
          .set({ nudge_2_sent_at: now })
          .where(eq(profile_nudge_emails.user_id, row.id));
      } else {
        await db
          .update(profile_nudge_emails)
          .set({ nudge_3_sent_at: now })
          .where(eq(profile_nudge_emails.user_id, row.id));
      }

      sent++;
    } catch (err) {
      console.error(`❌ Profile nudge ${stage} failed for user ${row.id}:`, err);
      failed++;
    }
  }

  console.log(`✅ Profile nudge ${stage}: sent ${sent}, failed ${failed}`);
}

export function registerProfileNudgeScheduler(): void {
  // Stage 1 — Wednesday 12:00 UK
  cron.schedule(
    "0 12 * * 3",
    () => {
      runNudgeStage(1).catch((err) => console.error("❌ Profile nudge 1 error:", err));
    },
    { timezone: "Europe/London" }
  );

  // Stage 2 — Sunday 19:00 UK
  cron.schedule(
    "0 19 * * 0",
    () => {
      runNudgeStage(2).catch((err) => console.error("❌ Profile nudge 2 error:", err));
    },
    { timezone: "Europe/London" }
  );

  // Stage 3 — Tuesday 15:30 UK
  cron.schedule(
    "30 15 * * 2",
    () => {
      runNudgeStage(3).catch((err) => console.error("❌ Profile nudge 3 error:", err));
    },
    { timezone: "Europe/London" }
  );

  console.log("✅ Profile nudge scheduler registered (Wed 12:00, Sun 19:00, Tue 15:30 UK time)");
}
