import { storage } from "../../storage";
import { sendEmail } from "./emailService";
import * as emailTemplates from "./emailTemplates";
import { isWithinRadius } from "./uk-coordinates";

/**
 * Email notification service
 * Handles sending all email notifications with proper logging and error handling
 */
export class EmailNotificationService {
  /**
   * Check if a user has email notifications enabled for a specific type
   */
  private async canSendEmail(userId: number, notificationType: string): Promise<boolean> {
    try {
      const preferences = await storage.getNotificationPreferences(userId);

      // If no preferences exist, create default (all enabled)
      if (!preferences) {
        await storage.createNotificationPreferences(userId);
        return true; // Default is all enabled
      }

      // Map notification types to preference fields
      const typeToField: Record<string, keyof typeof preferences> = {
        message: "email_messages",
        application_update: "email_application_updates",
        job_update: "email_job_updates",
        job_alert: "email_job_alerts",
        rating_request: "email_rating_requests",
        system: "email_system_updates",
      };

      const field = typeToField[notificationType];
      return field ? Boolean(preferences[field]) : false;
    } catch (error) {
      console.error("Error checking email preferences:", error);
      return false; // Default to not sending if there's an error
    }
  }

  /**
   * Send email and log the result
   */
  private async sendEmailWithLogging(params: {
    to: string;
    subject: string;
    html: string;
    userId: number;
    notificationType:
      | "message"
      | "application_update"
      | "job_update"
      | "job_alert"
      | "rating_request"
      | "system";
    relatedEntityType?: "job" | "application" | "message" | "rating" | null;
    relatedEntityId?: number | null;
  }): Promise<boolean> {
    try {
      await sendEmail({
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      // Log successful email
      await storage.logEmailNotification({
        user_id: params.userId,
        email: params.to,
        notification_type: params.notificationType,
        subject: params.subject,
        status: "sent",
        related_entity_type: params.relatedEntityType || null,
        related_entity_id: params.relatedEntityId || null,
        metadata: null,
        error_message: null,
      });

      console.log(`✅ Notification email sent: ${params.subject} to ${params.to}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Notification email failed: ${params.subject} to ${params.to}`, error);

      // Log failed email
      await storage.logEmailNotification({
        user_id: params.userId,
        email: params.to,
        notification_type: params.notificationType,
        subject: params.subject,
        status: "failed",
        related_entity_type: params.relatedEntityType || null,
        related_entity_id: params.relatedEntityId || null,
        metadata: null,
        error_message: error.message || "Unknown error",
      });

      return false;
    }
  }

  /**
   * Send new message notification email
   */
  async sendMessageNotification(params: {
    recipientId: number;
    recipientEmail: string;
    recipientName: string;
    senderName: string;
    messagePreview: string;
    conversationId: number;
    emailSubject?: string;
  }): Promise<boolean> {
    // Check if user wants message notifications
    if (!(await this.canSendEmail(params.recipientId, "message"))) {
      console.log(`User ${params.recipientId} has message notifications disabled`);
      return false;
    }

    const conversationUrl = `${process.env.FRONTEND_URL || "https://eventlink.one"}/dashboard?tab=messages&conversationId=${params.conversationId}`;
    const { subject, html } = emailTemplates.messageNotificationEmail({
      recipientName: params.recipientName,
      senderName: params.senderName,
      messagePreview: params.messagePreview,
      conversationUrl,
      emailSubject: params.emailSubject,
    });

    return this.sendEmailWithLogging({
      to: params.recipientEmail,
      subject,
      html,
      userId: params.recipientId,
      notificationType: "message",
      relatedEntityType: "message",
      relatedEntityId: params.conversationId,
    });
  }

  /**
   * Send application update notification email (for freelancers)
   */
  async sendApplicationUpdateNotification(params: {
    recipientId: number;
    recipientEmail: string;
    recipientName: string;
    jobTitle: string;
    companyName: string;
    status: string;
    applicationId: number;
  }): Promise<boolean> {
    // Check if user wants application update notifications
    if (!(await this.canSendEmail(params.recipientId, "application_update"))) {
      console.log(`User ${params.recipientId} has application update notifications disabled`);
      return false;
    }

    const applicationUrl = `${process.env.FRONTEND_URL || "https://eventlink.one"}/dashboard?tab=jobs`;
    const { subject, html } = emailTemplates.applicationUpdateEmail({
      recipientName: params.recipientName,
      jobTitle: params.jobTitle,
      companyName: params.companyName,
      status: params.status,
      applicationUrl,
    });

    return this.sendEmailWithLogging({
      to: params.recipientEmail,
      subject,
      html,
      userId: params.recipientId,
      notificationType: "application_update",
      relatedEntityType: "application",
      relatedEntityId: params.applicationId,
    });
  }

  /**
   * Send new application notification email (for recruiters)
   */
  async sendNewApplicationNotification(params: {
    recipientId: number;
    recipientEmail: string;
    recipientName: string;
    jobTitle: string;
    freelancerName: string;
    freelancerTitle?: string;
    jobId: number;
    applicationId: number;
  }): Promise<boolean> {
    // Check if user wants job update notifications
    if (!(await this.canSendEmail(params.recipientId, "job_update"))) {
      console.log(`User ${params.recipientId} has job update notifications disabled`);
      return false;
    }

    const applicationUrl = `${process.env.FRONTEND_URL || "https://eventlink.one"}/dashboard?tab=applications`;
    const { subject, html } = emailTemplates.newApplicationEmail({
      recipientName: params.recipientName,
      jobTitle: params.jobTitle,
      freelancerName: params.freelancerName,
      freelancerTitle: params.freelancerTitle,
      applicationUrl,
    });

    return this.sendEmailWithLogging({
      to: params.recipientEmail,
      subject,
      html,
      userId: params.recipientId,
      notificationType: "job_update",
      relatedEntityType: "application",
      relatedEntityId: params.applicationId,
    });
  }

  /**
   * Check if a job matches user's job alert filters
   */
  private jobMatchesFilters(job: any, filter: any): boolean {
    // If no filter or filter is not active, no match
    if (!filter || !filter.is_active) {
      return false;
    }

    // Skills matching - match against job title and description since EventLink jobs
    // don't have a dedicated skills array
    if (filter.skills && filter.skills.length > 0) {
      const jobTitle = (job.title || "").toLowerCase();
      const jobDescription = (job.description || "").toLowerCase();
      const searchText = `${jobTitle} ${jobDescription}`;
      const hasMatchingSkill = filter.skills.some((filterSkill: string) =>
        searchText.includes(filterSkill.toLowerCase())
      );
      if (!hasMatchingSkill) {
        return false;
      }
    }

    // Location matching - geographic radius-based matching with text fallback
    if (filter.locations && filter.locations.length > 0) {
      const jobLocation = (job.location || "").trim();
      const radiusKm = filter.location_radius_km || 30;

      const hasMatchingLocation = filter.locations.some(
        (filterLocation: string) => {
          const geoResult = isWithinRadius(filterLocation, jobLocation, radiusKm);
          if (geoResult !== null) {
            return geoResult;
          }
          return (
            jobLocation.toLowerCase().includes(filterLocation.toLowerCase()) ||
            filterLocation.toLowerCase().includes(jobLocation.toLowerCase())
          );
        }
      );
      if (!hasMatchingLocation) {
        return false;
      }
    }

    // Keywords matching - check in title and description
    if (filter.keywords && filter.keywords.length > 0) {
      const jobTitle = (job.title || "").toLowerCase();
      const jobDescription = (job.description || "").toLowerCase();
      const searchText = `${jobTitle} ${jobDescription}`;

      const hasMatchingKeyword = filter.keywords.some((keyword: string) =>
        searchText.includes(keyword.toLowerCase())
      );
      if (!hasMatchingKeyword) {
        return false;
      }
    }

    // Date range matching - job start date should be within filter date range
    // Uses event_date (the actual DB field name)
    if (filter.date_from || filter.date_to) {
      const jobStartDate = job.event_date ? new Date(job.event_date) : null;

      if (!jobStartDate) {
        // If job has no start date and filter has date criteria, don't match
        return false;
      }

      if (filter.date_from) {
        const filterFrom = new Date(filter.date_from);
        if (jobStartDate < filterFrom) {
          return false;
        }
      }

      if (filter.date_to) {
        const filterTo = new Date(filter.date_to);
        if (jobStartDate > filterTo) {
          return false;
        }
      }
    }

    // All filters passed
    return true;
  }

  /**
   * Send job alert notifications to all matching freelancers
   */
  async sendJobAlertToMatchingFreelancers(job: any): Promise<void> {
    try {
      // Get ALL freelancer users — including those without a profile
      const { users: freelancerUsers } = await storage.getAllUsers(
        1,
        100000,
        undefined,
        "freelancer",
        "active",
        "created_at",
        "desc",
        undefined
      );

      for (const user of freelancerUsers) {
        try {
          // Skip unverified users
          if (!user.email_verified) continue;

          // Get their job alert filters
          const filters = await storage.getJobAlertFilters(user.id);

          if (filters.length > 0) {
            // Filters exist — only notify if the job matches at least one
            const matchesFilter = filters.some(filter => this.jobMatchesFilters(job, filter));
            if (!matchesFilter) continue;
          }
          // filters.length === 0 → no preferences set → notify for every job

          // Build display name: user record fields first, then fall back to email
          const firstName = user.first_name || "";
          const lastName = user.last_name || "";
          const displayName = `${firstName} ${lastName}`.trim() || user.email;

          // Format job details for email
          const eventDate = job.event_date
            ? new Date(job.event_date).toLocaleDateString("en-GB", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Date TBC";

          const rate = job.rate || "Competitive";

          // Send job alert email (awaited so it completes before moving to next user)
          await this.sendJobAlertNotification({
            recipientId: user.id,
            recipientEmail: user.email,
            recipientName: displayName,
            jobTitle: job.title,
            companyName: job.company,
            location: job.location || "Location TBC",
            rate,
            eventDate,
            jobId: job.id,
          });
        } catch (error) {
          console.error(`Error processing job alerts for user ${user.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Error sending job alerts to matching freelancers:", error);
    }
  }

  /**
   * Send job alert to a specific list of user IDs, ignoring their alert-filter preferences
   */
  async sendJobAlertToSpecificUsers(job: any, userIds: number[]): Promise<void> {
    try {
      for (const userId of userIds) {
        try {
          const user = await storage.getUser(userId);
          if (!user || !user.email_verified) continue;

          const firstName = user.first_name || "";
          const lastName = user.last_name || "";
          const displayName = `${firstName} ${lastName}`.trim() || user.email;

          const eventDate = job.event_date
            ? new Date(job.event_date).toLocaleDateString("en-GB", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Date TBC";

          await this.sendJobAlertNotification({
            recipientId: userId,
            recipientEmail: user.email,
            recipientName: displayName,
            jobTitle: job.title,
            companyName: job.company,
            location: job.location || "Location TBC",
            rate: job.rate || "Competitive",
            eventDate,
            jobId: job.id,
          });
        } catch (error) {
          console.error(`Error sending job alert to user ${userId}:`, error);
        }
      }
    } catch (error) {
      console.error("Error in sendJobAlertToSpecificUsers:", error);
    }
  }

  /**
   * Send job alert notification email (for freelancers)
   */
  async sendJobAlertNotification(params: {
    recipientId: number;
    recipientEmail: string;
    recipientName: string;
    jobTitle: string;
    companyName: string;
    location: string;
    rate: string;
    eventDate: string;
    jobId: number;
  }): Promise<boolean> {
    // Check if user wants job alert notifications
    if (!(await this.canSendEmail(params.recipientId, "job_alert"))) {
      console.log(`User ${params.recipientId} has job alert notifications disabled`);
      return false;
    }

    const jobUrl = `${process.env.FRONTEND_URL || "https://eventlink.one"}/jobs?jobId=${params.jobId}`;
    const { subject, html } = emailTemplates.jobAlertEmail({
      recipientName: params.recipientName,
      jobTitle: params.jobTitle,
      companyName: params.companyName,
      location: params.location,
      rate: params.rate,
      eventDate: params.eventDate,
      jobUrl,
    });

    return this.sendEmailWithLogging({
      to: params.recipientEmail,
      subject,
      html,
      userId: params.recipientId,
      notificationType: "job_alert",
      relatedEntityType: "job",
      relatedEntityId: params.jobId,
    });
  }

  /**
   * Send rating request notification email
   */
  async sendRatingRequestNotification(params: {
    recipientId: number;
    recipientEmail: string;
    recipientName: string;
    requesterName: string;
    jobTitle: string;
    ratingRequestId: number;
  }): Promise<boolean> {
    // Check if user wants rating request notifications
    if (!(await this.canSendEmail(params.recipientId, "rating_request"))) {
      console.log(`User ${params.recipientId} has rating request notifications disabled`);
      return false;
    }

    const ratingUrl = `${process.env.FRONTEND_URL || "https://eventlink.one"}/ratings`;
    const { subject, html } = emailTemplates.ratingRequestEmail({
      recipientName: params.recipientName,
      requesterName: params.requesterName,
      jobTitle: params.jobTitle,
      ratingUrl: params.ratingRequestId
        ? `${ratingUrl}?requestId=${params.ratingRequestId}`
        : ratingUrl,
    });

    return this.sendEmailWithLogging({
      to: params.recipientEmail,
      subject,
      html,
      userId: params.recipientId,
      notificationType: "rating_request",
      relatedEntityType: "rating",
      relatedEntityId: params.ratingRequestId,
    });
  }

  /**
   * Send system update/announcement email
   */
  async sendSystemUpdateNotification(params: {
    recipientId: number;
    recipientEmail: string;
    recipientName: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
  }): Promise<boolean> {
    // Check if user wants system update notifications
    if (!(await this.canSendEmail(params.recipientId, "system"))) {
      console.log(`User ${params.recipientId} has system update notifications disabled`);
      return false;
    }

    const { subject, html } = emailTemplates.systemUpdateEmail({
      recipientName: params.recipientName,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      actionText: params.actionText,
    });

    return this.sendEmailWithLogging({
      to: params.recipientEmail,
      subject,
      html,
      userId: params.recipientId,
      notificationType: "system",
      relatedEntityType: null,
      relatedEntityId: null,
    });
  }
  /**
   * Send invitation to apply notification email
   */
  async sendInvitationNotification(params: {
    recipientId: number;
    recipientEmail: string;
    recipientName: string;
    recruiterName: string;
    jobTitle: string;
    message: string;
    jobId: number;
  }): Promise<boolean> {
    // Check if user wants job update notifications (using job_update preference for invitations)
    if (!(await this.canSendEmail(params.recipientId, "job_update"))) {
      console.log(`User ${params.recipientId} has job update notifications disabled`);
      return false;
    }

    const jobUrl = `${process.env.FRONTEND_URL || "https://eventlink.one"}/dashboard?tab=jobs`;
    const { subject, html } = emailTemplates.invitationEmail({
      recipientName: params.recipientName,
      recruiterName: params.recruiterName,
      jobTitle: params.jobTitle,
      message: params.message,
      jobUrl,
    });

    return this.sendEmailWithLogging({
      to: params.recipientEmail,
      subject,
      html,
      userId: params.recipientId,
      notificationType: "job_update", // Reusing job_update type
      relatedEntityType: "job",
      relatedEntityId: params.jobId,
    });
  }

  /**
   * Send admin "Notify Freelancers" single-job notification
   */
  async sendSingleJobNotification(params: {
    recipientId: number;
    recipientEmail: string;
    recipientFirstName: string;
    jobTitle: string;
    employerName: string;
    location: string;
    payRate: string;
    eventDate: string;
    descriptionPreview: string;
    jobId: number;
    jobSlug?: string | null;
  }): Promise<boolean> {
    if (!(await this.canSendEmail(params.recipientId, "job_alert"))) {
      return false;
    }

    const base = process.env.FRONTEND_URL || "https://eventlink.one";
    const jobUrl = params.jobSlug
      ? `${base}/jobs/${params.jobSlug}`
      : `${base}/jobs?jobId=${params.jobId}`;
    const unsubscribeUrl = `${base}/notification-settings`;

    const { subject, html } = emailTemplates.singleJobNotifyEmail({
      recipientFirstName: params.recipientFirstName,
      jobTitle: params.jobTitle,
      employerName: params.employerName,
      location: params.location,
      payRate: params.payRate,
      eventDate: params.eventDate,
      descriptionPreview: params.descriptionPreview,
      jobUrl,
      unsubscribeUrl,
    });

    return this.sendEmailWithLogging({
      to: params.recipientEmail,
      subject,
      html,
      userId: params.recipientId,
      notificationType: "job_alert",
      relatedEntityType: "job",
      relatedEntityId: params.jobId,
    });
  }
}

// Export singleton instance
export const emailService = new EmailNotificationService();
