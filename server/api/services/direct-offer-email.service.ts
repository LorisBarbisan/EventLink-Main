import { sendEmail } from "../utils/emailService";
import { directOfferConfirmEmail, directOfferSentEmail } from "../utils/emailTemplates";
import { SITE_URL } from "../config/site";

export async function sendDirectOfferMagicLink({
  to,
  contactName,
  freelancerName,
  jobTitle,
  token,
}: {
  to: string;
  contactName: string;
  freelancerName: string;
  jobTitle: string;
  token: string;
}): Promise<void> {
  const confirmUrl = `${SITE_URL}/confirm-offer?token=${token}`;
  const { subject, html } = directOfferConfirmEmail({
    contactName,
    freelancerName,
    jobTitle,
    confirmUrl,
  });
  await sendEmail({
    to,
    subject,
    html,
    text: `Hi ${contactName},\n\nConfirm your job offer "${jobTitle}" to ${freelancerName} on EventLink:\n${confirmUrl}\n\nThis offer goes only to ${freelancerName} and expires in 24 hours. If you didn't request this, ignore this email.`,
  });
}

export async function sendDirectOfferConfirmation({
  to,
  contactName,
  freelancerName,
  jobTitle,
  setPasswordToken,
}: {
  to: string;
  contactName: string;
  freelancerName: string;
  jobTitle: string;
  setPasswordToken?: string;
}): Promise<void> {
  const setPasswordUrl = setPasswordToken
    ? `${SITE_URL}/reset-password?token=${setPasswordToken}&mode=set`
    : `${SITE_URL}/auth`;
  const { subject, html } = directOfferSentEmail({
    contactName,
    freelancerName,
    jobTitle,
    setPasswordUrl,
    hasToken: !!setPasswordToken,
  });
  await sendEmail({
    to,
    subject,
    html,
    text: `Hi ${contactName},\n\n"${jobTitle}" has been sent to ${freelancerName} on EventLink. They can accept or decline from their dashboard.\n\nUse the button in this email to set a password and manage your offer.`,
  });
}
