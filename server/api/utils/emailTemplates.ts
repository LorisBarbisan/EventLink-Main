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
  emailSubject?: string;
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
    subject: data.emailSubject?.trim() || `📩 New message from ${data.senderName} on EventLink`,
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
          <strong>Congratulations!</strong> The employer has selected you for this position.
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

/**
 * Welcome email for new freelancer registrations
 */
export function freelancerWelcomeEmail(data: {
  firstName: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  return {
    subject: "Welcome to EventLink — here's how to get found by employers",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 15px; color: #1F2937; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 0;">

  <div style="background: linear-gradient(135deg, #D8690E 0%, #ff8c42 100%); padding: 28px 24px; text-align: center; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px;">EventLink</p>
  </div>

  <div style="padding: 28px 24px;">

  <p>Hi ${data.firstName},</p>

  <p>Welcome to EventLink — the UK's verified event crew platform.</p>

  <p>You've signed up. Now one step makes all the difference: <strong>completing your profile.</strong></p>

  <p>Until your profile is live, you're invisible to the production companies, AV suppliers, and venues searching for crew on EventLink right now. A completed profile changes that — and it takes less than three minutes if you upload your CV and let the AI parser do the work.</p>

  <p>Watch this short tutorial to see exactly how it's done:</p>

  <a href="https://www.youtube.com/watch?v=-V_xTPkC8UA" target="_blank" style="display:block; margin: 24px 0;">
    <img
      src="https://img.youtube.com/vi/-V_xTPkC8UA/maxresdefault.jpg"
      alt="Watch: How to Create Your Freelancer Profile on EventLink"
      width="560"
      style="width:100%; max-width:560px; border-radius:8px; border:3px solid #4F46E5; display:block;"
    />
  </a>

  <p style="margin: 24px 0;">
    <a href="https://eventlink.one/dashboard" style="background-color:#4F46E5; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">
      Complete My Profile Now →
    </a>
  </p>

  <hr style="border:none; border-top:1px solid #E5E7EB; margin:24px 0;">

  <p style="font-size:14px; color:#374151;"><strong>What your profile gives you:</strong></p>
  <ul style="font-size:14px; color:#374151; padding-left:20px; line-height:1.8;">
    <li>Visibility in employer searches by role and location</li>
    <li>A verified badge for credentials — SIA, DBS, First Aid and more</li>
    <li>A reliability score built from real employer ratings</li>
    <li>LinkedIn-verified references that travel with you</li>
    <li>A shareable profile link you can send instead of a CV</li>
  </ul>

  <hr style="border:none; border-top:1px solid #E5E7EB; margin:24px 0;">

  <p>The events industry is busy. Employers are posting jobs. Make sure you're there when they search.</p>

  <p>Loris<br>
  Founder, EventLink<br>
  <a href="https://eventlink.one" style="color:#4F46E5;">eventlink.one</a></p>

  <p style="font-size:13px; color:#6B7280;">
    P.S. Once your profile is live, use the <strong>Build My Reputation</strong> tool to collect verified references from past clients. It takes them 45 seconds to complete and it's the single most powerful thing on your profile.
  </p>

  <hr style="border:none; border-top:1px solid #E5E7EB; margin:24px 0;">

  <p style="font-size:11px; color:#9CA3AF; text-align:center;">
    You're receiving this because you created an account on EventLink.<br>
    <a href="${data.unsubscribeUrl}" style="color:#9CA3AF;">Unsubscribe</a>
  </p>

  </div>

</body>
</html>`,
  };
}

/**
 * Welcome email for new employer/recruiter registrations
 */
export function employerWelcomeEmail(data: {
  firstName: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  return {
    subject: "Welcome to EventLink — post your first job and reach verified crew",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 15px; color: #1F2937; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 0;">

  <div style="background: linear-gradient(135deg, #D8690E 0%, #ff8c42 100%); padding: 28px 24px; text-align: center; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px;">EventLink</p>
  </div>

  <div style="padding: 28px 24px;">

  <p>Hi ${data.firstName},</p>

  <p>Welcome to EventLink — the UK's verified event crew platform.</p>

  <p>You can now post jobs and search profiles across our growing network of verified freelance technicians — sound engineers, lighting technicians, AV technicians, riggers, stage managers, production managers and more.</p>

  <p>Every profile on EventLink includes confirmed credentials, a reliability score from past employers, and LinkedIn-verified references. <strong>You're not hiring on hope — you're hiring on evidence.</strong></p>

  <p>Watch this short tutorial to see how to post your first job:</p>

  <a href="https://www.youtube.com/watch?v=2JxKSwMq5hE" target="_blank" style="display:block; margin: 24px 0;">
    <img
      src="https://img.youtube.com/vi/2JxKSwMq5hE/maxresdefault.jpg"
      alt="Watch: How to Post a Job on EventLink"
      width="560"
      style="width:100%; max-width:560px; border-radius:8px; border:3px solid #4F46E5; display:block;"
    />
  </a>

  <p style="margin: 24px 0;">
    <a href="https://eventlink.one/post-job" style="background-color:#4F46E5; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">
      Post My First Job Now →
    </a>
  </p>

  <hr style="border:none; border-top:1px solid #E5E7EB; margin:24px 0;">

  <p style="font-size:14px; color:#374151;"><strong>What you can do on EventLink:</strong></p>
  <ul style="font-size:14px; color:#374151; padding-left:20px; line-height:1.8;">
    <li>Post a job and reach matching freelancers instantly</li>
    <li>Search verified profiles directly from the Crew Board</li>
    <li>Save trusted crew to your pool for fast re-hiring</li>
    <li>Rate freelancers after the job to help the community</li>
  </ul>

  <hr style="border:none; border-top:1px solid #E5E7EB; margin:24px 0;">

  <p>If you have any questions or would like a quick walkthrough, reply to this email and I'll get back to you personally.</p>

  <p>Loris<br>
  Founder, EventLink<br>
  <a href="https://eventlink.one" style="color:#4F46E5;">eventlink.one</a></p>

  <p style="font-size:13px; color:#6B7280;">
    P.S. If you have a crew call coming up and want us to match you with the right freelancers directly, just reply with the details — happy to help personally while the platform is in its early stages.
  </p>

  <hr style="border:none; border-top:1px solid #E5E7EB; margin:24px 0;">

  <p style="font-size:11px; color:#9CA3AF; text-align:center;">
    You're receiving this because you created an account on EventLink.<br>
    <a href="${data.unsubscribeUrl}" style="color:#9CA3AF;">Unsubscribe</a>
  </p>

  </div>

</body>
</html>`,
  };
}

/**
 * Batch job notification email template (automated batch window sends)
 */
export function batchJobNotifyEmail(data: {
  recipientFirstName: string;
  jobs: Array<{
    title: string;
    employerName: string;
    location: string;
    payRate: string;
    eventDate: string;
    descriptionPreview: string;
    jobUrl: string;
  }>;
  dashboardUrl: string;
  unsubscribeUrl: string;
  isUrgent?: boolean;
}): { subject: string; html: string } {
  const jobCount = data.jobs.length;

  const subject = data.isUrgent && jobCount === 1
    ? `Urgent — ${data.jobs[0].title} needed in ${data.jobs[0].location} ${data.jobs[0].eventDate}`
    : jobCount === 1
    ? `New job on EventLink — ${data.jobs[0].title} in ${data.jobs[0].location}`
    : `${jobCount} new jobs on EventLink matching your profile`;

  const jobCards = data.jobs.map(job => `
    <div style="border:1px solid #e5e5e5; border-radius:8px; padding:16px 20px; margin:16px 0; background:#fafafa;">
      <p style="margin:0 0 6px 0; font-size:16px; font-weight:600; color:#D8690E;">${job.title}</p>
      <p style="margin:0 0 4px 0; color:#444;">${job.employerName} &middot; ${job.location} &middot; ${job.payRate}</p>
      <p style="margin:0 0 8px 0; color:#666; font-size:14px;">${job.eventDate}</p>
      ${job.descriptionPreview ? `<p style="margin:0 0 10px 0; font-size:14px; color:#444;">${job.descriptionPreview}</p>` : ""}
      <a href="${job.jobUrl}" style="display:inline-block; padding:8px 20px; background:linear-gradient(135deg,#D8690E 0%,#ff8c42 100%); color:#fff; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px;">View &amp; Apply &rarr;</a>
    </div>
  `).join("");

  const content = `
    <p>Hi ${data.recipientFirstName},</p>
    <p>Here are the latest jobs on EventLink that match your skills and location.</p>
    ${jobCards}
    <p style="margin-top:24px;">Keep your profile and availability up to date so employers can find you.</p>
    <p><a href="${data.dashboardUrl}" class="button">View your profile</a></p>
    <p style="color:#666; font-size:13px;">
      You're receiving this because you have a verified profile on EventLink.<br/>
      <a href="${data.unsubscribeUrl}" style="color:#D8690E;">Unsubscribe from job alerts</a>
    </p>
  `;

  return { subject, html: masterTemplate(content) };
}

/**
 * Admin "Notify Freelancers" — single job notification template
 */
export function singleJobNotifyEmail(data: {
  recipientFirstName: string;
  jobTitle: string;
  employerName: string;
  location: string;
  payRate: string;
  eventDate: string;
  descriptionPreview: string;
  jobUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const content = `
    <p>Hi ${data.recipientFirstName},</p>
    <p>A new job matching your profile has just been posted on EventLink.</p>
    <div style="background-color: #f9f9f9; border: 1px solid #e5e5e5; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; color: #D8690E;">${data.jobTitle}</h3>
      <p style="margin: 6px 0;">${data.employerName} &middot; ${data.location} &middot; ${data.payRate}</p>
      <p style="margin: 6px 0; color: #666;">${data.eventDate}</p>
      ${data.descriptionPreview ? `<p style="margin: 12px 0 0 0; font-size: 14px; color: #444;">${data.descriptionPreview}</p>` : ""}
    </div>
    <p>
      <a href="${data.jobUrl}" class="button">View full job and apply</a>
    </p>
    <p>Your EventLink profile is live and visible to employers.</p>
    <p>Make sure you request credentials from your current and past clients using <strong>Built My Reputation</strong> in the header of your dashboard.</p>
    <p style="color: #666; font-size: 13px;">
      You're receiving this because you have a verified profile on EventLink.<br/>
      <a href="${data.unsubscribeUrl}" style="color: #D8690E;">Unsubscribe from job alerts</a>
    </p>
  `;

  return {
    subject: `New job on EventLink — ${data.jobTitle} in ${data.location}`,
    html: masterTemplate(content),
  };
}

/**
 * Availability Enquiry — sent to freelancers with one-click Yes/Maybe/No response links
 */
export function generateAvailabilityEnquiryEmail(data: {
  freelancerFirstName: string;
  employerName: string;
  eventTitle: string;
  eventDate: string;
  callTime?: string | null;
  venueAddress?: string | null;
  roleRequired?: string | null;
  agreedRate?: string | null;
  additionalNotes?: string | null;
  responseToken: string;
  baseUrl: string;
}): { subject: string; html: string } {
  const yesUrl = `${data.baseUrl}/availability/respond/${data.responseToken}?r=yes`;
  const noUrl = `${data.baseUrl}/availability/respond/${data.responseToken}?r=no`;
  const maybeUrl = `${data.baseUrl}/availability/respond/${data.responseToken}?r=maybe`;
  const detailUrl = `${data.baseUrl}/availability/respond/${data.responseToken}`;

  const detailRows = [
    data.callTime
      ? `<tr><td style="padding:10px 12px;font-weight:600;width:35%;background:#f9f9f9;border-bottom:1px solid #eee;">Call time</td><td style="padding:10px 12px;border-bottom:1px solid #eee;">${data.callTime}</td></tr>`
      : "",
    data.venueAddress
      ? `<tr><td style="padding:10px 12px;font-weight:600;width:35%;background:#f9f9f9;border-bottom:1px solid #eee;">Venue</td><td style="padding:10px 12px;border-bottom:1px solid #eee;">${data.venueAddress}</td></tr>`
      : "",
    data.roleRequired
      ? `<tr><td style="padding:10px 12px;font-weight:600;width:35%;background:#f9f9f9;border-bottom:1px solid #eee;">Role</td><td style="padding:10px 12px;border-bottom:1px solid #eee;">${data.roleRequired}</td></tr>`
      : "",
    data.agreedRate
      ? `<tr><td style="padding:10px 12px;font-weight:600;width:35%;background:#f9f9f9;">Rate</td><td style="padding:10px 12px;">${data.agreedRate}</td></tr>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const content = `
    <p>Hi ${data.freelancerFirstName},</p>
    <p><strong>${data.employerName}</strong> is checking your availability for the following event:</p>

    <table style="width:100%;border-collapse:collapse;margin:24px 0;border:1px solid #eee;border-radius:6px;overflow:hidden;">
      <tr style="background:#f9f9f9;">
        <td style="padding:10px 12px;font-weight:600;width:35%;border-bottom:1px solid #eee;">Event</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${data.eventTitle}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;width:35%;background:#f9f9f9;border-bottom:1px solid #eee;">Date</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${data.eventDate}</td>
      </tr>
      ${detailRows}
    </table>

    ${data.additionalNotes ? `<div style="background:#f0f4ff;padding:16px;border-radius:6px;border-left:4px solid #D8690E;margin-bottom:24px;"><p style="margin:0;color:#444;">${data.additionalNotes}</p></div>` : ""}

    <p style="font-weight:600;margin-top:28px;">Are you available?</p>
    <table style="border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding-right:12px;">
          <a href="${yesUrl}" style="display:inline-block;background:#1A6B3C;color:#fff;padding:14px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">✓ Yes, I'm available</a>
        </td>
        <td style="padding-right:12px;">
          <a href="${maybeUrl}" style="display:inline-block;background:#D8690E;color:#fff;padding:14px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">? Maybe / Need more info</a>
        </td>
        <td>
          <a href="${noUrl}" style="display:inline-block;background:#6c757d;color:#fff;padding:14px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">✗ Not available</a>
        </td>
      </tr>
    </table>

    <p style="color:#888;font-size:13px;margin-top:20px;">
      Or <a href="${detailUrl}" style="color:#D8690E;">view full details and respond here</a>.
    </p>
    <p style="color:#888;font-size:13px;">
      You're receiving this because an employer on EventLink is checking your availability.
    </p>
  `;

  return {
    subject: `Availability check: ${data.eventTitle} — ${data.eventDate}`,
    html: masterTemplate(content),
  };
}

export function generateEnquiryCancelledEmail(data: {
  freelancerFirstName: string;
  employerName: string;
  eventTitle: string;
  eventDate: string;
}): string {
  return `
    <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
      <div style='background:#1E3A5F;padding:24px;text-align:center;'>
        <h1 style='color:#fff;margin:0;font-size:24px;'>EventLink</h1>
      </div>
      <div style='padding:32px;'>
        <p>Hi ${data.freelancerFirstName},</p>
        <p>This is to let you know that <strong>${data.employerName}</strong> has
        cancelled the availability check for <strong>${data.eventTitle}</strong>
        on <strong>${data.eventDate}</strong>.</p>
        <p>No action is required from you.</p>
      </div>
      <div style='background:#f5f5f5;padding:16px;text-align:center;color:#888;font-size:12px;'>
        EventLink — The UK Events Industry Network
      </div>
    </div>
  `;
}

export function generateEnquiryUpdatedEmail(data: {
  freelancerFirstName: string;
  employerName: string;
  eventTitle: string;
  eventDate: string;
  eventEndDate?: string | null;
  callTime?: string | null;
  venueAddress?: string | null;
  responseToken: string;
  baseUrl: string;
}): string {
  const detailUrl = `${data.baseUrl}/availability/respond/${data.responseToken}`;
  return `
    <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
      <div style='background:#1E3A5F;padding:24px;text-align:center;'>
        <h1 style='color:#fff;margin:0;font-size:24px;'>EventLink</h1>
      </div>
      <div style='padding:32px;'>
        <p>Hi ${data.freelancerFirstName},</p>
        <p><strong>${data.employerName}</strong> has updated the details for
        <strong>${data.eventTitle}</strong>. Please review the updated information:</p>
        <table style='width:100%;border-collapse:collapse;margin:24px 0;'>
          <tr style='background:#f5f5f5;'>
            <td style='padding:12px;font-weight:bold;width:35%;'>Date</td>
            <td style='padding:12px;'>${data.eventDate}</td>
          </tr>
          ${data.callTime ? `<tr><td style='padding:12px;font-weight:bold;'>Call time</td><td style='padding:12px;'>${data.callTime}</td></tr>` : ''}
          ${data.venueAddress ? `<tr><td style='padding:12px;font-weight:bold;'>Venue</td><td style='padding:12px;'>${data.venueAddress}</td></tr>` : ''}
        </table>
        <p>If your availability has changed, please
        <a href='${detailUrl}'>update your response here</a>.</p>
      </div>
      <div style='background:#f5f5f5;padding:16px;text-align:center;color:#888;font-size:12px;'>
        EventLink — The UK Events Industry Network
      </div>
    </div>
  `;
}

export function generateEnquiryRemovedEmail(data: {
  freelancerFirstName: string;
  employerName: string;
  eventTitle: string;
  eventDate: string;
}): string {
  return `
    <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
      <div style='background:#1E3A5F;padding:24px;text-align:center;'>
        <h1 style='color:#fff;margin:0;font-size:24px;'>EventLink</h1>
      </div>
      <div style='padding:32px;'>
        <p>Hi ${data.freelancerFirstName},</p>
        <p><strong>${data.employerName}</strong> has withdrawn the availability
        check for <strong>${data.eventTitle}</strong> on <strong>${data.eventDate}</strong>.
        You no longer need to respond.</p>
        <p>No action is required from you.</p>
      </div>
      <div style='background:#f5f5f5;padding:16px;text-align:center;color:#888;font-size:12px;'>
        EventLink — The UK Events Industry Network
      </div>
    </div>
  `;
}

export function generateBriefEmail(data: {
  freelancerFirstName: string;
  employerName: string;
  eventTitle: string;
  eventDate: string;
  callTime?: string | null;
  venueAddress?: string | null;
  roleRequired?: string | null;
  agreedRate?: string | null;
  details?: string | null;
  dresscode?: string | null;
  parkingInfo?: string | null;
  contactOnDay?: string | null;
  scheduleNotes?: string | null;
  hasAttachments: boolean;
  acknowledgeToken: string;
  baseUrl: string;
}): string {
  const ackUrl = `${data.baseUrl}/brief/acknowledge/${data.acknowledgeToken}`;

  const rows = [
    ['Event', data.eventTitle],
    ['Date', data.eventDate],
    data.callTime ? ['Call time', data.callTime] : null,
    data.venueAddress ? ['Venue', data.venueAddress] : null,
    data.roleRequired ? ['Role', data.roleRequired] : null,
    data.agreedRate ? ['Rate', data.agreedRate] : null,
    data.dresscode ? ['Dress code', data.dresscode] : null,
    data.parkingInfo ? ['Parking', data.parkingInfo] : null,
    data.contactOnDay ? ['Contact on the day', data.contactOnDay] : null,
  ].filter(Boolean) as [string, string][];

  const tableRows = rows.map(([label, value], i) => `
    <tr style='background:${i % 2 === 0 ? '#f5f5f5' : '#ffffff'};'>
      <td style='padding:10px 12px;font-weight:bold;width:35%;'>${label}</td>
      <td style='padding:10px 12px;'>${value}</td>
    </tr>
  `).join('');

  return `
    <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
      <div style='background:#1E3A5F;padding:24px;text-align:center;'>
        <h1 style='color:#fff;margin:0;font-size:24px;'>EventLink</h1>
      </div>
      <div style='padding:32px;'>
        <p>Hi ${data.freelancerFirstName},</p>
        <p><strong>${data.employerName}</strong> has sent you a job brief.
        Please read it carefully and confirm you have received and understood it.</p>
        <table style='width:100%;border-collapse:collapse;margin:24px 0;'>
          ${tableRows}
        </table>
        ${data.scheduleNotes ? `
          <div style='background:#f0f4ff;padding:16px;border-radius:4px;margin:16px 0;'>
            <strong>Schedule / Running order:</strong>
            <p style='margin:8px 0 0;white-space:pre-line;'>${data.scheduleNotes}</p>
          </div>` : ''}
        ${data.details ? `
          <div style='background:#f9f9f9;padding:16px;border-radius:4px;margin:16px 0;'>
            <strong>Additional information:</strong>
            <p style='margin:8px 0 0;white-space:pre-line;'>${data.details}</p>
          </div>` : ''}
        ${data.hasAttachments ? `
          <p style='color:#555;font-size:14px;'>
            This brief includes attached documents.
            <a href='${ackUrl}'>View and download them here.</a>
          </p>` : ''}
        <div style='margin:32px 0;text-align:center;'>
          <a href='${ackUrl}' style='background:#1A6B3C;color:#fff;padding:16px 32px;
            text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;
            display:inline-block;'>
            I have read and understood this brief
          </a>
        </div>
        <p style='color:#888;font-size:13px;text-align:center;'>
          Or <a href='${ackUrl}'>open the full brief page</a> to add a message before confirming.
        </p>
      </div>
      <div style='background:#f5f5f5;padding:16px;text-align:center;color:#888;font-size:12px;'>
        EventLink — The UK Events Industry Network
      </div>
    </div>
  `;
}
