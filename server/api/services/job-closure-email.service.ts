import { db } from "../config/db";
import { jobs, job_applications, users } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendJobClosureEmails(jobId: number): Promise<void> {

  // Guard: skip if closure emails already sent for this job
  const alreadySent = await db
    .select()
    .from(job_applications)
    .where(
      and(
        eq(job_applications.job_id, jobId),
        eq(job_applications.closure_email_sent, true)
      )
    )
    .limit(1);

  if (alreadySent.length > 0) {
    console.log(`Job ${jobId} closure emails already sent — skipping`);
    return;
  }

  // Fetch the job record
  const jobResult = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      event_date: jobs.event_date,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!jobResult.length) {
    console.error(`sendJobClosureEmails: job ${jobId} not found`);
    return;
  }

  const job = jobResult[0];
  const companyName = job.company || "the employer";

  // Fetch all non-hired applicants who haven't received a closure email
  const unsuccessfulApplicants = await db
    .select({
      applicationId: job_applications.id,
      freelancerId: job_applications.freelancer_id,
    })
    .from(job_applications)
    .where(
      and(
        eq(job_applications.job_id, jobId),
        ne(job_applications.status, "hired"),
        eq(job_applications.closure_email_sent, false)
      )
    );

  if (!unsuccessfulApplicants.length) {
    console.log(`Job ${jobId}: no unsuccessful applicants to notify`);
    return;
  }

  let sentCount = 0;

  for (const applicant of unsuccessfulApplicants) {
    const freelancerResult = await db
      .select({
        id: users.id,
        first_name: users.first_name,
        email: users.email,
        unsubscribe_token: users.unsubscribe_token,
      })
      .from(users)
      .where(eq(users.id, applicant.freelancerId))
      .limit(1);

    const freelancer = freelancerResult[0];
    if (!freelancer?.email) continue;

    const firstName = freelancer.first_name || "there";
    const reputationLink = `https://eventlink.one/reputation/${freelancer.id}`;
    const unsubscribeLink = `https://eventlink.one/unsubscribe?token=${
      freelancer.unsubscribe_token ?? freelancer.id
    }`;

    const subject = `Your application for ${job.title} — ${companyName}`;

    const textContent = `
Hi ${firstName},

Thank you for applying for the ${job.title} role posted by ${companyName} on EventLink.

After reviewing all applications, they have decided to move forward with another candidate for this particular event. This is not a reflection on your skills — competition for roles on EventLink is growing and every job is receiving more applications.

The best way to stand out next time is to make your profile impossible to overlook. Employers consistently shortlist candidates with verified references. The Build My Reputation tool lets your past clients vouch for you in under 60 seconds.

Strengthen your profile here:
${reputationLink}

Send that link to a production manager, venue contact, or project manager you have worked with. Every reference they submit strengthens your position on the platform for every future role.

New jobs are posted regularly. Keep your profile up to date and you will be first in line.

Best of luck,
The EventLink Team
eventlink.one

You are receiving this because you applied for a job on EventLink.
Unsubscribe: ${unsubscribeLink}
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
              <p style="margin:0;font-size:22px;font-weight:bold;color:#D8690E;letter-spacing:1px;">EVENTLINK</p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Event Industry Professional Network</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 24px 36px;">

              <p style="margin:0 0 20px 0;font-size:16px;color:#1F2937;">Hi ${firstName},</p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.6;">
                Thank you for applying for the <strong>${job.title}</strong> role posted by <strong>${companyName}</strong> on EventLink.
              </p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.6;">
                After reviewing all applications, they have decided to move forward with another candidate for this particular event. This is not a reflection on your skills — competition for roles on EventLink is growing and every job is receiving more applications.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr><td style="border-top:1px solid #E5E7EB;"></td></tr>
              </table>

              <p style="margin:0 0 12px 0;font-size:15px;font-weight:bold;color:#1B2A4A;">Make your profile impossible to overlook</p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.6;">
                Employers consistently shortlist candidates with verified references. The <strong>Build My Reputation</strong> tool lets your past clients vouch for you in under 60 seconds — and a verified badge appears on your profile the moment they submit.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#D8690E;border-radius:8px;">
                    <a href="${reputationLink}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">
                      &#8594; Build My Reputation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px 0;font-size:14px;color:#6B7280;line-height:1.6;">
                Send your unique link to a production manager, venue contact, or project manager you have worked with. Every reference they submit strengthens your position for every future role on the platform.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr><td style="border-top:1px solid #E5E7EB;"></td></tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">
                New jobs are posted regularly. Keep your profile up to date and you will be first in line.
              </p>

              <p style="margin:24px 0 0 0;font-size:14px;color:#374151;">
                Best of luck,<br/>
                <strong>The EventLink Team</strong><br/>
                <a href="https://eventlink.one" style="color:#D8690E;text-decoration:none;">eventlink.one</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB;padding:20px 36px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
                You are receiving this because you applied for a job on EventLink.<br/>
                <a href="${unsubscribeLink}" style="color:#9CA3AF;">Unsubscribe</a>
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

    try {
      await sgMail.send({
        to: freelancer.email,
        from: {
          email: "loris@eventlink.one",
          name: "EventLink",
        },
        replyTo: "loris@eventlink.one",
        subject,
        text: textContent,
        html: htmlContent,
      });

      await db
        .update(job_applications)
        .set({
          closure_email_sent: true,
          closure_email_sent_at: new Date(),
        })
        .where(eq(job_applications.id, applicant.applicationId));

      sentCount++;
    } catch (error) {
      console.error(
        `Failed to send closure email to freelancer ${freelancer.id} for job ${jobId}:`,
        error
      );
    }
  }

  console.log(`Job ${jobId} closure: ${sentCount} emails sent`);
}
