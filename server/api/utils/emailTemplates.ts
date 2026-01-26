/**
 * Master email template with EventLink branding
 * Features: Orange gradient header, consistent footer, responsive design
 */
function masterTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EventLink Notification</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      line-height: 1.6;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #D8690E 0%, #ff8c42 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 32px 24px;
      color: #333333;
    }
    .button {
      display: inline-block;
      padding: 12px 32px;
      background: linear-gradient(135deg, #D8690E 0%, #ff8c42 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 16px 0;
    }
    .footer {
      background-color: #f9f9f9;
      padding: 24px;
      text-align: center;
      color: #666666;
      font-size: 14px;
      border-top: 1px solid #eeeeee;
    }
    .footer a {
      color: #D8690E;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        margin: 0;
        border-radius: 0;
      }
      .content {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1 class="logo">EventLink</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} EventLink. Showcase Talent - Share Opportunities - Build Connections</p>
      <p>
        <a href="https://eventlink.one">Visit EventLink</a> |
        <a href="https://eventlink.one/notification-settings">Notification Settings</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * New Message Notification Template
 */
export function messageNotificationEmail(data: {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  conversationUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h2>📩 New message from ${data.senderName}</h2>
    <p>Hi ${data.recipientName},</p>
    <p>You have received a new message on EventLink:</p>
    <div style="background-color: #f9f9f9; border-left: 4px solid #D8690E; padding: 16px; margin: 16px 0; border-radius: 4px;">
      <p style="margin: 0; font-style: italic;">"${data.messagePreview}"</p>
    </div>
    <p>
      <a href="${data.conversationUrl}" class="button">View Message</a>
    </p>
    <p style="color: #666; font-size: 14px;">
      Click the button above to read and reply to this message.
    </p>
  `;

  return {
    subject: `📩 New message from ${data.senderName} on EventLink`,
    html: masterTemplate(content),
  };
}

/**
 * Application Update Notification Template (for freelancers)
 */
export function applicationUpdateEmail(data: {
  recipientName: string;
  jobTitle: string;
  companyName: string;
  status: string;
  applicationUrl: string;
}): { subject: string; html: string } {
  const statusMessages: Record<string, { emoji: string; message: string }> = {
    reviewed: { emoji: "👀", message: "Your application is being reviewed" },
    shortlisted: { emoji: "⭐", message: "You have been shortlisted" },
    rejected: { emoji: "📋", message: "Application status update" },
    hired: { emoji: "🎉", message: "Congratulations! You have been hired" },
  };

  const statusInfo = statusMessages[data.status] || {
    emoji: "🔔",
    message: "Application status update",
  };

  const content = `
    <h2>${statusInfo.emoji} ${statusInfo.message}</h2>
    <p>Hi ${data.recipientName},</p>
    <p>
      Your application for <strong>${data.jobTitle}</strong> at <strong>${data.companyName}</strong>
      has been updated to: <strong>${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</strong>.
    </p>
    ${
      data.status === "hired"
        ? `
      <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; color: #166534;">
          <strong>Congratulations!</strong> The recruiter has selected you for this position.
          Check your dashboard for next steps.
        </p>
      </div>
    `
        : ""
    }
    <p>
      <a href="${data.applicationUrl}" class="button">View Application</a>
    </p>
  `;

  return {
    subject: `🔔 Update on your application for ${data.jobTitle}`,
    html: masterTemplate(content),
  };
}

/**
 * New Job Application Notification Template (for recruiters)
 */
export function newApplicationEmail(data: {
  recipientName: string;
  jobTitle: string;
  freelancerName: string;
  freelancerTitle?: string;
  applicationUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h2>📥 New application for ${data.jobTitle}</h2>
    <p>Hi ${data.recipientName},</p>
    <p>
      <strong>${data.freelancerName}</strong>${data.freelancerTitle ? ` (${data.freelancerTitle})` : ""}
      has applied to your job posting <strong>"${data.jobTitle}"</strong>.
    </p>
    <p>
      Review their profile and application to find the perfect candidate for your event.
    </p>
    <p>
      <a href="${data.applicationUrl}" class="button">Review Application</a>
    </p>
    <p style="color: #666; font-size: 14px;">
      Respond quickly to secure top talent for your event!
    </p>
  `;

  return {
    subject: `📥 New application for ${data.jobTitle}`,
    html: masterTemplate(content),
  };
}

/**
 * Job Alert Notification Template (for freelancers)
 */
export function jobAlertEmail(data: {
  recipientName: string;
  jobTitle: string;
  companyName: string;
  location: string;
  rate: string;
  eventDate: string;
  jobUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h2>🚀 New job matching your preferences</h2>
    <p>Hi ${data.recipientName},</p>
    <p>A new job has been posted that matches your job alert preferences:</p>
    <div style="background-color: #f9f9f9; border: 1px solid #e5e5e5; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; color: #D8690E;">${data.jobTitle}</h3>
      <p style="margin: 8px 0;"><strong>Company:</strong> ${data.companyName}</p>
      <p style="margin: 8px 0;"><strong>Location:</strong> ${data.location}</p>
      <p style="margin: 8px 0;"><strong>Rate:</strong> ${data.rate}</p>
      <p style="margin: 8px 0;"><strong>Event Date:</strong> ${data.eventDate}</p>
    </div>
    <p>
      <a href="${data.jobUrl}" class="button">View Job Details</a>
    </p>
    <p style="color: #666; font-size: 14px;">
      Apply quickly to increase your chances of getting hired!
    </p>
  `;

  return {
    subject: `🚀 New job posted: ${data.jobTitle}`,
    html: masterTemplate(content),
  };
}

/**
 * Rating Request Notification Template
 */
export function ratingRequestEmail(data: {
  recipientName: string;
  requesterName: string;
  jobTitle: string;
  ratingUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h2>⭐ Rating request from ${data.requesterName}</h2>
    <p>Hi ${data.recipientName},</p>
    <p>
      <strong>${data.requesterName}</strong> has requested a rating for the completed job
      <strong>"${data.jobTitle}"</strong>.
    </p>
    <p>
      Your feedback helps build trust in the EventLink community and helps others make informed hiring decisions.
    </p>
    <p>
      <a href="${data.ratingUrl}" class="button">Submit Rating</a>
    </p>
    <p style="color: #666; font-size: 14px;">
      Ratings are visible on profiles and help establish credibility.
    </p>
  `;

  return {
    subject: `⭐ Please rate your experience with ${data.requesterName}`,
    html: masterTemplate(content),
  };
}

/**
 * System Update/Announcement Template
 */
export function systemUpdateEmail(data: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}): { subject: string; html: string } {
  const content = `
    <h2>🔔 ${data.title}</h2>
    <p>Hi ${data.recipientName},</p>
    <div style="line-height: 1.8;">
      ${data.message}
    </div>
    ${
      data.actionUrl && data.actionText
        ? `
      <p>
        <a href="${data.actionUrl}" class="button">${data.actionText}</a>
      </p>
    `
        : ""
    }
  `;

  return {
    subject: `🔔 ${data.title}`,
    html: masterTemplate(content),
  };
}

/**
 * Email Verification Template
 */
export function emailVerificationEmail(data: { recipientName: string; verificationUrl: string }): {
  subject: string;
  html: string;
} {
  const content = `
    <h2>✅ Verify your email address</h2>
    <p>Hi ${data.recipientName},</p>
    <p>Welcome to EventLink! Please verify your email address to complete your registration.</p>
    <p>
      <a href="${data.verificationUrl}" class="button">Verify Email</a>
    </p>
    <p style="color: #666; font-size: 14px;">
      If you didn't create an account with EventLink, you can safely ignore this email.
    </p>
  `;

  return {
    subject: "✅ Verify your EventLink account",
    html: masterTemplate(content),
  };
}

/**
 * Password Reset Template
 */
export function passwordResetEmail(data: { recipientName: string; resetUrl: string }): {
  subject: string;
  html: string;
} {
  const content = `
    <h2>🔐 Reset your password</h2>
    <p>Hi ${data.recipientName},</p>
    <p>You requested to reset your password. Click the button below to create a new password:</p>
    <p>
      <a href="${data.resetUrl}" class="button">Reset Password</a>
    </p>
    <p style="color: #666; font-size: 14px;">
      This link will expire in 1 hour. If you didn't request this, please ignore this email.
    </p>
  `;

  return {
    subject: "🔐 Reset your EventLink password",
    html: masterTemplate(content),
  };
}

/**
 * Invitation to Apply Template
 */
export function invitationEmail(data: {
  recipientName: string;
  recruiterName: string;
  jobTitle: string;
  message: string;
  jobUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h2>👋 You've been invited to apply!</h2>
    <p>Hi ${data.recipientName},</p>
    <p>
      <strong>${data.recruiterName}</strong> has invited you to apply for their job
      <strong>"${data.jobTitle}"</strong>.
    </p>
    <div style="background-color: #f9f9f9; border-left: 4px solid #D8690E; padding: 16px; margin: 16px 0; border-radius: 4px;">
      <p style="margin: 0; font-style: italic;">"${data.message}"</p>
    </div>
    <p>
      Review the job details and submit your application if you're interested!
    </p>
    <p>
      <a href="${data.jobUrl}" class="button">View Job & Apply</a>
    </p>
  `;

  return {
    subject: `👋 Invited to apply: ${data.jobTitle}`,
    html: masterTemplate(content),
  };
}
