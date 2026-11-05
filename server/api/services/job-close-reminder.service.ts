import { db } from "../config/db";
import { jobs, users, teamMembers, job_applications } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { sendEmail } from "../utils/emailService";

const SITE = "https://eventlink.one";

type ReminderJob = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  event_date: Date | string | null;
  recruiter_id: number | null;
};

/**
 * Emails the employer team whose job will auto-close soon (default: in 2 days /
 * 48h), but ONLY when no freelancer has been hired yet — reminding them to hire
 * their chosen freelancer officially and to close the job manually.
 *
 * Why this matters: when a job simply lapses on its event date nothing is
 * recorded as a hire, so no booking exists and neither side can leave a rating
 * or review. Those reviews are what build freelancers' reputations, so a job
 * that closes on its own with no hire is a missed opportunity for everyone. A
 * job that already has a hire doesn't need this nudge.
 *
 * The reminder goes to the whole team — the company owner plus every linked
 * team member — so whoever is handling the job sees it.
 *
 * Runs once a day and targets the single day exactly `daysAhead` out, so each
 * job is reminded exactly once — no per-job guard flag needed.
 */
export async function sendDueCloseReminders(daysAhead = 2): Promise<number> {
  const dueJobs: ReminderJob[] = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      event_date: jobs.event_date,
      recruiter_id: jobs.recruiter_id,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "active"),
        sql`${jobs.event_date} IS NOT NULL AND ${jobs.event_date}::date = (CURRENT_DATE + ${daysAhead} * INTERVAL '1 day')::date`
      )
    );

  let jobsReminded = 0;
  let sent = 0;
  for (const job of dueJobs) {
    if (!job.recruiter_id) continue; // external/aggregated jobs have no owner to email

    // Only nudge when nobody has been hired — a recorded hire means the booking
    // (and the ratings/reviews that follow) is already taken care of.
    const [hired] = await db
      .select({ id: job_applications.id })
      .from(job_applications)
      .where(and(eq(job_applications.job_id, job.id), eq(job_applications.status, "hired")))
      .limit(1);
    if (hired) continue;

    const recipients = await getTeamRecipients(job.recruiter_id);
    if (recipients.length === 0) continue;

    let anySent = false;
    for (const recipient of recipients) {
      const ok = await sendCloseReminderEmail(job, recipient).catch((err) => {
        console.error(`Close-reminder email error for job ${job.id} -> ${recipient.email}:`, err);
        return false;
      });
      if (ok) {
        sent++;
        anySent = true;
      }
    }
    if (anySent) jobsReminded++;
  }

  if (dueJobs.length > 0) {
    console.log(
      `Close-reminder scheduler: ${sent} email(s) sent across ${jobsReminded} job(s) with no hire.`
    );
  }
  return sent;
}

/**
 * The company owner plus every linked team member, deduped by email. Used so a
 * reminder reaches everyone who could act on the job, not just the account that
 * happens to own it.
 */
async function getTeamRecipients(
  companyId: number
): Promise<Array<{ email: string; first_name: string | null }>> {
  const [owner] = await db
    .select({ email: users.email, first_name: users.first_name })
    .from(users)
    .where(eq(users.id, companyId))
    .limit(1);

  const members = await db
    .select({ email: users.email, first_name: users.first_name })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(and(eq(teamMembers.companyId, companyId), eq(teamMembers.inviteAccepted, true)));

  const byEmail = new Map<string, { email: string; first_name: string | null }>();
  for (const r of [owner, ...members]) {
    if (r?.email) byEmail.set(r.email.toLowerCase(), r);
  }
  return Array.from(byEmail.values());
}

async function sendCloseReminderEmail(
  job: ReminderJob,
  employer: { email: string; first_name: string | null }
): Promise<boolean> {
  const firstName = employer.first_name || "there";
  const companyName = job.company || "your company";
  const eventDateStr = job.event_date
    ? new Date(job.event_date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "its event date";
  const dashboardLink = `${SITE}/dashboard`;

  const subject = `Reminder: "${job.title}" closes on ${eventDateStr}`;

  const textContent = `
Hi ${firstName},

Your job "${job.title}"${job.location ? ` in ${job.location}` : ""} reaches its event date on ${eventDateStr}, and EventLink will close it automatically at that point.

Before it does, two quick things make a real difference:

1. If you have chosen someone, hire them officially on the platform. This records the booking so that you and the freelancer can leave each other a rating and review afterwards. Those reviews are what build reputations on EventLink — a job that simply lapses leaves everyone with nothing to show for it.

2. Close the job manually once you are done. It keeps your dashboard tidy and lets the applicants you didn't pick know where they stand.

Manage this job here:
${dashboardLink}

If you take no action the job will still close on its own on ${eventDateStr}, but without a recorded hire no reviews can be exchanged.

Thanks,
The EventLink Team
eventlink.one
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1B2A4A;padding:28px 36px 20px 36px;border-bottom:4px solid #D8690E;">
              <p style="margin:0;font-size:22px;font-weight:bold;color:#D8690E;letter-spacing:1px;">EventLink</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Event Industry Professional Network</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 24px 36px;">
              <p style="margin:0 0 20px 0;font-size:16px;color:#1F2937;">Hi ${firstName},</p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.6;">
                Your job <strong>${job.title}</strong>${job.location ? ` in ${job.location}` : ""} for ${companyName} reaches its event date on <strong>${eventDateStr}</strong>, and EventLink will close it automatically at that point.
              </p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.6;">
                Before it does, two quick things make a real difference:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="padding:0 0 14px 0;font-size:15px;color:#374151;line-height:1.6;">
                    <strong style="color:#1B2A4A;">1. Officially hire your chosen freelancer.</strong><br/>
                    This records the booking so you and the freelancer can leave each other a rating and review afterwards. Those reviews are what build reputations on EventLink — a job that simply lapses leaves everyone with nothing to show for it.
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;color:#374151;line-height:1.6;">
                    <strong style="color:#1B2A4A;">2. Close the job manually when you are done.</strong><br/>
                    It keeps your dashboard tidy and lets the applicants you didn't pick know where they stand.
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#D8690E;border-radius:8px;">
                    <a href="${dashboardLink}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">
                      &#8594; Manage this job
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:14px;color:#6B7280;line-height:1.6;">
                If you take no action the job will still close on its own on ${eventDateStr}, but without a recorded hire no reviews can be exchanged.
              </p>

              <p style="margin:24px 0 0 0;font-size:14px;color:#374151;">
                Thanks,<br/>
                <strong>The EventLink Team</strong><br/>
                <a href="${SITE}" style="color:#D8690E;text-decoration:none;">eventlink.one</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB;padding:20px 36px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
                You are receiving this because you posted a job on EventLink that is about to close.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return sendEmail({
    to: employer.email,
    subject,
    text: textContent,
    html: htmlContent,
  });
}
