import { storage } from './storage';
import * as emailTemplates from './emailTemplates';
import { sendEmail } from './emailService';

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
        'message': 'email_messages',
        'application_update': 'email_application_updates',
        'job_update': 'email_job_updates',
        'job_alert': 'email_job_alerts',
        'rating_request': 'email_rating_requests',
        'system': 'email_system_updates',
      };

      const field = typeToField[notificationType];
      return field ? Boolean(preferences[field]) : false;
    } catch (error) {
      console.error('Error checking email preferences:', error);
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
    notificationType: 'message' | 'application_update' | 'job_update' | 'job_alert' | 'rating_request' | 'system';
    relatedEntityType?: 'job' | 'application' | 'message' | 'rating' | null;
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
        status: 'sent',
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
        status: 'failed',
        related_entity_type: params.relatedEntityType || null,
        related_entity_id: params.relatedEntityId || null,
        metadata: null,
        error_message: error.message || 'Unknown error',
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
    if (!await this.canSendEmail(params.recipientId, 'message')) {
      console.log(`User ${params.recipientId} has message notifications disabled`);
      return false;
    }

    const conversationUrl = `${process.env.FRONTEND_URL || 'https://eventlink.one'}/dashboard?tab=messages`;
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
      notificationType: 'message',
      relatedEntityType: 'message',
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
    if (!await this.canSendEmail(params.recipientId, 'application_update')) {
      console.log(`User ${params.recipientId} has application update notifications disabled`);
      return false;
    }

    const applicationUrl = `${process.env.FRONTEND_URL || 'https://eventlink.one'}/dashboard?tab=applications`;
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
      notificationType: 'application_update',
      relatedEntityType: 'application',
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
    if (!await this.canSendEmail(params.recipientId, 'job_update')) {
      console.log(`User ${params.recipientId} has job update notifications disabled`);
      return false;
    }

    const applicationUrl = `${process.env.FRONTEND_URL || 'https://eventlink.one'}/dashboard?tab=applications`;
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
      notificationType: 'job_update',
      relatedEntityType: 'application',
      relatedEntityId: params.applicationId,
    });
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
    if (!await this.canSendEmail(params.recipientId, 'job_alert')) {
      console.log(`User ${params.recipientId} has job alert notifications disabled`);
      return false;
    }

    const jobUrl = `${process.env.FRONTEND_URL || 'https://eventlink.one'}/jobs`;
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
      notificationType: 'job_alert',
      relatedEntityType: 'job',
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
    if (!await this.canSendEmail(params.recipientId, 'rating_request')) {
      console.log(`User ${params.recipientId} has rating request notifications disabled`);
      return false;
    }

    const ratingUrl = `${process.env.FRONTEND_URL || 'https://eventlink.one'}/ratings`;
    const { subject, html } = emailTemplates.ratingRequestEmail({
      recipientName: params.recipientName,
      requesterName: params.requesterName,
      jobTitle: params.jobTitle,
      ratingUrl,
    });

    return this.sendEmailWithLogging({
      to: params.recipientEmail,
      subject,
      html,
      userId: params.recipientId,
      notificationType: 'rating_request',
      relatedEntityType: 'rating',
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
    if (!await this.canSendEmail(params.recipientId, 'system')) {
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
      notificationType: 'system',
      relatedEntityType: null,
      relatedEntityId: null,
    });
  }
}

// Export singleton instance
export const emailService = new EmailNotificationService();
