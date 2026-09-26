import { sendEmail } from "../utils/emailService";

const BASE_URL = process.env.BASE_URL || "https://eventlink.one";

export async function sendGuestJobMagicLink({
  to,
  contactName,
  jobTitle,
  token,
}: {
  to: string;
  contactName: string;
  jobTitle: string;
  token: string;
}): Promise<void> {
  const confirmUrl = `${BASE_URL}/confirm-job?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#D8690E,#ff8c42);padding:28px 36px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">EventLink</p>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Confirm your job post</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Hi ${contactName},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
            We received your request to post <strong>&ldquo;${jobTitle}&rdquo;</strong> on EventLink.
            Click the button below to confirm and publish it. This link expires in&nbsp;24&nbsp;hours.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="background:linear-gradient(135deg,#D8690E,#ff8c42);border-radius:6px;">
              <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                Confirm &amp; Publish Job
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
            Or copy this link into your browser:
          </p>
          <p style="margin:0 0 24px;font-size:12px;color:#D8690E;word-break:break-all;">${confirmUrl}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            If you didn&rsquo;t submit a job post, you can safely ignore this email.
            This link is single-use and will expire automatically.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to,
    subject: `Confirm your job post on EventLink: "${jobTitle}"`,
    html,
    text: `Hi ${contactName},\n\nConfirm your job post "${jobTitle}" on EventLink:\n${confirmUrl}\n\nThis link expires in 24 hours. If you didn't submit a job post, ignore this email.`,
  });
}

export async function sendGuestJobPublishedConfirmation({
  to,
  contactName,
  jobTitle,
  jobId,
}: {
  to: string;
  contactName: string;
  jobTitle: string;
  jobId: number;
}): Promise<void> {
  const jobUrl = `${BASE_URL}/jobs/${jobId}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#D8690E,#ff8c42);padding:28px 36px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">EventLink</p>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Your job is live!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Hi ${contactName},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
            <strong>&ldquo;${jobTitle}&rdquo;</strong> is now live on EventLink and visible to freelancers.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="background:linear-gradient(135deg,#D8690E,#ff8c42);border-radius:6px;">
              <a href="${jobUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                View Your Job Post
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
            Want to manage applications and re-post jobs in future?
            <a href="${BASE_URL}/auth" style="color:#D8690E;text-decoration:none;">Create a free account</a>
            using the same email address and your post will be linked automatically.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">EventLink &mdash; the freelance events industry network.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to,
    subject: `Your job "${jobTitle}" is now live on EventLink`,
    html,
    text: `Hi ${contactName},\n\n"${jobTitle}" is now live on EventLink.\nView it here: ${jobUrl}\n\nWant to manage it? Create a free account at ${BASE_URL}/auth using the same email.`,
  });
}

export async function sendGuestJobNudge({
  to,
  contactName,
  jobTitle,
  token,
}: {
  to: string;
  contactName: string;
  jobTitle: string;
  token: string; // raw token (not hash)
}): Promise<void> {
  const confirmUrl = `${BASE_URL}/confirm-job?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#D8690E,#ff8c42);padding:28px 36px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">EventLink</p>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Still waiting on you!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Hi ${contactName},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
            Your job post <strong>&ldquo;${jobTitle}&rdquo;</strong> is ready to go live on EventLink
            but we&rsquo;re still waiting for you to confirm it. Freelancers won&rsquo;t see it until
            you click the button below.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="background:linear-gradient(135deg,#D8690E,#ff8c42);border-radius:6px;">
              <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                Confirm &amp; Publish Job
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Or copy this link:</p>
          <p style="margin:0 0 24px;font-size:12px;color:#D8690E;word-break:break-all;">${confirmUrl}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            This is a one-time reminder. The link expires 24&nbsp;hours after your original
            submission. If you didn&rsquo;t request this, you can safely ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to,
    subject: `Reminder: confirm your job post on EventLink — "${jobTitle}"`,
    html,
    text: `Hi ${contactName},\n\nYour job post "${jobTitle}" is waiting to be confirmed. Click the link to publish it:\n${confirmUrl}\n\nThis is a one-time reminder. The link expires 24 hours after your original submission.`,
  });
}

export async function sendGuestApplicationNotification({
  to,
  contactName,
  jobTitle,
  freelancerName,
  freelancerTitle,
  coverLetterPreview,
  viewUrl,
}: {
  to: string;
  contactName: string;
  jobTitle: string;
  freelancerName: string;
  freelancerTitle?: string;
  coverLetterPreview?: string;
  viewUrl: string;
}): Promise<void> {
  const registerUrl = `${BASE_URL}/auth?tab=signup`;
  const preview = coverLetterPreview
    ? coverLetterPreview.slice(0, 200) + (coverLetterPreview.length > 200 ? "…" : "")
    : null;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#D8690E,#ff8c42);padding:28px 36px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">EventLink</p>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">&#128231; New application for &ldquo;${jobTitle}&rdquo;</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Hi ${contactName},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
            <strong>${freelancerName}</strong>${freelancerTitle ? ` &mdash; ${freelancerTitle}` : ""}
            has applied to your job posting on EventLink.
          </p>
          ${
            preview
              ? `<div style="background:#f9fafb;border-left:3px solid #D8690E;padding:12px 16px;margin:0 0 24px;border-radius:0 6px 6px 0;">
            <p style="margin:0;font-size:13px;color:#6b7280;font-style:italic;">&ldquo;${preview}&rdquo;</p>
          </div>`
              : ""
          }
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:linear-gradient(135deg,#D8690E,#ff8c42);border-radius:6px;">
              <a href="${viewUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                View Application
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Or copy this link into your browser:</p>
          <p style="margin:0 0 24px;font-size:12px;color:#D8690E;word-break:break-all;">${viewUrl}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;">
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
            Want to manage all your applications in one place?
            <a href="${registerUrl}" style="color:#D8690E;text-decoration:none;font-weight:600;">Create a free EventLink account</a>
            &mdash; no obligation, cancel any time.
          </p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:20px 36px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} EventLink &mdash; Showcase Talent &middot; Share Opportunities &middot; Build Connections</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to,
    subject: `New application for your job "${jobTitle}" on EventLink`,
    html,
    text: `Hi ${contactName},\n\n${freelancerName}${freelancerTitle ? ` (${freelancerTitle})` : ""} has applied to your job "${jobTitle}" on EventLink.\n\nView their application here:\n${viewUrl}\n\nThis link is valid for 30 days.\n\nWant to manage all your applications? Create a free account at ${registerUrl}`,
  });
}
