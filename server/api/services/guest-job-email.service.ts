import { sendEmail } from "../utils/emailService";
import {
  guestJobConfirmEmail,
  guestJobPublishedEmail,
  guestJobNudgeEmail,
  guestApplicationNotificationEmail,
} from "../utils/emailTemplates";

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
  const { subject, html } = guestJobConfirmEmail({ contactName, jobTitle, confirmUrl });
  await sendEmail({
    to,
    subject,
    html,
    text: `Hi ${contactName},\n\nConfirm your job post "${jobTitle}" on EventLink:\n${confirmUrl}\n\nThis link expires in 24 hours. If you didn't submit a job post, ignore this email.`,
  });
}

export async function sendGuestJobPublishedConfirmation({
  to,
  contactName,
  jobTitle,
  jobId,
  setPasswordToken,
}: {
  to: string;
  contactName: string;
  jobTitle: string;
  jobId: number;
  setPasswordToken?: string;
}): Promise<void> {
  const jobUrl = `${BASE_URL}/jobs/${jobId}`;
  const setPasswordUrl = setPasswordToken
    ? `${BASE_URL}/reset-password?token=${setPasswordToken}&mode=set`
    : `${BASE_URL}/auth`;
  const { subject, html } = guestJobPublishedEmail({
    contactName,
    jobTitle,
    jobUrl,
    setPasswordUrl,
    hasToken: !!setPasswordToken,
  });
  await sendEmail({
    to,
    subject,
    html,
    text: `Hi ${contactName},\n\n"${jobTitle}" is now live on EventLink.\nView it here: ${jobUrl}\n\nUse the button in this email to set a password and manage your job.`,
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
  token: string;
}): Promise<void> {
  const confirmUrl = `${BASE_URL}/confirm-job?token=${token}`;
  const { subject, html } = guestJobNudgeEmail({ contactName, jobTitle, confirmUrl });
  await sendEmail({
    to,
    subject,
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
  setPasswordToken,
}: {
  to: string;
  contactName: string;
  jobTitle: string;
  freelancerName: string;
  freelancerTitle?: string;
  coverLetterPreview?: string;
  viewUrl: string;
  setPasswordToken?: string;
}): Promise<void> {
  const setPasswordUrl = setPasswordToken
    ? `${BASE_URL}/reset-password?token=${setPasswordToken}&mode=set`
    : `${BASE_URL}/auth?tab=signup`;
  const { subject, html } = guestApplicationNotificationEmail({
    contactName,
    jobTitle,
    freelancerName,
    freelancerTitle,
    coverLetterPreview,
    viewUrl,
    setPasswordUrl,
    hasToken: !!setPasswordToken,
  });
  await sendEmail({
    to,
    subject,
    html,
    text: `Hi ${contactName},\n\n${freelancerName}${freelancerTitle ? ` (${freelancerTitle})` : ""} has applied to your job "${jobTitle}" on EventLink.\n\nUse the buttons in this email to view their application and set a password to manage all your applications.`,
  });
}
