import { storage } from "../../storage";
import { sendEmail } from "./emailService";
import * as emailTemplates from "./emailTemplates";

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

    const applicationUrl = `${process.env.FRONTEND_URL || "https://eventlink.one"}/dashboard?tab=applications`;
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

    // Skills matching - at least one skill must match
    if (filter.skills && filter.skills.length > 0) {
      const jobSkills = job.skills || [];
      const hasMatchingSkill = filter.skills.some((filterSkill: string) =>
        jobSkills.some(
          (jobSkill: string) =>
            jobSkill.toLowerCase().includes(filterSkill.toLowerCase()) ||
            filterSkill.toLowerCase().includes(jobSkill.toLowerCase())
        )
      );
      if (!hasMatchingSkill) {
        return false;
      }
    }

    // Location matching - case-insensitive partial match
    if (filter.locations && filter.locations.length > 0) {
      const jobLocation = (job.location || "").toLowerCase();
      const hasMatchingLocation = filter.locations.some(
        (filterLocation: string) =>
          jobLocation.includes(filterLocation.toLowerCase()) ||
          filterLocation.toLowerCase().includes(jobLocation)
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
    if (filter.date_from || filter.date_to) {
      const jobStartDate = job.start_date ? new Date(job.start_date) : null;

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
      // Get all freelancer users
      const freelancers = await storage.getAllFreelancerProfiles();

      for (const freelancerProfile of freelancers) {
        try {
          // Get their job alert filters
          const filters = await storage.getJobAlertFilters(freelancerProfile.user_id);

          // Check if job matches any of their filters
          const matchesFilter = filters.some(filter => this.jobMatchesFilters(job, filter));

          if (!matchesFilter) {
            continue; // Skip if no filter matches
          }

          // Get user details
          const user = await storage.getUser(freelancerProfile.user_id);
          if (!user || !user.email_verified) {
            continue; // Skip unverified users
          }

          // Prepare freelancer display name
          let freelancerDisplayName = user.email;
          if (freelancerProfile.first_name || freelancerProfile.last_name) {
            const firstName = freelancerProfile.first_name || "";
            const lastName = freelancerProfile.last_name || "";
            freelancerDisplayName = `${firstName} ${lastName}`.trim() || user.email;
          }

          // Format job details for email
          const eventDate = job.start_date
            ? new Date(job.start_date).toLocaleDateString("en-GB", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Date TBC";

          const rate = job.pay_rate
            ? `£${job.pay_rate}${job.pay_type === "hourly" ? "/hr" : job.pay_type === "daily" ? "/day" : ""}`
            : "Competitive";

          // Send job alert email (non-blocking)
          this.sendJobAlertNotification({
            recipientId: freelancerProfile.user_id,
            recipientEmail: user.email,
            recipientName: freelancerDisplayName,
            jobTitle: job.title,
            companyName: job.company,
            location: job.location || "Location TBC",
            rate: rate,
            eventDate: eventDate,
            jobId: job.id,
          }).catch(error => {
            console.error(`Failed to send job alert to user ${freelancerProfile.user_id}:`, error);
          });
        } catch (error) {
          console.error(
            `Error processing job alerts for freelancer ${freelancerProfile.user_id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error sending job alerts to matching freelancers:", error);
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
}

// Export singleton instance
export const emailService = new EmailNotificationService();
