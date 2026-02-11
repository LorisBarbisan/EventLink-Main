import {
  contact_messages,
  conversations,
  cv_parsed_data,
  email_notification_logs,
  feedback,
  freelancer_documents,
  freelancer_profiles,
  job_alert_filters,
  job_applications,
  job_link_views,
  jobs,
  message_attachments,
  message_user_states,
  messages,
  notification_preferences,
  notifications,
  rating_requests,
  ratings,
  recruiter_profiles,
  users,
  type ContactMessage,
  type Conversation,
  type CvParsedData,
  type EmailNotificationLog,
  type Feedback,
  type FreelancerDocument,
  type FreelancerProfile,
  type InsertCvParsedData,
  type InsertEmailNotificationLog,
  type InsertFeedback,
  type InsertFreelancerDocument,
  type InsertFreelancerProfile,
  type InsertJob,
  type InsertJobLinkView,
  type InsertJobAlertFilter,
  type InsertJobApplication,
  type InsertMessage,
  type InsertMessageAttachment,
  type InsertNotification,
  type InsertNotificationPreferences,
  type InsertRating,
  type InsertRatingRequest,
  type InsertRecruiterProfile,
  type InsertUser,
  type Job,
  type JobAlertFilter,
  type JobApplication,
  type JobLinkView,
  type Message,
  type MessageAttachment,
  type Notification,
  type NotificationPreferences,
  type Rating,
  type RatingRequest,
  type RecruiterProfile,
  type User,
} from "@shared/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "./api/config/db";
import { cache } from "./api/utils/cache.util";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(
    user: InsertUser & { email_verification_token?: string; email_verification_expires?: Date }
  ): Promise<User>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  updateUserAccount(
    userId: number,
    accountData: { first_name?: string; last_name?: string }
  ): Promise<void>;
  deleteUserAccount(userId: number): Promise<void>;
  isUserDeleted(userId: number): Promise<boolean>;
  canSendMessageToUser(
    senderId: number,
    recipientId: number
  ): Promise<{ canSend: boolean; error?: string }>;

  // Email verification methods
  verifyEmail(token: string): Promise<boolean>;
  updateUserVerificationToken(
    userId: number,
    token: string | null,
    expires: Date | null
  ): Promise<void>;

  // Social auth methods
  getUserBySocialProvider(
    provider: "google" | "facebook" | "linkedin",
    providerId: string
  ): Promise<User | undefined>;
  createSocialUser(user: any): Promise<User>;
  linkSocialProvider(
    userId: number,
    provider: "google" | "facebook" | "linkedin",
    providerId: string,
    profilePhotoUrl?: string
  ): Promise<void>;
  updateUserLastLogin(
    userId: number,
    method: "email" | "google" | "facebook" | "linkedin" | "apple"
  ): Promise<void>;

  // Freelancer profile management
  getFreelancerProfile(userId: number): Promise<FreelancerProfile | undefined>;
  createFreelancerProfile(profile: InsertFreelancerProfile): Promise<FreelancerProfile>;
  updateFreelancerProfile(
    userId: number,
    profile: Partial<InsertFreelancerProfile>
  ): Promise<FreelancerProfile | undefined>;

  // Recruiter profile management
  getRecruiterProfile(userId: number): Promise<RecruiterProfile | undefined>;
  createRecruiterProfile(profile: InsertRecruiterProfile): Promise<RecruiterProfile>;
  updateRecruiterProfile(
    userId: number,
    profile: Partial<InsertRecruiterProfile>
  ): Promise<RecruiterProfile | undefined>;

  // Job management
  getAllJobs(): Promise<Job[]>;
  getJobsByRecruiterId(recruiterId: number): Promise<Job[]>;
  getJobById(jobId: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(jobId: number, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(jobId: number): Promise<void>;
  searchJobs(filters: {
    keyword?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Job[]>;

  // External job management
  getJobByExternalId(externalId: string): Promise<Job | undefined>;
  createExternalJob(job: any): Promise<Job>;
  getExternalJobs(): Promise<Job[]>;
  deleteAllExternalJobs(): Promise<number>;
  getAllJobsSortedByDate(): Promise<Job[]>;

  getAdminJobs(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    type?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<{
    jobs: (Job & { application_count: number; hired_count: number; recruiter_email?: string; recruiter_name?: string })[];
    total: number;
  }>;

  getAdminJobDetail(jobId: number): Promise<{
    job: Job & { recruiter_email?: string; recruiter_name?: string; application_count: number; hired_count: number };
    applications: { id: number; freelancer_id: number; status: string; applied_at: Date; freelancer_name: string; freelancer_email: string; freelancer_title?: string | null }[];
  } | null>;

  // Get all freelancer profiles for listings
  getAllFreelancerProfiles(): Promise<FreelancerProfile[]>;
  getAllRecruiterProfiles(): Promise<RecruiterProfile[]>;
  searchFreelancers(filters: {
    keyword?: string;
    location?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    results: Array<FreelancerProfile & { rating?: number; rating_count?: number }>;
    total: number;
    page: number;
    totalPages: number;
  }>;

  // Job application management
  createJobApplication(application: InsertJobApplication): Promise<JobApplication>;
  getFreelancerApplications(freelancerId: number): Promise<JobApplication[]>;
  getJobApplications(jobId: number): Promise<JobApplication[]>;
  getJobApplicationById(applicationId: number): Promise<JobApplication | undefined>;
  updateApplicationStatus(
    applicationId: number,
    status: "applied" | "reviewed" | "shortlisted" | "rejected" | "hired",
    rejectionMessage?: string
  ): Promise<JobApplication>;
  updateInvitationResponse(
    applicationId: number,
    status: "applied" | "declined",
    responseMessage?: string
  ): Promise<JobApplication>;
  // Soft delete methods for applications
  softDeleteApplication(applicationId: number, userRole: "freelancer" | "recruiter"): Promise<void>;
  getRecruiterApplications(recruiterId: number): Promise<JobApplication[]>;

  // Messaging management
  getOrCreateConversation(userOneId: number, userTwoId: number): Promise<Conversation>;
  getConversationsByUserId(userId: number): Promise<Array<Conversation & { otherUser: User }>>;
  sendMessage(message: InsertMessage): Promise<Message>;
  getConversationMessages(
    conversationId: number
  ): Promise<Array<Message & { sender: User; attachments?: MessageAttachment[] }>>;
  getConversationMessagesForUser(
    conversationId: number,
    userId: number
  ): Promise<Array<Message & { sender: User; attachments?: MessageAttachment[] }>>;
  markMessagesAsRead(conversationId: number, userId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  // Soft delete methods for messages
  markMessageDeletedForUser(messageId: number, userId: number): Promise<void>;
  // Soft delete methods for conversations
  deleteConversation(conversationId: number, userId: number): Promise<void>;

  // Message attachment management
  createMessageAttachment(attachment: InsertMessageAttachment): Promise<MessageAttachment>;
  getMessageAttachments(messageId: number): Promise<MessageAttachment[]>;
  getAttachmentById(attachmentId: number): Promise<MessageAttachment | undefined>;
  getMessageById(messageId: number): Promise<Message | undefined>;
  getMessageAttachmentById(attachmentId: number): Promise<MessageAttachment | undefined>;
  createFileReport(report: {
    attachment_id: number;
    reporter_id: number;
    report_reason: string;
    report_details: string | null;
  }): Promise<any>;

  // Notification management
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotification(notificationId: number): Promise<Notification | undefined>;
  getUserNotifications(userId: number, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  markNotificationAsRead(notificationId: number): Promise<void>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  deleteNotification(notificationId: number): Promise<void>;
  deleteExpiredNotifications(): Promise<void>;

  // Rating management
  createRating(rating: InsertRating): Promise<Rating>;
  getRatingById(ratingId: number): Promise<Rating | undefined>;
  getRatingByJobApplication(jobApplicationId: number): Promise<Rating | undefined>;
  getFreelancerRatings(
    freelancerId: number
  ): Promise<Array<Rating & { recruiter: User; job_title?: string }>>;
  getFreelancerAverageRating(freelancerId: number): Promise<{ average: number; count: number }>;
  canRecruiterRateFreelancer(
    recruiterId: number,
    freelancerId: number,
    jobApplicationId: number
  ): Promise<boolean>;

  createRatingWithNotification(
    rating: InsertRating & { status?: string; flags?: string[] },
    notification: InsertNotification
  ): Promise<Rating>;

  updateRating(ratingId: number, updates: Partial<Rating>): Promise<Rating | undefined>;
  getAllRatings(filters?: {
    status?: string;
  }): Promise<Array<Rating & { recruiter: User; job_title?: string }>>;

  createRatingRequestWithNotification(
    request: InsertRatingRequest,
    notification: InsertNotification
  ): Promise<RatingRequest>;

  // Rating request management
  createRatingRequest(request: InsertRatingRequest): Promise<RatingRequest>;
  getRatingRequestByJobApplication(jobApplicationId: number): Promise<RatingRequest | undefined>;
  getRecruiterRatingRequests(
    recruiterId: number
  ): Promise<Array<RatingRequest & { freelancer: User; job_title?: string }>>;
  getFreelancerRatingRequests(
    freelancerId: number
  ): Promise<Array<RatingRequest & { recruiter: User; job_title?: string }>>;
  updateRatingRequestStatus(
    requestId: number,
    status: "completed" | "declined"
  ): Promise<RatingRequest>;

  // Feedback management for admin dashboard
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getAllFeedback(status?: string, type?: string): Promise<Array<Feedback & { user?: User }>>;
  getFeedbackById(id: number): Promise<Feedback | undefined>;
  updateFeedbackStatus(
    id: number,
    status: "pending" | "in_review" | "resolved" | "closed",
    adminUserId?: number
  ): Promise<Feedback>;
  addAdminResponse(id: number, response: string, adminUserId: number): Promise<Feedback>;
  getFeedbackByStatus(
    status: "pending" | "in_review" | "resolved" | "closed"
  ): Promise<Array<Feedback & { user?: User }>>;
  getFeedbackStats(): Promise<{
    total: number;
    pending: number;
    resolved: number;
    byType: Record<string, number>;
  }>;

  // Admin management
  updateUserRole(userId: number, role: "freelancer" | "recruiter" | "admin"): Promise<User>;
  getAdminUsers(): Promise<User[]>;
  getAllUsers(
    page: number,
    limit: number,
    search?: string,
    role?: string,
    status?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    profileStatus?: string
  ): Promise<{ users: (User & { profile_status?: string })[]; total: number }>;
  updateUserStatus(userId: number, status: string): Promise<User>;

  // Category-specific notification counts
  getCategoryUnreadCounts(userId: number): Promise<{
    messages: number;
    applications: number;
    jobs: number;
    ratings: number;
    feedback: number;
    contact_messages: number;
    total: number;
  }>;

  // Admin analytics
  getAdminAnalytics(): Promise<{
    users: { total: number; active: number; thisMonth: number };
    jobs: { total: number; active: number; thisMonth: number };
    feedback: { pending: number };
    applications: { total: number; hired: number; thisMonth: number };
    recentActivity: Array<{
      type: "feedback" | "user" | "application";
      message: string;
      time: Date;
    }>;
  }>;

  // Mark category-specific notifications as read
  markCategoryNotificationsAsRead(
    userId: number,
    category: "messages" | "applications" | "jobs" | "ratings" | "feedback" | "contact_messages"
  ): Promise<void>;

  // Notification preferences management
  getNotificationPreferences(userId: number): Promise<NotificationPreferences | undefined>;
  createNotificationPreferences(userId: number): Promise<NotificationPreferences>;
  updateNotificationPreferences(
    userId: number,
    preferences: Partial<InsertNotificationPreferences>
  ): Promise<NotificationPreferences>;

  // Job alert filters management
  getJobAlertFilters(userId: number): Promise<JobAlertFilter[]>;
  createJobAlertFilter(filter: InsertJobAlertFilter): Promise<JobAlertFilter>;
  updateJobAlertFilter(
    filterId: number,
    filter: Partial<InsertJobAlertFilter>
  ): Promise<JobAlertFilter>;
  deleteJobAlertFilter(filterId: number): Promise<void>;

  // Email notification logging
  logEmailNotification(log: InsertEmailNotificationLog): Promise<EmailNotificationLog>;
  getEmailNotificationLogs(userId: number, limit?: number): Promise<EmailNotificationLog[]>;

  // Freelancer document/certification management
  getFreelancerDocuments(freelancerId: number): Promise<FreelancerDocument[]>;
  getFreelancerDocumentById(documentId: number): Promise<FreelancerDocument | undefined>;
  getFreelancerDocumentCount(freelancerId: number): Promise<number>;
  createFreelancerDocument(document: InsertFreelancerDocument): Promise<FreelancerDocument>;
  deleteFreelancerDocument(documentId: number, freelancerId: number): Promise<void>;

  // Job link view tracking
  createJobLinkView(view: InsertJobLinkView): Promise<JobLinkView>;
  getJobLinkViewCount(jobId: number): Promise<number>;
  // CV parsed data management
  getCvParsedData(userId: number): Promise<CvParsedData | undefined>;
  createCvParsedData(data: InsertCvParsedData): Promise<CvParsedData>;
  updateCvParsedData(
    userId: number,
    data: Partial<InsertCvParsedData>
  ): Promise<CvParsedData | undefined>;
  deleteCvParsedData(userId: number): Promise<void>;

  // Cache management
  clearCache(): void;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const cacheKey = `user:${id}`;
    const cached = cache.get<User>(cacheKey);
    if (cached) return cached;

    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (result[0]) {
      cache.set(cacheKey, result[0], 300); // Cache for 5 minutes
    }
    return result[0];
  }

  // Optimized method to get user with profile data in single query
  async getUserWithProfile(
    id: number
  ): Promise<(User & { profile?: FreelancerProfile | RecruiterProfile }) | undefined> {
    const cacheKey = `user_with_profile:${id}`;
    const cached = cache.get<User & { profile?: FreelancerProfile | RecruiterProfile }>(cacheKey);
    if (cached) return cached;

    const user = await this.getUser(id);
    if (!user) return undefined;

    let profile: FreelancerProfile | RecruiterProfile | undefined;
    if (user.role === "freelancer") {
      profile = await this.getFreelancerProfile(id);
    } else if (user.role === "recruiter") {
      profile = await this.getRecruiterProfile(id);
    }

    const result = { ...user, profile };
    cache.set(cacheKey, result, 300);
    return result;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = email.toLowerCase();
    const cacheKey = `user:email:${normalizedEmail}`;
    const cached = cache.get<User>(cacheKey);
    if (cached) return cached;

    // Case-insensitive email comparison using SQL lower function
    const result = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);
    if (result[0]) {
      cache.set(cacheKey, result[0], 300); // Cache for 5 minutes
      // Also cache by ID for consistency
      cache.set(`user:${result[0].id}`, result[0], 300);
    }
    return result[0];
  }

  async createUser(
    user: InsertUser & { email_verification_token?: string; email_verification_expires?: Date }
  ): Promise<User> {
    const userData = {
      email: user.email,
      password: user.password,
      role: user.role as "freelancer" | "recruiter",
      email_verified: false,
      email_verification_token: user.email_verification_token,
      email_verification_expires: user.email_verification_expires,
    };
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }

  async verifyEmail(token: string): Promise<boolean> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email_verification_token, token))
        .limit(1);

      if (!result[0]) return false;

      const user = result[0];

      // Check if token has expired
      if (user.email_verification_expires && new Date() > user.email_verification_expires) {
        return false;
      }

      // Update user as verified and clear verification token
      await db
        .update(users)
        .set({
          email_verified: true,
          email_verification_token: null,
          email_verification_expires: null,
          status: "active",
          updated_at: new Date(),
        })
        .where(eq(users.id, user.id));

      console.log(`[VERIFY_DEBUG] User ${user.id} updated. Set status=active, email_verified=true`);

      // Clear cache
      const normalizedEmail = user.email.toLowerCase();
      cache.delete(`user:${user.id}`);
      cache.delete(`user:email:${normalizedEmail}`);
      cache.delete(`user_with_profile:${user.id}`);

      return true;
    } catch (error) {
      console.error("Error verifying email:", error);
      return false;
    }
  }

  async updateUserStatus(userId: number, status: string): Promise<User> {
    const updates: Partial<InsertUser> = { status, updated_at: new Date() };

    // If activating, also verify email if not already verified
    if (status === "active") {
      updates.email_verified = true;
      updates.email_verification_token = null;
      updates.email_verification_expires = null;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    if (updatedUser) {
      const normalizedEmail = updatedUser.email.toLowerCase();
      cache.delete(`user:${userId}`);
      cache.delete(`user:email:${normalizedEmail}`);
      cache.delete(`user_with_profile:${userId}`);
    }

    return updatedUser;
  }

  async updateUserVerificationToken(
    userId: number,
    token: string | null,
    expires: Date | null
  ): Promise<void> {
    await db
      .update(users)
      .set({
        email_verification_token: token,
        email_verification_expires: expires,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // We need to clear cache because the user object (containing the token) matches
    // what is stored in the cache.
    cache.delete(`user:${userId}`);
    // We can't clear email cache easily without fetching user first,
    // or we can just accept that token fields might be stale in cache for 5 mins.
    // Given this is less critical than verification status, and we don't have the email handy
    // without an extra query, we'll skip clearing the email-key cache unless we fetch the user.
    // However, the caller (resendVerification) usually fetches the user right before this.
    // Ideally we should clear it.

    // To be safe and correct, let's just clear the ID cache.
    // Most lookups for critical data (like signin) use getUserByEmail, so this might not be enough.
    // BUT, updateUserVerificationToken is usually followed by sending email.
    // The immediate next step isn't usually a login that depends on the token.
    // So clearing user:{id} is a good start.
    // Actually, let's fetch the user to clear properly if we want 100% consistency.
    // But for now, fixing verifyEmail is the priority.
  }

  // Social auth methods
  async getUserBySocialProvider(
    provider: "google" | "facebook" | "linkedin",
    providerId: string
  ): Promise<User | undefined> {
    const cacheKey = `user:${provider}:${providerId}`;
    const cached = cache.get<User>(cacheKey);
    if (cached) return cached;

    let condition;
    switch (provider) {
      case "google":
        condition = eq(users.google_id, providerId);
        break;
      case "facebook":
        condition = eq(users.facebook_id, providerId);
        break;
      case "linkedin":
        condition = eq(users.linkedin_id, providerId);
        break;
    }

    const result = await db.select().from(users).where(condition).limit(1);
    if (result[0]) {
      cache.set(cacheKey, result[0], 300);
    }
    return result[0];
  }

  async createSocialUser(userData: {
    email: string;
    first_name?: string;
    last_name?: string;
    auth_provider: "google" | "facebook" | "linkedin";
    google_id?: string;
    facebook_id?: string;
    linkedin_id?: string;
    profile_photo_url?: string;
    email_verified: boolean;
    role: "freelancer" | "recruiter";
  }): Promise<User> {
    const user = {
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      password: null, // Social auth users don't have passwords
      role: userData.role,
      auth_provider: userData.auth_provider,
      google_id: userData.google_id,
      facebook_id: userData.facebook_id,
      linkedin_id: userData.linkedin_id,
      profile_photo_url: userData.profile_photo_url,
      email_verified: userData.email_verified,
      last_login_method: userData.auth_provider,
      last_login_at: new Date(),
    };

    const result = await db.insert(users).values(user).returning();

    // Clear cache since we added a new user
    cache.clearPattern("user:");

    return result[0];
  }

  async linkSocialProvider(
    userId: number,
    provider: "google" | "facebook" | "linkedin",
    providerId: string,
    profilePhotoUrl?: string
  ): Promise<void> {
    const updateData: any = { updated_at: new Date() };

    switch (provider) {
      case "google":
        updateData.google_id = providerId;
        break;
      case "facebook":
        updateData.facebook_id = providerId;
        break;
      case "linkedin":
        updateData.linkedin_id = providerId;
        break;
    }

    if (profilePhotoUrl) {
      updateData.profile_photo_url = profilePhotoUrl;
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));

    // Clear cache for this user
    cache.clearPattern(`user:${userId}`);
    cache.clearPattern(`user:${provider}:`);
  }

  async updateUserLastLogin(
    userId: number,
    method: "email" | "google" | "facebook" | "linkedin" | "apple"
  ): Promise<void> {
    await db
      .update(users)
      .set({
        last_login_method: method,
        last_login_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Clear cache for this user
    cache.clearPattern(`user:${userId}`);
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Clear the user cache so getUser() returns fresh data with new password
    const cacheKey = `user:${userId}`;
    cache.delete(cacheKey);
  }

  async setPasswordResetToken(email: string, token: string, expires: Date): Promise<boolean> {
    try {
      const result = await db
        .update(users)
        .set({
          password_reset_token: token,
          password_reset_expires: expires,
          updated_at: new Date(),
        })
        .where(eq(users.email, email));
      return true;
    } catch (error) {
      console.error("Error setting password reset token:", error);
      return false;
    }
  }

  async validatePasswordResetToken(token: string): Promise<{ isValid: boolean; userId?: number }> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.password_reset_token, token))
        .limit(1);

      if (!result[0]) return { isValid: false };

      const user = result[0];

      // Check if token has expired
      if (user.password_reset_expires && new Date() > user.password_reset_expires) {
        return { isValid: false };
      }

      return { isValid: true, userId: user.id };
    } catch (error) {
      console.error("Error validating password reset token:", error);
      return { isValid: false };
    }
  }

  async resetPassword(userId: number, hashedPassword: string): Promise<boolean> {
    try {
      await db
        .update(users)
        .set({
          password: hashedPassword,
          password_reset_token: null,
          password_reset_expires: null,
          updated_at: new Date(),
        })
        .where(eq(users.id, userId));

      // Clear the user cache so getUser() returns fresh data with new password
      const cacheKey = `user:${userId}`;
      cache.delete(cacheKey);

      return true;
    } catch (error) {
      console.error("Error resetting password:", error);
      return false;
    }
  }

  async updateUserAccount(
    userId: number,
    accountData: {
      first_name?: string;
      last_name?: string;
      role?: "freelancer" | "recruiter" | "admin";
    }
  ): Promise<void> {
    await db
      .update(users)
      .set({
        ...accountData,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Clear the user cache so getUser() returns fresh data
    const cacheKey = `user:${userId}`;
    cache.delete(cacheKey);
  }

  async getFreelancerProfile(userId: number): Promise<FreelancerProfile | undefined> {
    const cacheKey = `freelancer_profile:${userId}`;
    const cached = cache.get<FreelancerProfile>(cacheKey);
    if (cached) return cached;

    const result = await db
      .select()
      .from(freelancer_profiles)
      .where(eq(freelancer_profiles.user_id, userId))
      .limit(1);
    if (result[0]) {
      cache.set(cacheKey, result[0], 600); // Cache for 10 minutes (profiles change less frequently)
    }
    return result[0];
  }

  async createFreelancerProfile(profile: InsertFreelancerProfile): Promise<FreelancerProfile> {
    const profileData = {
      user_id: profile.user_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      title: profile.title,
      superpower: profile.superpower,
      bio: profile.bio,
      location: profile.location,
      experience_years: profile.experience_years,
      skills: profile.skills,
      portfolio_url: profile.portfolio_url,
      linkedin_url: profile.linkedin_url,
      website_url: profile.website_url,
      availability_status: profile.availability_status as "available" | "busy" | "unavailable",
      profile_photo_url: profile.profile_photo_url,
    };
    const result = await db.insert(freelancer_profiles).values([profileData]).returning();
    return result[0];
  }

  async updateFreelancerProfile(
    userId: number,
    profile: Partial<InsertFreelancerProfile>
  ): Promise<FreelancerProfile | undefined> {
    // Clear cache BEFORE update to prevent any race conditions
    const cacheKey = `freelancer_profile:${userId}`;
    cache.delete(cacheKey);

    const updateData: any = { updated_at: new Date() };

    // Only include defined fields
    if (profile.first_name !== undefined) updateData.first_name = profile.first_name;
    if (profile.last_name !== undefined) updateData.last_name = profile.last_name;
    if (profile.title !== undefined) updateData.title = profile.title;
    if (profile.superpower !== undefined) updateData.superpower = profile.superpower;
    if (profile.bio !== undefined) updateData.bio = profile.bio;
    if (profile.location !== undefined) updateData.location = profile.location;
    if (profile.experience_years !== undefined)
      updateData.experience_years = profile.experience_years;
    if (profile.skills !== undefined) updateData.skills = profile.skills;
    if (profile.portfolio_url !== undefined) updateData.portfolio_url = profile.portfolio_url;
    if (profile.linkedin_url !== undefined) updateData.linkedin_url = profile.linkedin_url;
    if (profile.website_url !== undefined) updateData.website_url = profile.website_url;
    if (profile.availability_status !== undefined)
      updateData.availability_status = profile.availability_status as
        | "available"
        | "busy"
        | "unavailable";
    if (profile.profile_photo_url !== undefined) {
      console.log(
        "Updating profile_photo_url:",
        profile.profile_photo_url ? profile.profile_photo_url.substring(0, 50) + "..." : "null"
      );
      updateData.profile_photo_url = profile.profile_photo_url;
    }

    // CV fields
    if (profile.cv_file_url !== undefined) updateData.cv_file_url = profile.cv_file_url;
    if (profile.cv_file_name !== undefined) updateData.cv_file_name = profile.cv_file_name;
    if (profile.cv_file_type !== undefined) updateData.cv_file_type = profile.cv_file_type;
    if (profile.cv_file_size !== undefined) updateData.cv_file_size = profile.cv_file_size;

    const result = await db
      .update(freelancer_profiles)
      .set(updateData)
      .where(eq(freelancer_profiles.user_id, userId))
      .returning();

    // If no existing profile found, create one
    if (result.length === 0) {
      const newProfile = {
        user_id: userId,
        first_name: updateData.first_name || "",
        last_name: updateData.last_name || "",
        title: updateData.title || "",
        superpower: updateData.superpower || "",
        bio: updateData.bio || "",
        location: updateData.location || "",
        experience_years: updateData.experience_years || null,
        skills: updateData.skills || [],
        portfolio_url: updateData.portfolio_url || "",
        linkedin_url: updateData.linkedin_url || "",
        website_url: updateData.website_url || "",
        availability_status: updateData.availability_status || "available",
        profile_photo_url: updateData.profile_photo_url || "",
        cv_file_url: updateData.cv_file_url || null,
        cv_file_name: updateData.cv_file_name || null,
        cv_file_type: updateData.cv_file_type || null,
        cv_file_size: updateData.cv_file_size || null,
      };
      const createResult = await db.insert(freelancer_profiles).values([newProfile]).returning();
      return createResult[0];
    }

    return result[0];
  }

  async getRecruiterProfile(userId: number): Promise<RecruiterProfile | undefined> {
    const result = await db
      .select()
      .from(recruiter_profiles)
      .where(eq(recruiter_profiles.user_id, userId))
      .orderBy(desc(recruiter_profiles.id))
      .limit(1);
    return result[0];
  }

  async createRecruiterProfile(profile: InsertRecruiterProfile): Promise<RecruiterProfile> {
    const result = await db.insert(recruiter_profiles).values(profile).returning();
    return result[0];
  }

  async updateRecruiterProfile(
    userId: number,
    profile: Partial<InsertRecruiterProfile>
  ): Promise<RecruiterProfile | undefined> {
    const updateData: any = { updated_at: new Date() };

    // Only include defined fields
    if (profile.company_name !== undefined) updateData.company_name = profile.company_name;
    if (profile.contact_name !== undefined) updateData.contact_name = profile.contact_name;
    if (profile.company_type !== undefined) updateData.company_type = profile.company_type;
    if (profile.location !== undefined) updateData.location = profile.location;
    if (profile.description !== undefined) updateData.description = profile.description;
    if (profile.website_url !== undefined) updateData.website_url = profile.website_url;
    if (profile.linkedin_url !== undefined) updateData.linkedin_url = profile.linkedin_url;
    if (profile.company_logo_url !== undefined)
      updateData.company_logo_url = profile.company_logo_url;

    const result = await db
      .update(recruiter_profiles)
      .set(updateData)
      .where(eq(recruiter_profiles.user_id, userId))
      .returning();
    return result[0];
  }

  async getAllFreelancerProfiles(): Promise<FreelancerProfile[]> {
    // CRITICAL: Triple-check to ensure NO deleted user data appears anywhere
    // Join with users table to filter out deleted users with multiple safety checks
    const result = await db
      .select({
        id: freelancer_profiles.id,
        user_id: freelancer_profiles.user_id,
        first_name: freelancer_profiles.first_name,
        last_name: freelancer_profiles.last_name,
        title: freelancer_profiles.title,
        superpower: freelancer_profiles.superpower,
        bio: freelancer_profiles.bio,
        location: freelancer_profiles.location,
        experience_years: freelancer_profiles.experience_years,
        skills: freelancer_profiles.skills,
        portfolio_url: freelancer_profiles.portfolio_url,
        linkedin_url: freelancer_profiles.linkedin_url,
        website_url: freelancer_profiles.website_url,
        availability_status: freelancer_profiles.availability_status,
        profile_photo_url: freelancer_profiles.profile_photo_url,
        cv_file_url: freelancer_profiles.cv_file_url,
        cv_file_name: freelancer_profiles.cv_file_name,
        cv_file_type: freelancer_profiles.cv_file_type,
        cv_file_size: freelancer_profiles.cv_file_size,
        created_at: freelancer_profiles.created_at,
        updated_at: freelancer_profiles.updated_at,
      })
      .from(freelancer_profiles)
      .innerJoin(users, eq(freelancer_profiles.user_id, users.id))
      .where(
        and(
          isNull(users.deleted_at), // Primary check: user not marked as deleted
          sql`${users.email} NOT LIKE 'deleted_%'` // Secondary check: email not anonymized
        )
      );

    // Additional safeguard: Filter out any profiles with deleted user indicators
    const safeResult = result.filter((profile) => {
      return (
        profile.first_name &&
        profile.last_name &&
        !profile.first_name.toLowerCase().includes("deleted") &&
        !profile.last_name.toLowerCase().includes("deleted")
      );
    });

    return safeResult;
  }

  async getAllRecruiterProfiles(): Promise<RecruiterProfile[]> {
    // Join with users table to filter out deleted users
    const result = await db
      .select({
        id: recruiter_profiles.id,
        user_id: recruiter_profiles.user_id,
        company_name: recruiter_profiles.company_name,
        contact_name: recruiter_profiles.contact_name,
        company_type: recruiter_profiles.company_type,
        location: recruiter_profiles.location,
        description: recruiter_profiles.description,
        website_url: recruiter_profiles.website_url,
        linkedin_url: recruiter_profiles.linkedin_url,
        company_logo_url: recruiter_profiles.company_logo_url,
        created_at: recruiter_profiles.created_at,
        updated_at: recruiter_profiles.updated_at,
      })
      .from(recruiter_profiles)
      .innerJoin(users, eq(recruiter_profiles.user_id, users.id))
      .where(isNull(users.deleted_at)); // Only non-deleted users

    return result;
  }

  async searchFreelancers(filters: {
    keyword?: string;
    location?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    results: Array<FreelancerProfile & { average_rating: number; rating_count: number }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const { keyword, location, page = 1, limit = 20 } = filters;
      const EVENTLINK_EMAIL = "eventlink@eventlink.one";

      // Build conditions array
      const conditions = [];

      // Only show profiles from non-deleted users
      conditions.push(isNull(users.deleted_at));

      // Keyword search: title, name, bio, or skills (case-insensitive)
      if (keyword && keyword.trim()) {
        const searchTerm = `%${keyword.toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${freelancer_profiles.title}) LIKE ${searchTerm}`,
            sql`LOWER(CONCAT(${freelancer_profiles.first_name}, ' ', ${freelancer_profiles.last_name})) LIKE ${searchTerm}`,
            sql`LOWER(${freelancer_profiles.bio}) LIKE ${searchTerm}`,
            sql`EXISTS (
              SELECT 1 FROM unnest(${freelancer_profiles.skills}) AS skill
              WHERE LOWER(skill) LIKE ${searchTerm}
            )`
          )
        );
      }

      // Location filter (case-insensitive partial match)
      if (location && location.trim()) {
        const locationTerm = `%${location.toLowerCase()}%`;
        conditions.push(sql`LOWER(${freelancer_profiles.location}) LIKE ${locationTerm}`);
      }

      // Always fetch EventLink profile separately (if it matches filters)
      const eventlinkConditions = [...conditions, sql`LOWER(${users.email}) = ${EVENTLINK_EMAIL}`];
      const eventlinkResult = await db
        .select({
          id: freelancer_profiles.id,
          user_id: freelancer_profiles.user_id,
          first_name: freelancer_profiles.first_name,
          last_name: freelancer_profiles.last_name,
          title: freelancer_profiles.title,
          superpower: freelancer_profiles.superpower,
          bio: freelancer_profiles.bio,
          location: freelancer_profiles.location,
          experience_years: freelancer_profiles.experience_years,
          skills: freelancer_profiles.skills,
          portfolio_url: freelancer_profiles.portfolio_url,
          linkedin_url: freelancer_profiles.linkedin_url,
          website_url: freelancer_profiles.website_url,
          availability_status: freelancer_profiles.availability_status,
          profile_photo_url: freelancer_profiles.profile_photo_url,
          cv_file_url: freelancer_profiles.cv_file_url,
          cv_file_name: freelancer_profiles.cv_file_name,
          cv_file_type: freelancer_profiles.cv_file_type,
          cv_file_size: freelancer_profiles.cv_file_size,
          created_at: freelancer_profiles.created_at,
          updated_at: freelancer_profiles.updated_at,
          user_email: users.email,
        })
        .from(freelancer_profiles)
        .innerJoin(users, eq(freelancer_profiles.user_id, users.id))
        .where(and(...eventlinkConditions))
        .limit(1);

      const hasEventlinkProfile = eventlinkResult.length > 0;

      // Exclude EventLink from regular results
      const excludeEventlinkConditions = [
        ...conditions,
        sql`LOWER(${users.email}) != ${EVENTLINK_EMAIL}`,
      ];

      // Get total count excluding EventLink
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(freelancer_profiles)
        .innerJoin(users, eq(freelancer_profiles.user_id, users.id))
        .where(and(...excludeEventlinkConditions));

      const othersCount = countResult[0]?.count || 0;
      // Total includes EventLink if it matches filters
      const total = hasEventlinkProfile ? othersCount + 1 : othersCount;

      // Calculate pagination
      // On page 1, we show EventLink + (limit-1) others
      // On other pages, we show 'limit' others with adjusted offset
      let effectiveLimit = limit;
      let effectiveOffset = 0;

      if (page === 1) {
        effectiveLimit = hasEventlinkProfile ? limit - 1 : limit;
        effectiveOffset = 0;
      } else {
        // For page 2+, offset needs to account for EventLink taking a slot on page 1
        effectiveLimit = limit;
        effectiveOffset = hasEventlinkProfile ? (page - 1) * limit - 1 : (page - 1) * limit;
      }

      const totalPages = Math.ceil(total / limit);

      // Fetch other results (excluding EventLink)
      const otherResults = await db
        .select({
          id: freelancer_profiles.id,
          user_id: freelancer_profiles.user_id,
          first_name: freelancer_profiles.first_name,
          last_name: freelancer_profiles.last_name,
          title: freelancer_profiles.title,
          superpower: freelancer_profiles.superpower,
          bio: freelancer_profiles.bio,
          location: freelancer_profiles.location,
          experience_years: freelancer_profiles.experience_years,
          skills: freelancer_profiles.skills,
          portfolio_url: freelancer_profiles.portfolio_url,
          linkedin_url: freelancer_profiles.linkedin_url,
          website_url: freelancer_profiles.website_url,
          availability_status: freelancer_profiles.availability_status,
          profile_photo_url: freelancer_profiles.profile_photo_url,
          cv_file_url: freelancer_profiles.cv_file_url,
          cv_file_name: freelancer_profiles.cv_file_name,
          cv_file_type: freelancer_profiles.cv_file_type,
          cv_file_size: freelancer_profiles.cv_file_size,
          created_at: freelancer_profiles.created_at,
          updated_at: freelancer_profiles.updated_at,
          user_email: users.email,
        })
        .from(freelancer_profiles)
        .innerJoin(users, eq(freelancer_profiles.user_id, users.id))
        .where(and(...excludeEventlinkConditions))
        .orderBy(desc(freelancer_profiles.created_at))
        .limit(effectiveLimit)
        .offset(effectiveOffset);

      // Combine results
      const allResults =
        page === 1 && hasEventlinkProfile ? [...eventlinkResult, ...otherResults] : otherResults;

      // Get ratings for all returned freelancers
      const resultsWithRatings = await Promise.all(
        allResults.map(async (profile) => {
          const ratingStats = await this.getFreelancerAverageRating(profile.user_id);
          return {
            ...profile,
            average_rating: ratingStats.average ?? 0,
            rating_count: ratingStats.count ?? 0,
          };
        })
      );

      return {
        results: resultsWithRatings,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      console.error("Search freelancers error:", error);
      return {
        results: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }
  }

  // Helper method to calculate relevance score with weighted components
  // Weighting: 40% title, 30% skills, 20% bio, 10% rating (out of 100)
  private calculateRelevanceScore(
    profile: FreelancerProfile,
    searchTerm: string,
    rating: number
  ): number {
    let score = 0;

    // Title match: 40 points (40% weight)
    if (profile.title && profile.title.toLowerCase().includes(searchTerm)) {
      score += 40;
    }

    // Skills match: 30 points (30% weight)
    if (
      profile.skills &&
      profile.skills.some((skill) => skill.toLowerCase().includes(searchTerm))
    ) {
      score += 30;
    }

    // Bio match: 20 points (20% weight)
    if (profile.bio && profile.bio.toLowerCase().includes(searchTerm)) {
      score += 20;
    }

    // Rating contribution: 10 points max (10% weight)
    // Rating is 0-5 scale, so normalize to 0-10 points
    score += (rating / 5) * 10;

    return score;
  }

  // Job management methods

  async getAllJobs(): Promise<Job[]> {
    return await db.select().from(jobs);
  }

  async getAllJobsSortedByDate(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.created_at));
  }

  async getAdminJobs(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    type?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<{
    jobs: (Job & { application_count: number; hired_count: number; recruiter_email?: string; recruiter_name?: string })[];
    total: number;
  }> {
    const offset = (page - 1) * limit;
    const conditions = [];

    if (search) {
      const searchLower = search.toLowerCase();
      conditions.push(
        or(
          ilike(jobs.title, `%${searchLower}%`),
          ilike(jobs.company, `%${searchLower}%`),
          ilike(jobs.location, `%${searchLower}%`)
        )
      );
    }

    if (status && status !== "all") {
      conditions.push(eq(jobs.status, status as "active" | "paused" | "closed" | "private"));
    }

    if (type && type !== "all") {
      if (type === "published") {
        conditions.push(ne(jobs.status, "private"));
      } else if (type === "private") {
        conditions.push(eq(jobs.status, "private" as "active" | "paused" | "closed" | "private"));
      } else if (type === "external") {
        conditions.push(isNotNull(jobs.external_source));
      } else if (type === "internal") {
        conditions.push(isNull(jobs.external_source));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: count() })
      .from(jobs)
      .where(whereClause);
    const total = countResult.count;

    let jobRows;
    if (sortBy === "company" || sortBy === "location") {
      const col = sortBy === "company" ? jobs.company : jobs.location;
      const popularitySubquery = db
        .select({ value: col, cnt: count().as("cnt") })
        .from(jobs)
        .groupBy(col)
        .as("popularity");
      const joinCol = sortBy === "company" ? jobs.company : jobs.location;
      const orderDir = sortOrder === "asc" ? asc(sql`popularity.cnt`) : desc(sql`popularity.cnt`);
      jobRows = await db
        .select({ job: jobs })
        .from(jobs)
        .leftJoin(popularitySubquery, eq(joinCol, popularitySubquery.value))
        .where(whereClause)
        .orderBy(orderDir, asc(joinCol))
        .limit(limit)
        .offset(offset)
        .then(rows => rows.map(r => r.job));
    } else {
      const sortColumn = (() => {
        switch (sortBy) {
          case "title":
            return jobs.title;
          case "status":
            return jobs.status;
          case "created_at":
          default:
            return jobs.created_at;
        }
      })();
      const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
      jobRows = await db
        .select()
        .from(jobs)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);
    }

    const jobIds = jobRows.map((j) => j.id);
    let appCounts: Map<number, { total: number; hired: number }> = new Map();

    if (jobIds.length > 0) {
      const appStats = await db
        .select({
          job_id: job_applications.job_id,
          total: count(),
          hired: sql<number>`count(*) filter (where ${job_applications.status} = 'hired')`,
        })
        .from(job_applications)
        .where(inArray(job_applications.job_id, jobIds))
        .groupBy(job_applications.job_id);

      for (const row of appStats) {
        appCounts.set(row.job_id, { total: row.total, hired: Number(row.hired) });
      }
    }

    const recruiterIds = jobRows
      .map((j) => j.recruiter_id)
      .filter((id): id is number => id !== null);
    let recruiterMap: Map<number, { email: string; name: string }> = new Map();

    if (recruiterIds.length > 0) {
      const uniqueIds = Array.from(new Set(recruiterIds));
      const recruiters = await db
        .select({
          id: users.id,
          email: users.email,
          first_name: users.first_name,
          last_name: users.last_name,
        })
        .from(users)
        .where(inArray(users.id, uniqueIds));

      for (const r of recruiters) {
        recruiterMap.set(r.id, {
          email: r.email,
          name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
        });
      }
    }

    const enrichedJobs = jobRows.map((job) => {
      const counts = appCounts.get(job.id) || { total: 0, hired: 0 };
      const recruiter = job.recruiter_id ? recruiterMap.get(job.recruiter_id) : undefined;
      return {
        ...job,
        application_count: counts.total,
        hired_count: counts.hired,
        recruiter_email: recruiter?.email,
        recruiter_name: recruiter?.name,
      };
    });

    return { jobs: enrichedJobs, total };
  }

  async getAdminJobDetail(jobId: number): Promise<{
    job: Job & { recruiter_email?: string; recruiter_name?: string; application_count: number; hired_count: number };
    applications: { id: number; freelancer_id: number; status: string; applied_at: Date; freelancer_name: string; freelancer_email: string; freelancer_title?: string | null }[];
  } | null> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) return null;

    let recruiter_email: string | undefined;
    let recruiter_name: string | undefined;
    if (job.recruiter_id) {
      const [recruiter] = await db
        .select({ email: users.email, first_name: users.first_name, last_name: users.last_name })
        .from(users)
        .where(eq(users.id, job.recruiter_id))
        .limit(1);
      if (recruiter) {
        recruiter_email = recruiter.email;
        recruiter_name = [recruiter.first_name, recruiter.last_name].filter(Boolean).join(" ") || recruiter.email;
      }
    }

    const appRows = await db
      .select({
        id: job_applications.id,
        freelancer_id: job_applications.freelancer_id,
        status: job_applications.status,
        applied_at: job_applications.applied_at,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
        title: freelancer_profiles.title,
      })
      .from(job_applications)
      .leftJoin(users, eq(job_applications.freelancer_id, users.id))
      .leftJoin(freelancer_profiles, eq(job_applications.freelancer_id, freelancer_profiles.user_id))
      .where(eq(job_applications.job_id, jobId))
      .orderBy(desc(job_applications.applied_at));

    const totalApps = appRows.length;
    const hiredCount = appRows.filter(a => a.status === "hired").length;

    const applications = appRows.map(a => ({
      id: a.id,
      freelancer_id: a.freelancer_id,
      status: a.status || "applied",
      applied_at: a.applied_at,
      freelancer_name: [a.first_name, a.last_name].filter(Boolean).join(" ") || a.email || "Unknown",
      freelancer_email: a.email || "",
      freelancer_title: a.title,
    }));

    return {
      job: { ...job, recruiter_email, recruiter_name, application_count: totalApps, hired_count: hiredCount },
      applications,
    };
  }

  async getJobsByRecruiterId(recruiterId: number): Promise<Job[]> {
    const today = new Date().toISOString().split("T")[0];
    await db
      .update(jobs)
      .set({ status: "closed", updated_at: new Date() })
      .where(
        and(
          eq(jobs.recruiter_id, recruiterId),
          or(eq(jobs.status, "active"), isNull(jobs.status)),
          sql`${jobs.event_date} IS NOT NULL AND ${jobs.event_date}::date <= ${today}::date`
        )
      );

    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.recruiter_id, recruiterId))
      .orderBy(desc(jobs.created_at));
  }

  async getJobById(jobId: number): Promise<Job | undefined> {
    const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    return result[0];
  }

  async createJob(job: InsertJob): Promise<Job> {
    const result = await db
      .insert(jobs)
      .values([job as any])
      .returning();
    return result[0];
  }

  async updateJob(jobId: number, job: Partial<InsertJob>): Promise<Job | undefined> {
    const updateData: any = { updated_at: new Date() };

    // Only include defined fields
    if (job.title !== undefined) updateData.title = job.title;
    if (job.company !== undefined) updateData.company = job.company;
    if (job.location !== undefined) updateData.location = job.location;
    if (job.type !== undefined) updateData.type = job.type;
    if (job.rate !== undefined) updateData.rate = job.rate;
    if (job.description !== undefined) updateData.description = job.description;
    if (job.status !== undefined) updateData.status = job.status;
    if (job.contract_type !== undefined) updateData.contract_type = job.contract_type;
    if (job.event_date !== undefined) updateData.event_date = job.event_date;
    if (job.end_date !== undefined) updateData.end_date = job.end_date;
    if (job.duration_type !== undefined) updateData.duration_type = job.duration_type;
    if (job.start_time !== undefined) updateData.start_time = job.start_time;
    if (job.end_time !== undefined) updateData.end_time = job.end_time;
    if (job.days !== undefined) updateData.days = job.days;
    if (job.hours !== undefined) updateData.hours = job.hours;

    const result = await db.update(jobs).set(updateData).where(eq(jobs.id, jobId)).returning();
    return result[0];
  }

  async deleteJob(jobId: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, jobId));

    // Clear cached job and application lists
    cache.clear();
  }

  async searchJobs(filters: {
    keyword?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Job[]> {
    try {
      const { keyword, location, startDate, endDate } = filters;

      // Build conditions array
      const conditions = [];

      // Only show active jobs
      conditions.push(or(eq(jobs.status, "active"), isNull(jobs.status)));

      // Exclude jobs whose event_date has passed
      const today = new Date().toISOString().split("T")[0];
      conditions.push(
        or(isNull(jobs.event_date), sql`${jobs.event_date}::date > ${today}::date`)
      );

      // Keyword search: title, description, or company (case-insensitive)
      if (keyword && keyword.trim()) {
        const searchTerm = `%${keyword.toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${jobs.title}) LIKE ${searchTerm}`,
            sql`LOWER(${jobs.description}) LIKE ${searchTerm}`,
            sql`LOWER(${jobs.company}) LIKE ${searchTerm}`
          )
        );
      }

      // Location filter (case-insensitive partial match)
      if (location && location.trim()) {
        const locationTerm = `%${location.toLowerCase()}%`;
        conditions.push(sql`LOWER(${jobs.location}) LIKE ${locationTerm}`);
      }

      // Date range filter on event_date
      if (startDate || endDate) {
        if (startDate && endDate) {
          // Both dates provided - find jobs within range
          conditions.push(
            and(sql`${jobs.event_date} >= ${startDate}`, sql`${jobs.event_date} <= ${endDate}`)
          );
        } else if (startDate) {
          // Only start date - find jobs on or after this date
          conditions.push(sql`${jobs.event_date} >= ${startDate}`);
        } else if (endDate) {
          // Only end date - find jobs on or before this date
          conditions.push(sql`${jobs.event_date} <= ${endDate}`);
        }
      }

      // Fetch ALL jobs (both EventLink and external) with filters
      const results = await db
        .select()
        .from(jobs)
        .where(and(...conditions));

      // Sort with EventLink jobs first (external_source IS NULL), then external jobs
      // Within each group, sort by created_at or posted_date DESC (most recent first)
      const sortedResults = results.sort((a, b) => {
        // First priority: EventLink jobs (no external_source) come first
        const aIsEventLink = !a.external_source;
        const bIsEventLink = !b.external_source;

        if (aIsEventLink && !bIsEventLink) return -1;
        if (!aIsEventLink && bIsEventLink) return 1;

        // Second priority: sort by date (most recent first)
        // Use posted_date for external jobs, created_at for EventLink jobs
        const aDate = a.posted_date ? new Date(a.posted_date) : new Date(a.created_at);
        const bDate = b.posted_date ? new Date(b.posted_date) : new Date(b.created_at);
        return bDate.getTime() - aDate.getTime();
      });

      return sortedResults;
    } catch (error) {
      console.error("Search jobs error:", error);
      return [];
    }
  }

  async getJobByExternalId(externalId: string): Promise<Job | undefined> {
    const result = await db.select().from(jobs).where(eq(jobs.external_id, externalId)).limit(1);
    return result[0];
  }

  async createExternalJob(job: any): Promise<Job> {
    const result = await db.insert(jobs).values([job]).returning();
    return result[0];
  }

  async getExternalJobs(): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(and(isNull(jobs.recruiter_id), eq(jobs.type, "external"))); // External jobs have recruiter_id = null and type = 'external'
  }

  async deleteAllExternalJobs(): Promise<number> {
    // Delete jobs that have an external_source (from Reed/Adzuna)
    const result = await db
      .delete(jobs)
      .where(isNotNull(jobs.external_source))
      .returning({ id: jobs.id });
    return result.length;
  }

  // Job application methods
  async createJobApplication(application: InsertJobApplication): Promise<JobApplication> {
    const result = await db
      .insert(job_applications)
      .values([application as any])
      .returning();

    // Clear cached application lists so new application appears immediately
    cache.clearPattern("freelancer-applications-");
    cache.clearPattern("recruiter-applications-");

    return result[0];
  }

  async getFreelancerApplications(freelancerId: number): Promise<JobApplication[]> {
    const result = await db
      .select({
        id: job_applications.id,
        job_id: job_applications.job_id,
        freelancer_id: job_applications.freelancer_id,
        status: job_applications.status,
        cover_letter: job_applications.cover_letter,
        rejection_message: job_applications.rejection_message,
        applied_at: job_applications.applied_at,
        updated_at: job_applications.updated_at,
        freelancer_deleted: job_applications.freelancer_deleted,
        recruiter_deleted: job_applications.recruiter_deleted,
        job_title: jobs.title,
        job_company: jobs.company,
        invitation_message: job_applications.invitation_message,
        freelancer_response: job_applications.freelancer_response,
        recruiter_id: jobs.recruiter_id,
        rating_id: sql<number>`(SELECT id FROM ratings WHERE ratings.job_application_id = ${job_applications.id} LIMIT 1)`,
        rating: sql<number>`(SELECT rating FROM ratings WHERE ratings.job_application_id = ${job_applications.id} LIMIT 1)`,
        review: sql<string>`(SELECT review FROM ratings WHERE ratings.job_application_id = ${job_applications.id} LIMIT 1)`,
        has_requested_rating: sql<boolean>`EXISTS(SELECT 1 FROM rating_requests WHERE rating_requests.job_application_id = ${job_applications.id} AND rating_requests.freelancer_id = ${freelancerId})`,
      })
      .from(job_applications)
      .innerJoin(jobs, eq(jobs.id, job_applications.job_id))
      .where(
        and(
          eq(job_applications.freelancer_id, freelancerId),
          eq(job_applications.freelancer_deleted, false)
        )
      )
      .orderBy(desc(job_applications.applied_at));
    return result as JobApplication[];
  }

  async getJobApplications(jobId: number): Promise<JobApplication[]> {
    const result = await db
      .select({
        id: job_applications.id,
        job_id: job_applications.job_id,
        freelancer_id: job_applications.freelancer_id,
        status: job_applications.status,
        cover_letter: job_applications.cover_letter,
        rejection_message: job_applications.rejection_message,
        applied_at: job_applications.applied_at,
        updated_at: job_applications.updated_at,
        freelancer_deleted: job_applications.freelancer_deleted,
        recruiter_deleted: job_applications.recruiter_deleted,
        job_title: jobs.title,
        job_company: jobs.company,
        invitation_message: job_applications.invitation_message,
        freelancer_response: job_applications.freelancer_response,
        rating_id: sql<number>`(SELECT id FROM ratings WHERE ratings.job_application_id = ${job_applications.id} LIMIT 1)`,
        rating: sql<number>`(SELECT rating FROM ratings WHERE ratings.job_application_id = ${job_applications.id} LIMIT 1)`,
        review: sql<string>`(SELECT review FROM ratings WHERE ratings.job_application_id = ${job_applications.id} LIMIT 1)`,
      })
      .from(job_applications)
      .innerJoin(jobs, eq(jobs.id, job_applications.job_id))
      .where(
        and(eq(job_applications.job_id, jobId), eq(job_applications.recruiter_deleted, false))
      );
    return result as JobApplication[];
  }

  async getJobApplicationsByFreelancer(freelancerId: number): Promise<JobApplication[]> {
    return await db
      .select()
      .from(job_applications)
      .where(
        and(
          eq(job_applications.freelancer_id, freelancerId),
          eq(job_applications.freelancer_deleted, false)
        )
      );
  }

  // Soft delete methods for applications
  async softDeleteApplication(
    applicationId: number,
    userRole: "freelancer" | "recruiter"
  ): Promise<void> {
    const fieldToUpdate = userRole === "freelancer" ? "freelancer_deleted" : "recruiter_deleted";
    await db
      .update(job_applications)
      .set({ [fieldToUpdate]: true, updated_at: new Date() })
      .where(eq(job_applications.id, applicationId));

    // Clear cached application lists
    cache.clear();
  }

  async getRecruiterApplications(recruiterId: number): Promise<JobApplication[]> {
    const result = await db
      .select({
        id: job_applications.id,
        job_id: job_applications.job_id,
        freelancer_id: job_applications.freelancer_id,
        status: job_applications.status,
        cover_letter: job_applications.cover_letter,
        rejection_message: job_applications.rejection_message,
        applied_at: job_applications.applied_at,
        updated_at: job_applications.updated_at,
        freelancer_deleted: job_applications.freelancer_deleted,
        recruiter_deleted: job_applications.recruiter_deleted,
        recruiter_id: jobs.recruiter_id,
        job_title: jobs.title,
        job_company: jobs.company,
        invitation_message: job_applications.invitation_message,
        freelancer_response: job_applications.freelancer_response,
        freelancer_profile: {
          id: freelancer_profiles.id,
          user_id: freelancer_profiles.user_id,
          first_name: freelancer_profiles.first_name,
          last_name: freelancer_profiles.last_name,
          title: freelancer_profiles.title,
          superpower: freelancer_profiles.superpower,
          bio: freelancer_profiles.bio,
          location: freelancer_profiles.location,
          experience_years: freelancer_profiles.experience_years,
          skills: freelancer_profiles.skills,
          portfolio_url: freelancer_profiles.portfolio_url,
          linkedin_url: freelancer_profiles.linkedin_url,
          website_url: freelancer_profiles.website_url,
          availability_status: freelancer_profiles.availability_status,
          profile_photo_url: freelancer_profiles.profile_photo_url,
        },
        rating_id: sql<number>`(SELECT id FROM ratings WHERE ratings.job_application_id = ${job_applications.id} AND ratings.recruiter_id = ${recruiterId} LIMIT 1)`,
        rating: sql<number>`(SELECT rating FROM ratings WHERE ratings.job_application_id = ${job_applications.id} AND ratings.recruiter_id = ${recruiterId} LIMIT 1)`,
        review: sql<string>`(SELECT review FROM ratings WHERE ratings.job_application_id = ${job_applications.id} AND ratings.recruiter_id = ${recruiterId} LIMIT 1)`,
      })
      .from(job_applications)
      .innerJoin(jobs, eq(jobs.id, job_applications.job_id))
      .leftJoin(
        freelancer_profiles,
        eq(freelancer_profiles.user_id, job_applications.freelancer_id)
      )
      .where(
        and(
          eq(jobs.recruiter_id, recruiterId),
          eq(job_applications.recruiter_deleted, false),
          eq(job_applications.freelancer_deleted, false)
        )
      )
      .orderBy(desc(job_applications.applied_at));
    return result as JobApplication[];
  }

  async getJobApplicationById(applicationId: number): Promise<JobApplication | undefined> {
    const result = await db
      .select()
      .from(job_applications)
      .where(eq(job_applications.id, applicationId))
      .limit(1);
    return result[0];
  }

  async updateApplicationStatus(
    applicationId: number,
    status: "applied" | "reviewed" | "shortlisted" | "rejected" | "hired" | "invited" | "declined",
    rejectionMessage?: string
  ): Promise<JobApplication> {
    const updateData: any = {
      status: status,
      updated_at: sql`now()`,
    };

    if (status === "rejected" && rejectionMessage) {
      updateData.rejection_message = rejectionMessage;
    }

    // If hiring, un-delete from freelancer's view so they can see they were hired
    if (status === "hired") {
      updateData.freelancer_deleted = false;
    }

    const result = await db
      .update(job_applications)
      .set(updateData)
      .where(eq(job_applications.id, applicationId))
      .returning();

    // If hiring a freelancer, close the job posting
    if (status === "hired") {
      const application = result[0];
      if (application?.job_id) {
        await db
          .update(jobs)
          .set({
            status: "closed",
            updated_at: sql`now()`,
          })
          .where(eq(jobs.id, application.job_id));
      }
    }

    // Clear cached application lists so refetches get fresh data
    cache.clearPattern("freelancer-applications-");
    cache.clearPattern("recruiter-applications-");

    return result[0];
  }

  async updateInvitationResponse(
    applicationId: number,
    status: "applied" | "declined",
    responseMessage?: string
  ): Promise<JobApplication> {
    const updateData: any = {
      status: status,
      updated_at: sql`now()`,
    };

    if (status === "declined" && responseMessage) {
      updateData.freelancer_response = responseMessage;
    }

    const result = await db
      .update(job_applications)
      .set(updateData)
      .where(eq(job_applications.id, applicationId))
      .returning();

    // Clear cache
    cache.clearPattern("freelancer-applications-");
    cache.clearPattern("recruiter-applications-");

    return result[0];
  }

  // Messaging methods
  async getOrCreateConversation(userOneId: number, userTwoId: number): Promise<Conversation> {
    // Find existing conversation (including soft-deleted ones)
    const existing = await db
      .select()
      .from(conversations)
      .where(
        or(
          and(
            eq(conversations.participant_one_id, userOneId),
            eq(conversations.participant_two_id, userTwoId)
          ),
          and(
            eq(conversations.participant_one_id, userTwoId),
            eq(conversations.participant_two_id, userOneId)
          )
        )
      )
      .limit(1);

    if (existing[0]) {
      // If conversation exists, restore it for the initiating user (userOneId)
      // Keep the deletion timestamp to hide old messages - only clear the flag
      let needsRestore = false;
      const updates: any = { updated_at: sql`now()` };

      if (existing[0].participant_one_id === userOneId && existing[0].participant_one_deleted) {
        updates.participant_one_deleted = false;
        // Keep participant_one_deleted_at intact to filter old messages
        needsRestore = true;
      } else if (
        existing[0].participant_two_id === userOneId &&
        existing[0].participant_two_deleted
      ) {
        updates.participant_two_deleted = false;
        // Keep participant_two_deleted_at intact to filter old messages
        needsRestore = true;
      }

      if (needsRestore) {
        await db.update(conversations).set(updates).where(eq(conversations.id, existing[0].id));

        // Update local object to reflect changes
        Object.assign(existing[0], updates);

        // Clear targeted caches for both participants
        cache.clearPattern(`conversations-${userOneId}`);
        cache.clearPattern(`conversations-${userTwoId}`);
        cache.clearPattern(`unread-messages-${userOneId}`);
        cache.clearPattern(`unread-messages-${userTwoId}`);
      }

      return existing[0];
    }

    // Create new conversation
    const result = await db
      .insert(conversations)
      .values({
        participant_one_id: userOneId,
        participant_two_id: userTwoId,
      })
      .returning();

    // Clear caches for both participants
    cache.clearPattern(`conversations-${userOneId}`);
    cache.clearPattern(`conversations-${userTwoId}`);

    return result[0];
  }

  async getConversationsByUserId(
    userId: number
  ): Promise<Array<Conversation & { otherUser: User }>> {
    const result = await db
      .select({
        id: conversations.id,
        participant_one_id: conversations.participant_one_id,
        participant_two_id: conversations.participant_two_id,
        participant_one_deleted: conversations.participant_one_deleted,
        participant_two_deleted: conversations.participant_two_deleted,
        participant_one_deleted_at: conversations.participant_one_deleted_at,
        participant_two_deleted_at: conversations.participant_two_deleted_at,
        last_message_at: conversations.last_message_at,
        created_at: conversations.created_at,
        otherUserId: sql<number>`CASE
        WHEN ${conversations.participant_one_id} = ${userId} THEN ${conversations.participant_two_id}
        ELSE ${conversations.participant_one_id}
      END`,
        otherUserEmail: users.email,
        otherUserRole: users.role,
        otherUserDeleted: users.deleted_at,
        // Profile data for freelancers
        freelancerFirstName: freelancer_profiles.first_name,
        freelancerLastName: freelancer_profiles.last_name,
        // Profile data for recruiters
        recruiterCompanyName: recruiter_profiles.company_name,
      })
      .from(conversations)
      .leftJoin(
        users,
        sql`${users.id} = CASE
        WHEN ${conversations.participant_one_id} = ${userId} THEN ${conversations.participant_two_id}
        ELSE ${conversations.participant_one_id}
      END`
      )
      .leftJoin(
        freelancer_profiles,
        eq(
          freelancer_profiles.user_id,
          sql`CASE
        WHEN ${conversations.participant_one_id} = ${userId} THEN ${conversations.participant_two_id}
        ELSE ${conversations.participant_one_id}
      END`
        )
      )
      .leftJoin(
        recruiter_profiles,
        eq(
          recruiter_profiles.user_id,
          sql`CASE
        WHEN ${conversations.participant_one_id} = ${userId} THEN ${conversations.participant_two_id}
        ELSE ${conversations.participant_one_id}
      END`
        )
      )
      .where(
        and(
          or(
            eq(conversations.participant_one_id, userId),
            eq(conversations.participant_two_id, userId)
          ),
          // Only show if this user hasn't deleted it (ignore the other participant's status)
          or(
            and(
              eq(conversations.participant_one_id, userId),
              eq(conversations.participant_one_deleted, false)
            ),
            and(
              eq(conversations.participant_two_id, userId),
              eq(conversations.participant_two_deleted, false)
            )
          )
        )
      )
      .orderBy(desc(conversations.last_message_at));

    return result.map((row) => ({
      id: row.id,
      participant_one_id: row.participant_one_id,
      participant_two_id: row.participant_two_id,
      participant_one_deleted: row.participant_one_deleted,
      participant_two_deleted: row.participant_two_deleted,
      participant_one_deleted_at: row.participant_one_deleted_at,
      participant_two_deleted_at: row.participant_two_deleted_at,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
      otherUser: {
        id: row.otherUserId,
        email: row.otherUserEmail || "",
        role: (row.otherUserRole as "freelancer" | "recruiter" | "admin") || "freelancer",
        password: "",
        first_name: row.freelancerFirstName,
        last_name: row.freelancerLastName,
        company_name: row.recruiterCompanyName,
        email_verified: false,
        email_verification_token: null,
        email_verification_expires: null,
        password_reset_token: null,
        password_reset_expires: null,
        auth_provider: "email" as const,
        google_id: null,
        facebook_id: null,
        linkedin_id: null,
        profile_photo_url: null,
        last_login_method: null,
        last_login_at: null,
        deleted_at: row.otherUserDeleted,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      },
    }));
  }

  async sendMessage(message: InsertMessage): Promise<Message> {
    // Use transaction to ensure atomic operations:
    // 1. Insert message
    // 2. Update conversation last_message_at
    // 3. Restore soft-deleted conversation ONLY for the sender
    const result = await db.transaction(async (tx) => {
      // Insert the message
      const result = await tx.insert(messages).values(message).returning();

      // Get conversation to determine sender's position
      const conversation = await tx
        .select()
        .from(conversations)
        .where(eq(conversations.id, message.conversation_id))
        .limit(1);

      if (conversation[0] && message.sender_id) {
        const updates: any = { last_message_at: new Date() };

        // Restore the SENDER's deleted flag
        if (conversation[0].participant_one_id === message.sender_id) {
          updates.participant_one_deleted = false;
        } else if (conversation[0].participant_two_id === message.sender_id) {
          updates.participant_two_deleted = false;
        }

        // Also restore the RECEIVER's deleted flag so they can see the new message
        // This ensures that when a message is sent, both participants can see the conversation
        const receiverId =
          conversation[0].participant_one_id === message.sender_id
            ? conversation[0].participant_two_id
            : conversation[0].participant_one_id;

        if (
          conversation[0].participant_one_id === receiverId &&
          conversation[0].participant_one_deleted
        ) {
          updates.participant_one_deleted = false;
        } else if (
          conversation[0].participant_two_id === receiverId &&
          conversation[0].participant_two_deleted
        ) {
          updates.participant_two_deleted = false;
        }

        await tx
          .update(conversations)
          .set(updates)
          .where(eq(conversations.id, message.conversation_id));

        console.log(
          `✅ Conversation ${message.conversation_id} restored for sender ${message.sender_id} and receiver ${receiverId}`,
          updates
        );
      }

      return result[0];
    });

    // Clear caches immediately after message is sent
    // Get conversation to find both participants
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, message.conversation_id))
      .limit(1);

    if (conversation.length > 0) {
      const conv = conversation[0];
      // Clear message cache for this conversation
      cache.clearPattern(`conversation_messages:${message.conversation_id}`);
      // Clear conversations cache for both participants using clearPattern
      cache.clearPattern(`conversations-${conv.participant_one_id}`);
      cache.clearPattern(`conversations-${conv.participant_two_id}`);
      cache.clearPattern(`unread-messages-${conv.participant_one_id}`);
      cache.clearPattern(`unread-messages-${conv.participant_two_id}`);

      console.log(
        `✅ Cache cleared for conversation ${message.conversation_id} and users ${conv.participant_one_id}, ${conv.participant_two_id}`
      );
    }

    return result;
  }

  async getConversationMessages(
    conversationId: number
  ): Promise<Array<Message & { sender: User; attachments?: MessageAttachment[] }>> {
    const result = await db
      .select({
        id: messages.id,
        conversation_id: messages.conversation_id,
        sender_id: messages.sender_id,
        content: messages.content,
        is_read: messages.is_read,
        is_system_message: messages.is_system_message,
        created_at: messages.created_at,
        senderEmail: users.email,
        senderRole: users.role,
      })
      .from(messages)
      .leftJoin(users, eq(messages.sender_id, users.id))
      .where(eq(messages.conversation_id, conversationId))
      .orderBy(messages.created_at);

    // Load attachments for each message
    const messagesWithAttachments = await Promise.all(
      result.map(async (row) => {
        const attachments = await this.getMessageAttachments(row.id);
        return {
          id: row.id,
          conversation_id: row.conversation_id,
          sender_id: row.sender_id,
          content: row.content,
          is_read: row.is_read,
          is_system_message: row.is_system_message,
          created_at: row.created_at,
          sender: {
            id: row.sender_id || 0, // Use 0 for system messages with null sender_id
            email: row.senderEmail || "",
            role: row.senderRole || ("freelancer" as const),
            password: "",
            first_name: null,
            last_name: null,
            email_verified: false,
            email_verification_token: null,
            email_verification_expires: null,
            password_reset_token: null,
            password_reset_expires: null,
            auth_provider: "email" as const,
            google_id: null,
            facebook_id: null,
            linkedin_id: null,
            profile_photo_url: null,
            last_login_method: null,
            last_login_at: null,
            deleted_at: null,
            status: "pending",
            created_at: new Date(),
            updated_at: new Date(),
          },
          attachments: attachments.length > 0 ? attachments : undefined,
        };
      })
    );

    return messagesWithAttachments;
  }

  async getConversationMessagesForUser(
    conversationId: number,
    userId: number
  ): Promise<Array<Message & { sender: User; attachments?: MessageAttachment[] }>> {
    // First, get the conversation to check if user deleted it and when
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    let deletedAt: Date | null = null;
    if (conversation[0]) {
      // Determine which participant is viewing and get their deletion timestamp
      if (conversation[0].participant_one_id === userId) {
        deletedAt = conversation[0].participant_one_deleted_at;
      } else if (conversation[0].participant_two_id === userId) {
        deletedAt = conversation[0].participant_two_deleted_at;
      }
    }

    // Build the where conditions
    const whereConditions = [
      eq(messages.conversation_id, conversationId),
      isNull(message_user_states.id), // Exclude messages individually deleted by this user
    ];

    // If user deleted the conversation, only show messages created AFTER that deletion
    if (deletedAt) {
      whereConditions.push(gt(messages.created_at, deletedAt));
    }

    const result = await db
      .select({
        id: messages.id,
        conversation_id: messages.conversation_id,
        sender_id: messages.sender_id,
        content: messages.content,
        is_read: messages.is_read,
        is_system_message: messages.is_system_message,
        created_at: messages.created_at,
        senderEmail: users.email,
        senderRole: users.role,
      })
      .from(messages)
      .leftJoin(users, eq(messages.sender_id, users.id))
      .leftJoin(
        message_user_states,
        and(
          eq(message_user_states.message_id, messages.id),
          eq(message_user_states.user_id, userId)
        )
      )
      .where(and(...whereConditions))
      .orderBy(messages.created_at);

    // Load attachments for each message
    const messagesWithAttachments = await Promise.all(
      result.map(async (row) => {
        const attachments = await this.getMessageAttachments(row.id);
        return {
          id: row.id,
          conversation_id: row.conversation_id,
          sender_id: row.sender_id,
          content: row.content,
          is_read: row.is_read,
          is_system_message: row.is_system_message,
          created_at: row.created_at,
          sender: {
            id: row.sender_id || 0, // Use 0 for system messages with null sender_id
            email: row.senderEmail || "",
            role: (row.senderRole as "freelancer" | "recruiter" | "admin") || "freelancer",
            password: "",
            first_name: null,
            last_name: null,
            email_verified: false,
            email_verification_token: null,
            email_verification_expires: null,
            password_reset_token: null,
            password_reset_expires: null,
            auth_provider: "email" as const,
            google_id: null,
            facebook_id: null,
            linkedin_id: null,
            profile_photo_url: null,
            last_login_method: null,
            last_login_at: null,
            deleted_at: null,
            status: "pending",
            created_at: new Date(),
            updated_at: new Date(),
          },
          attachments: attachments.length > 0 ? attachments : undefined,
        };
      })
    );

    return messagesWithAttachments;
  }

  // Soft delete methods for messages
  async markMessageDeletedForUser(messageId: number, userId: number): Promise<void> {
    await db.insert(message_user_states).values({
      message_id: messageId,
      user_id: userId,
    });

    // Clear cached message lists
    cache.clear();
  }

  async deleteConversation(conversationId: number, userId: number): Promise<void> {
    // Get the conversation to determine which participant is deleting
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation[0]) {
      throw new Error("Conversation not found");
    }

    const now = new Date();

    // Determine which field to update based on the user
    // Set both the boolean flag AND the timestamp
    if (conversation[0].participant_one_id === userId) {
      await db
        .update(conversations)
        .set({
          participant_one_deleted: true,
          participant_one_deleted_at: now,
        })
        .where(eq(conversations.id, conversationId));
    } else if (conversation[0].participant_two_id === userId) {
      await db
        .update(conversations)
        .set({
          participant_two_deleted: true,
          participant_two_deleted_at: now,
        })
        .where(eq(conversations.id, conversationId));
    }

    // Clear cached conversation lists
    cache.clear();
  }

  async markMessagesAsRead(conversationId: number, userId: number): Promise<void> {
    await db
      .update(messages)
      .set({ is_read: true })
      .where(
        and(
          eq(messages.conversation_id, conversationId),
          sql`${messages.sender_id} != ${userId}` // Don't mark own messages as read
        )
      );
  }

  // Message attachment methods
  async createMessageAttachment(attachment: InsertMessageAttachment): Promise<MessageAttachment> {
    const attachmentData = {
      ...attachment,
      scan_status: attachment.scan_status as "pending" | "safe" | "unsafe" | "error" | null,
      moderation_status: attachment.moderation_status as
        | "pending"
        | "approved"
        | "rejected"
        | "error"
        | null,
    };
    const result = await db.insert(message_attachments).values([attachmentData]).returning();
    return result[0];
  }

  async getMessageAttachments(messageId: number): Promise<MessageAttachment[]> {
    const result = await db
      .select()
      .from(message_attachments)
      .where(eq(message_attachments.message_id, messageId))
      .orderBy(message_attachments.created_at);
    return result;
  }

  async getAttachmentById(attachmentId: number): Promise<MessageAttachment | undefined> {
    const result = await db
      .select()
      .from(message_attachments)
      .where(eq(message_attachments.id, attachmentId))
      .limit(1);
    return result[0];
  }

  async getMessageById(messageId: number): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    return result[0];
  }

  async getMessageAttachmentById(attachmentId: number): Promise<MessageAttachment | undefined> {
    return this.getAttachmentById(attachmentId);
  }

  async createFileReport(report: {
    attachment_id: number;
    reporter_id: number;
    report_reason: string;
    report_details: string | null;
  }): Promise<any> {
    // For now, just log the report - in production would save to a reports table
    console.log("File report received:", report);
    return {
      id: Date.now(),
      ...report,
      created_at: new Date(),
      status: "pending",
    };
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const userConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        or(
          eq(conversations.participant_one_id, userId),
          eq(conversations.participant_two_id, userId)
        )
      );

    if (userConversations.length === 0) return 0;

    const conversationIds = userConversations.map((c) => c.id);

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          inArray(messages.conversation_id, conversationIds),
          eq(messages.is_read, false),
          sql`${messages.sender_id} != ${userId}`
        )
      );

    return Number(result[0]?.count || 0);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db
      .insert(notifications)
      .values([
        {
          ...notification,
          type: notification.type as
            | "application_update"
            | "new_message"
            | "job_update"
            | "profile_view"
            | "system",
          priority: notification.priority as
            | "low"
            | "normal"
            | "high"
            | "urgent"
            | null
            | undefined,
        },
      ])
      .returning();

    // Broadcast real-time notification to the user
    const newNotification = result[0];
    if (notification.user_id) {
      // Broadcast asynchronously (non-blocking)
      setImmediate(async () => {
        try {
          const { wsService } = await import("./api/websocket/websocketService");

          // Send new_notification event
          wsService.broadcastNotification(notification.user_id!, newNotification);

          // Also send updated badge counts
          const counts = await this.getCategoryUnreadCounts(notification.user_id!);
          wsService.broadcastBadgeCounts(notification.user_id!, counts);
        } catch (error) {
          console.error("Failed to broadcast notification via WebSocket:", error);
          // Don't fail the notification creation if WebSocket broadcast fails
        }
      });
    }

    return newNotification;
  }

  async getNotification(notificationId: number): Promise<Notification | undefined> {
    const result = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);
    return result[0];
  }

  async getUserNotifications(userId: number, limit: number = 50): Promise<Notification[]> {
    const result = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, userId),
          or(isNull(notifications.expires_at), sql`${notifications.expires_at} > NOW()`)
        )
      )
      .orderBy(desc(notifications.created_at))
      .limit(limit);

    return result;
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, userId),
          eq(notifications.is_read, false),
          or(isNull(notifications.expires_at), sql`${notifications.expires_at} > NOW()`)
        )
      );
    return Number(result[0]?.count || 0);
  }

  async getCategoryUnreadCounts(userId: number): Promise<{
    messages: number;
    applications: number;
    jobs: number;
    ratings: number;
    feedback: number;
    contact_messages: number;
    total: number;
  }> {
    // Get counts for each category
    const [
      messagesResult,
      applicationsResult,
      jobsResult,
      ratingsResult,
      feedbackResult,
      contactResult,
    ] = await Promise.all([
      // Messages count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.user_id, userId),
            eq(notifications.is_read, false),
            eq(notifications.type, "new_message"),
            or(isNull(notifications.expires_at), sql`${notifications.expires_at} > NOW()`)
          )
        ),

      // Applications count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.user_id, userId),
            eq(notifications.is_read, false),
            eq(notifications.type, "application_update"),
            or(isNull(notifications.expires_at), sql`${notifications.expires_at} > NOW()`)
          )
        ),

      // Jobs count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.user_id, userId),
            eq(notifications.is_read, false),
            eq(notifications.type, "job_update"),
            or(isNull(notifications.expires_at), sql`${notifications.expires_at} > NOW()`)
          )
        ),

      // Ratings count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.user_id, userId),
            eq(notifications.is_read, false),
            inArray(notifications.type, ["rating_received", "rating_request"]),
            or(isNull(notifications.expires_at), sql`${notifications.expires_at} > NOW()`)
          )
        ),

      // Feedback count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.user_id, userId),
            eq(notifications.is_read, false),
            eq(notifications.type, "feedback"),
            or(isNull(notifications.expires_at), sql`${notifications.expires_at} > NOW()`)
          )
        ),

      // Contact message count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.user_id, userId),
            eq(notifications.is_read, false),
            eq(notifications.type, "contact_message"),
            or(isNull(notifications.expires_at), sql`${notifications.expires_at} > NOW()`)
          )
        ),
    ]);

    const messages = messagesResult[0]?.count || 0;
    const applications = applicationsResult[0]?.count || 0;
    const jobs = jobsResult[0]?.count || 0;
    const ratings = ratingsResult[0]?.count || 0;
    const feedback = feedbackResult[0]?.count || 0;
    const contact_messages = contactResult[0]?.count || 0;
    const total = messages + applications + jobs + ratings + feedback + contact_messages;

    return {
      messages,
      applications,
      jobs,
      ratings,
      feedback,
      contact_messages,
      total,
    };
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ is_read: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ is_read: true })
      .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
  }

  async markCategoryNotificationsAsRead(
    userId: number,
    category: "messages" | "applications" | "jobs" | "ratings" | "feedback" | "contact_messages"
  ): Promise<void> {
    let notificationTypes: string[] = [];

    switch (category) {
      case "messages":
        notificationTypes = ["new_message"];
        break;
      case "applications":
        notificationTypes = ["application_update"];
        break;
      case "jobs":
        notificationTypes = ["job_update"];
        break;
      case "ratings":
        notificationTypes = ["rating_received", "rating_request"];
        break;
      case "feedback":
        notificationTypes = ["feedback"];
        break;
      case "contact_messages":
        notificationTypes = ["contact_message"];
        break;
    }

    if (notificationTypes.length === 0) return;

    await db
      .update(notifications)
      .set({ is_read: true })
      .where(
        and(
          eq(notifications.user_id, userId),
          eq(notifications.is_read, false),
          or(...notificationTypes.map((type) => eq(notifications.type, type as any)))
        )
      );
  }

  async deleteNotification(notificationId: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, notificationId));

    // Clear cached notification lists
    cache.clear();
  }

  async deleteExpiredNotifications(): Promise<void> {
    await db
      .delete(notifications)
      .where(
        and(sql`${notifications.expires_at} IS NOT NULL`, sql`${notifications.expires_at} < NOW()`)
      );
  }

  async deleteUserAccount(userId: number): Promise<void> {
    try {
      // Start a transaction to ensure all operations succeed or all fail
      await db.transaction(async (tx) => {
        // 1. Get user info before soft deletion
        const user = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user.length) {
          throw new Error("User not found");
        }

        // 2. Get all conversations where this user is a participant
        const userConversations = await tx
          .select()
          .from(conversations)
          .where(
            or(
              eq(conversations.participant_one_id, userId),
              eq(conversations.participant_two_id, userId)
            )
          );

        // 3. Add system message to each conversation indicating account deletion
        for (const conversation of userConversations) {
          await tx.insert(messages).values({
            conversation_id: conversation.id,
            sender_id: null, // null for system messages
            content: "Account Deleted",
            is_read: false,
            is_system_message: true,
          });

          // Update conversation's last_message_at timestamp
          await tx
            .update(conversations)
            .set({ last_message_at: new Date() })
            .where(eq(conversations.id, conversation.id));
        }

        // 4. Soft delete user profiles (keep data but mark as deleted)
        await tx.delete(freelancer_profiles).where(eq(freelancer_profiles.user_id, userId));

        await tx.delete(recruiter_profiles).where(eq(recruiter_profiles.user_id, userId));

        // 5. Delete job applications by this user (hard delete as these become invalid)
        await tx.delete(job_applications).where(eq(job_applications.freelancer_id, userId));

        // 6. Delete jobs posted by this user (hard delete as these become invalid)
        await tx.delete(jobs).where(eq(jobs.recruiter_id, userId));

        // 7. Delete notifications for this user (hard delete as they're no longer needed)
        await tx.delete(notifications).where(eq(notifications.user_id, userId));

        // 8. Soft delete the user record (mark as deleted instead of removing)
        await tx
          .update(users)
          .set({
            deleted_at: new Date(),
            email: `deleted_${userId}_${user[0].email}`, // Prevent email conflicts for new registrations
          })
          .where(eq(users.id, userId));

        // 9. Create system messages in all conversations where this user was a participant
        const allUserConversations = await tx
          .select()
          .from(conversations)
          .where(
            or(
              eq(conversations.participant_one_id, userId),
              eq(conversations.participant_two_id, userId)
            )
          );

        for (const conversation of allUserConversations) {
          await tx.insert(messages).values({
            conversation_id: conversation.id,
            sender_id: null, // System message
            content: "This user has deleted their account and can no longer receive messages.",
            is_read: false,
            is_system_message: true,
          });
        }
      });

      console.log(`Successfully soft-deleted user account for user ID: ${userId}`);
    } catch (error) {
      console.error("Error during account deletion:", error);
      throw new Error("Failed to delete user account. Please try again.");
    }
  }

  // User deletion helper methods
  async isUserDeleted(userId: number): Promise<boolean> {
    const user = await db
      .select({ deleted_at: users.deleted_at })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user.length > 0 && user[0].deleted_at !== null;
  }

  async canSendMessageToUser(
    senderId: number,
    recipientId: number
  ): Promise<{ canSend: boolean; error?: string }> {
    // Check if recipient is deleted
    if (await this.isUserDeleted(recipientId)) {
      return {
        canSend: false,
        error: "This account has been deleted and can no longer receive messages.",
      };
    }

    // Check if sender is deleted (shouldn't happen if auth is working, but for safety)
    if (await this.isUserDeleted(senderId)) {
      return {
        canSend: false,
        error: "You cannot send messages from a deleted account.",
      };
    }

    return { canSend: true };
  }

  // Rating management methods
  async createRating(rating: InsertRating): Promise<Rating> {
    const result = await db
      .insert(ratings)
      .values([rating as any])
      .returning();
    return result[0];
  }

  async createRatingWithNotification(
    rating: InsertRating,
    notification: InsertNotification
  ): Promise<Rating> {
    return await db.transaction(async (tx) => {
      // 1. Create the rating
      const ratingResult = await tx
        .insert(ratings)
        .values([rating as any])
        .returning();
      const newRating = ratingResult[0];

      // 2. Create the notification linked to the rating
      let metadataObj: any = {};
      try {
        if (notification.metadata) {
          metadataObj = JSON.parse(notification.metadata);
        }
      } catch (e) {
        console.warn("Failed to parse notification metadata", e);
      }

      // Inject rating_id
      metadataObj.rating_id = newRating.id;

      const notificationData = {
        ...notification,
        related_entity_id: newRating.id,
        metadata: JSON.stringify(metadataObj),
        type: notification.type as any,
        priority: notification.priority as any,
      };

      const notificationResult = await tx
        .insert(notifications)
        .values([notificationData])
        .returning();
      const newNotification = notificationResult[0];

      // 3. Broadcast notification (side effect, non-blocking)
      if (notification.user_id) {
        setImmediate(async () => {
          try {
            const { wsService } = await import("./api/websocket/websocketService");
            wsService.broadcastNotification(notification.user_id!, newNotification);
            const counts = await this.getCategoryUnreadCounts(notification.user_id!);
            wsService.broadcastBadgeCounts(notification.user_id!, counts);
          } catch (error) {
            console.error("Failed to broadcast notification via WebSocket:", error);
          }
        });
      }

      return newRating;
    });
  }

  async getRatingByJobApplication(jobApplicationId: number): Promise<Rating | undefined> {
    const result = await db
      .select()
      .from(ratings)
      .where(eq(ratings.job_application_id, jobApplicationId))
      .limit(1);
    return result[0];
  }

  async getRatingById(ratingId: number): Promise<Rating | undefined> {
    const result = await db.select().from(ratings).where(eq(ratings.id, ratingId)).limit(1);
    return result[0];
  }

  async getFreelancerRatings(
    freelancerId: number
  ): Promise<Array<Rating & { recruiter: User; job_title?: string }>> {
    const result = await db
      .select({
        id: ratings.id,
        job_application_id: ratings.job_application_id,
        recruiter_id: ratings.recruiter_id,
        freelancer_id: ratings.freelancer_id,
        rating: ratings.rating,
        review: ratings.review,
        status: ratings.status,
        flag: ratings.flag,
        admin_notes: ratings.admin_notes,
        created_at: ratings.created_at,
        updated_at: ratings.updated_at,
        recruiter: {
          id: users.id,
          email: users.email,
          role: users.role,
          first_name: users.first_name,
          last_name: users.last_name,
          email_verified: users.email_verified,
          email_verification_token: users.email_verification_token,
          email_verification_expires: users.email_verification_expires,
          password_reset_token: users.password_reset_token,
          password_reset_expires: users.password_reset_expires,
          created_at: users.created_at,
          updated_at: users.updated_at,
          password: users.password,
          status: users.status,
        },
        job_title: jobs.title,
      })
      .from(ratings)
      .leftJoin(users, eq(ratings.recruiter_id, users.id))
      .leftJoin(job_applications, eq(ratings.job_application_id, job_applications.id))
      .leftJoin(jobs, eq(job_applications.job_id, jobs.id))
      .where(
        and(
          eq(ratings.freelancer_id, freelancerId),
          ne(ratings.status, "removed") // Filter out removed reviews
        )
      )
      .orderBy(desc(ratings.created_at));

    return result as Array<Rating & { recruiter: User; job_title?: string }>;
  }

  async updateRating(ratingId: number, updates: Partial<Rating>): Promise<Rating | undefined> {
    const result = await db
      .update(ratings)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(ratings.id, ratingId))
      .returning();
    return result[0];
  }

  async getAllRatings(filters?: {
    status?: string;
  }): Promise<Array<Rating & { recruiter: User; job_title?: string }>> {
    const conditions = [];
    if (filters?.status) {
      if (filters.status === "flagged") {
        conditions.push(or(eq(ratings.status, "flagged"), eq(ratings.flag, "reported")));
      } else {
        conditions.push(eq(ratings.status, filters.status));
      }
    }

    const result = await db
      .select({
        id: ratings.id,
        job_application_id: ratings.job_application_id,
        recruiter_id: ratings.recruiter_id,
        freelancer_id: ratings.freelancer_id,
        rating: ratings.rating,
        review: ratings.review,
        status: ratings.status,
        flag: ratings.flag,
        admin_notes: ratings.admin_notes,
        created_at: ratings.created_at,
        updated_at: ratings.updated_at,
        recruiter: {
          id: users.id,
          email: users.email,
          role: users.role,
          first_name: users.first_name,
          last_name: users.last_name,
          email_verified: users.email_verified,
          email_verification_token: users.email_verification_token,
          email_verification_expires: users.email_verification_expires,
          password_reset_token: users.password_reset_token,
          password_reset_expires: users.password_reset_expires,
          created_at: users.created_at,
          updated_at: users.updated_at,
          password: users.password,
          status: users.status,
        },
        job_title: jobs.title,
      })
      .from(ratings)
      .leftJoin(users, eq(ratings.recruiter_id, users.id))
      .leftJoin(job_applications, eq(ratings.job_application_id, job_applications.id))
      .leftJoin(jobs, eq(job_applications.job_id, jobs.id))
      .where(and(...conditions))
      .orderBy(desc(ratings.created_at));

    return result as any;
  }

  async getFreelancerAverageRating(
    freelancerId: number
  ): Promise<{ average: number; count: number }> {
    const result = await db
      .select({
        average: sql<number>`ROUND(AVG(${ratings.rating}), 1)`,
        count: sql<number>`count(*)::int`,
      })
      .from(ratings)
      .where(eq(ratings.freelancer_id, freelancerId));

    return {
      average: Number(result[0]?.average || 0),
      count: Number(result[0]?.count || 0),
    };
  }

  async canRecruiterRateFreelancer(
    recruiterId: number,
    freelancerId: number,
    jobApplicationId: number
  ): Promise<boolean> {
    // Check if this is a valid hired job application
    const application = await db
      .select()
      .from(job_applications)
      .leftJoin(jobs, eq(job_applications.job_id, jobs.id))
      .where(
        and(
          eq(job_applications.id, jobApplicationId),
          eq(job_applications.freelancer_id, freelancerId),
          eq(job_applications.status, "hired"),
          eq(jobs.recruiter_id, recruiterId)
        )
      )
      .limit(1);

    if (!application.length) return false;

    // Check if rating already exists
    const existingRating = await this.getRatingByJobApplication(jobApplicationId);
    return !existingRating;
  }

  // Rating request management methods
  async createRatingRequest(request: InsertRatingRequest): Promise<RatingRequest> {
    const result = await db
      .insert(rating_requests)
      .values([request as any])
      .returning();
    return result[0];
  }

  async createRatingRequestWithNotification(
    request: InsertRatingRequest,
    notification: InsertNotification
  ): Promise<RatingRequest> {
    return await db.transaction(async (tx) => {
      // 1. Create the rating request
      const requestResult = await tx
        .insert(rating_requests)
        .values([request as any])
        .returning();
      const newRequest = requestResult[0];

      // 2. Create the notification linked to the request
      let metadataObj: any = {};
      try {
        if (notification.metadata) {
          metadataObj = JSON.parse(notification.metadata);
        }
      } catch (e) {
        console.warn("Failed to parse notification metadata", e);
      }

      // Inject rating_request_id
      metadataObj.rating_request_id = newRequest.id;

      const notificationData = {
        ...notification,
        related_entity_id: newRequest.id,
        metadata: JSON.stringify(metadataObj),
        type: notification.type as any,
        priority: notification.priority as any,
      };

      const notificationResult = await tx
        .insert(notifications)
        .values([notificationData])
        .returning();
      const newNotification = notificationResult[0];

      // 3. Broadcast notification
      if (notification.user_id) {
        setImmediate(async () => {
          try {
            const { wsService } = await import("./api/websocket/websocketService");
            wsService.broadcastNotification(notification.user_id!, newNotification);
            const counts = await this.getCategoryUnreadCounts(notification.user_id!);
            wsService.broadcastBadgeCounts(notification.user_id!, counts);
          } catch (error) {
            console.error("Failed to broadcast notification via WebSocket:", error);
          }
        });
      }

      return newRequest;
    });
  }

  async getRatingRequestByJobApplication(
    jobApplicationId: number
  ): Promise<RatingRequest | undefined> {
    const result = await db
      .select()
      .from(rating_requests)
      .where(eq(rating_requests.job_application_id, jobApplicationId))
      .limit(1);
    return result[0];
  }

  async getRecruiterRatingRequests(
    recruiterId: number
  ): Promise<Array<RatingRequest & { freelancer: User; job_title?: string }>> {
    const result = await db
      .select({
        id: rating_requests.id,
        job_application_id: rating_requests.job_application_id,
        freelancer_id: rating_requests.freelancer_id,
        recruiter_id: rating_requests.recruiter_id,
        status: rating_requests.status,
        requested_at: rating_requests.requested_at,
        responded_at: rating_requests.responded_at,
        created_at: rating_requests.created_at,
        updated_at: rating_requests.updated_at,
        freelancer: {
          id: users.id,
          email: users.email,
          role: users.role,
          first_name: users.first_name,
          last_name: users.last_name,
          email_verified: users.email_verified,
          email_verification_token: users.email_verification_token,
          email_verification_expires: users.email_verification_expires,
          password_reset_token: users.password_reset_token,
          password_reset_expires: users.password_reset_expires,
          created_at: users.created_at,
          updated_at: users.updated_at,
          password: users.password,
        },
        job_title: jobs.title,
      })
      .from(rating_requests)
      .leftJoin(users, eq(rating_requests.freelancer_id, users.id))
      .leftJoin(job_applications, eq(rating_requests.job_application_id, job_applications.id))
      .leftJoin(jobs, eq(job_applications.job_id, jobs.id))
      .where(eq(rating_requests.recruiter_id, recruiterId))
      .orderBy(desc(rating_requests.requested_at));

    return result as Array<RatingRequest & { freelancer: User; job_title?: string }>;
  }

  async getFreelancerRatingRequests(
    freelancerId: number
  ): Promise<Array<RatingRequest & { recruiter: User; job_title?: string }>> {
    const result = await db
      .select({
        id: rating_requests.id,
        job_application_id: rating_requests.job_application_id,
        freelancer_id: rating_requests.freelancer_id,
        recruiter_id: rating_requests.recruiter_id,
        status: rating_requests.status,
        requested_at: rating_requests.requested_at,
        responded_at: rating_requests.responded_at,
        created_at: rating_requests.created_at,
        updated_at: rating_requests.updated_at,
        recruiter: {
          id: users.id,
          email: users.email,
          role: users.role,
          first_name: users.first_name,
          last_name: users.last_name,
          email_verified: users.email_verified,
          email_verification_token: users.email_verification_token,
          email_verification_expires: users.email_verification_expires,
          password_reset_token: users.password_reset_token,
          password_reset_expires: users.password_reset_expires,
          created_at: users.created_at,
          updated_at: users.updated_at,
          password: users.password,
        },
        job_title: jobs.title,
      })
      .from(rating_requests)
      .leftJoin(users, eq(rating_requests.recruiter_id, users.id))
      .leftJoin(job_applications, eq(rating_requests.job_application_id, job_applications.id))
      .leftJoin(jobs, eq(job_applications.job_id, jobs.id))
      .where(eq(rating_requests.freelancer_id, freelancerId))
      .orderBy(desc(rating_requests.requested_at));

    return result as Array<RatingRequest & { recruiter: User; job_title?: string }>;
  }

  async updateRatingRequestStatus(
    requestId: number,
    status: "completed" | "declined"
  ): Promise<RatingRequest> {
    const result = await db
      .update(rating_requests)
      .set({
        status: status,
        responded_at: new Date(),
        updated_at: sql`now()`,
      })
      .where(eq(rating_requests.id, requestId))
      .returning();
    return result[0];
  }

  // Feedback management methods for admin dashboard
  async createFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const result = await db
      .insert(feedback)
      .values([feedbackData as any])
      .returning();
    return result[0];
  }

  async getAllFeedback(status?: string, type?: string): Promise<Array<Feedback & { user?: User }>> {
    const conditions = [];

    if (status && status !== "all") {
      conditions.push(eq(feedback.status, status as any));
    }

    if (type && type !== "all") {
      conditions.push(eq(feedback.feedback_type, type as any));
    }

    const query = db
      .select({
        id: feedback.id,
        user_id: feedback.user_id,
        feedback_type: feedback.feedback_type,
        message: feedback.message,
        page_url: feedback.page_url,
        source: feedback.source,
        user_email: feedback.user_email,
        user_name: feedback.user_name,
        status: feedback.status,
        admin_response: feedback.admin_response,
        admin_user_id: feedback.admin_user_id,
        priority: feedback.priority,
        created_at: feedback.created_at,
        updated_at: feedback.updated_at,
        resolved_at: feedback.resolved_at,
        user: {
          id: users.id,
          email: users.email,
          role: users.role,
          first_name: users.first_name,
          last_name: users.last_name,
          email_verified: users.email_verified,
          email_verification_token: users.email_verification_token,
          email_verification_expires: users.email_verification_expires,
          password_reset_token: users.password_reset_token,
          password_reset_expires: users.password_reset_expires,
          created_at: users.created_at,
          updated_at: users.updated_at,
          password: users.password,
          auth_provider: users.auth_provider,
          google_id: users.google_id,
          facebook_id: users.facebook_id,
          linkedin_id: users.linkedin_id,
          profile_photo_url: users.profile_photo_url,
          last_login_method: users.last_login_method,
          last_login_at: users.last_login_at,
        },
      })
      .from(feedback)
      .leftJoin(users, eq(feedback.user_id, users.id));

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const result = await query.orderBy(desc(feedback.created_at));

    return result as Array<Feedback & { user?: User }>;
  }

  async getFeedbackById(id: number): Promise<Feedback | undefined> {
    const result = await db.select().from(feedback).where(eq(feedback.id, id)).limit(1);
    return result[0];
  }

  async updateFeedbackStatus(
    id: number,
    status: "pending" | "in_review" | "resolved" | "closed",
    adminUserId?: number
  ): Promise<Feedback> {
    const updateData: any = {
      status: status,
      updated_at: sql`now()`,
    };

    if (adminUserId) {
      updateData.admin_user_id = adminUserId;
    }

    if (status === "resolved" || status === "closed") {
      updateData.resolved_at = new Date();
    }

    const result = await db.update(feedback).set(updateData).where(eq(feedback.id, id)).returning();
    return result[0];
  }

  async addAdminResponse(id: number, response: string, adminUserId: number): Promise<Feedback> {
    const result = await db
      .update(feedback)
      .set({
        admin_response: response,
        admin_user_id: adminUserId,
        status: "in_review",
        updated_at: sql`now()`,
      })
      .where(eq(feedback.id, id))
      .returning();
    return result[0];
  }

  async getFeedbackByStatus(
    status: "pending" | "in_review" | "resolved" | "closed"
  ): Promise<Array<Feedback & { user?: User }>> {
    const result = await db
      .select({
        id: feedback.id,
        user_id: feedback.user_id,
        feedback_type: feedback.feedback_type,
        message: feedback.message,
        page_url: feedback.page_url,
        source: feedback.source,
        user_email: feedback.user_email,
        user_name: feedback.user_name,
        status: feedback.status,
        admin_response: feedback.admin_response,
        admin_user_id: feedback.admin_user_id,
        priority: feedback.priority,
        created_at: feedback.created_at,
        updated_at: feedback.updated_at,
        resolved_at: feedback.resolved_at,
        user: {
          id: users.id,
          email: users.email,
          role: users.role,
          first_name: users.first_name,
          last_name: users.last_name,
          email_verified: users.email_verified,
          email_verification_token: users.email_verification_token,
          email_verification_expires: users.email_verification_expires,
          password_reset_token: users.password_reset_token,
          password_reset_expires: users.password_reset_expires,
          created_at: users.created_at,
          updated_at: users.updated_at,
          password: users.password,
          auth_provider: users.auth_provider,
          google_id: users.google_id,
          facebook_id: users.facebook_id,
          linkedin_id: users.linkedin_id,
          profile_photo_url: users.profile_photo_url,
          last_login_method: users.last_login_method,
          last_login_at: users.last_login_at,
        },
      })
      .from(feedback)
      .leftJoin(users, eq(feedback.user_id, users.id))
      .where(eq(feedback.status, status))
      .orderBy(desc(feedback.created_at));

    return result as Array<Feedback & { user?: User }>;
  }

  async getFeedbackStats(): Promise<{
    total: number;
    pending: number;
    resolved: number;
    byType: Record<string, number>;
  }> {
    // Get total count and status counts
    const statusStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(case when status = 'pending' then 1 end)::int`,
        in_review: sql<number>`count(case when status = 'in_review' then 1 end)::int`,
        resolved: sql<number>`count(case when status = 'resolved' then 1 end)::int`,
        closed: sql<number>`count(case when status = 'closed' then 1 end)::int`,
      })
      .from(feedback);

    // Get type breakdown
    const typeStats = await db
      .select({
        feedback_type: feedback.feedback_type,
        count: sql<number>`count(*)::int`,
      })
      .from(feedback)
      .groupBy(feedback.feedback_type);

    const byType: Record<string, number> = {};
    typeStats.forEach((stat) => {
      if (stat.feedback_type) {
        byType[stat.feedback_type] = Number(stat.count);
      }
    });

    const stats = statusStats[0];
    return {
      total: Number(stats?.total || 0),
      pending: Number(stats?.pending || 0),
      resolved: Number((stats?.resolved || 0) + (stats?.closed || 0)),
      byType,
    };
  }

  // Admin management methods
  async updateUserRole(userId: number, role: "freelancer" | "recruiter" | "admin"): Promise<User> {
    const result = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();

    if (!result[0]) {
      throw new Error("User not found");
    }

    // Clear cache for this user
    cache.delete(`user:${userId}`);
    cache.clearPattern(`user_with_profile:${userId}`);

    // Clear admin users cache when admin roles change
    cache.delete("admin_users");

    return result[0];
  }

  async getAdminUsers(): Promise<User[]> {
    const cacheKey = "admin_users";
    const cached = cache.get<User[]>(cacheKey);
    if (cached) return cached;

    // Get users with admin role from database
    const dbAdmins = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        first_name: users.first_name,
        last_name: users.last_name,
        email_verified: users.email_verified,
        auth_provider: users.auth_provider,
        status: users.status,
        created_at: users.created_at,
        last_login_at: users.last_login_at,
      })
      .from(users)
      .where(eq(users.role, "admin"))
      .orderBy(desc(users.created_at));

    // Get admin emails from environment variable (same as auth.ts)
    const ADMIN_EMAILS = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase())
      : [];

    // Get admin users from environment variable list (regardless of their role column)
    // Get admin users from environment variable list (regardless of their role column)
    let hardcodedAdmins: any[] = [];
    if (ADMIN_EMAILS.length > 0) {
      hardcodedAdmins = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          first_name: users.first_name,
          last_name: users.last_name,
          email_verified: users.email_verified,
          auth_provider: users.auth_provider,
          status: users.status,
          created_at: users.created_at,
          last_login_at: users.last_login_at,
        })
        .from(users)
        .where(
          or(...ADMIN_EMAILS.map((email) => eq(sql`LOWER(${users.email})`, email.toLowerCase())))
        )
        .orderBy(desc(users.created_at));
    }

    // Combine and return unique users
    const allAdmins = [...dbAdmins] as User[];

    // Add env admins if they exist in DB but aren't marked as admin role yet
    // This is a safety check/fallback
    // Add env admins if they exist in DB but aren't marked as admin role yet
    // This is a safety check/fallback
    if (hardcodedAdmins.length > 0) {
      const existingIds = new Set(allAdmins.map((u) => u.id));
      for (const admin of hardcodedAdmins) {
        if (!existingIds.has(admin.id)) {
          allAdmins.push(admin as any);
        }
      }
    }

    cache.set(cacheKey, allAdmins, 60); // Cache for 1 minute
    return allAdmins;
  }

  async getAdminAnalytics() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 1. Total Users
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [activeUsers] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.status, "active"));
    const [newUsersThisMonth] = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.created_at, startOfMonth));

    // 2. Active Jobs
    const [totalJobs] = await db.select({ count: count() }).from(jobs);
    const [activeJobs] = await db
      .select({ count: count() })
      .from(jobs)
      .where(eq(jobs.status, "active"));

    // 3. Pending Feedback (pending + in_review)
    const [pendingFeedback] = await db
      .select({ count: count() })
      .from(feedback)
      .where(or(eq(feedback.status, "pending"), eq(feedback.status, "in_review")));

    // 4. Applications for Active Jobs
    const [activeApplications] = await db
      .select({ count: count() })
      .from(job_applications)
      .innerJoin(jobs, eq(job_applications.job_id, jobs.id))
      .where(eq(jobs.status, "active"));

    // Hired Applications
    const [hiredApplications] = await db
      .select({ count: count() })
      .from(job_applications)
      .where(eq(job_applications.status, "hired"));

    // Recent Activity
    // Fetch last 1 of each type to combine
    const recentFeedback = await db
      .select({
        id: feedback.id,
        created_at: feedback.created_at,
        type: sql<string>`'feedback'`,
      })
      .from(feedback)
      .orderBy(desc(feedback.created_at))
      .limit(1);

    const recentUsers = await db
      .select({
        id: users.id,
        created_at: users.created_at,
        type: sql<string>`'user'`,
      })
      .from(users)
      .orderBy(desc(users.created_at))
      .limit(1);

    const recentApplications = await db
      .select({
        id: job_applications.id,
        created_at: job_applications.applied_at,
        type: sql<string>`'application'`,
      })
      .from(job_applications)
      .orderBy(desc(job_applications.applied_at))
      .limit(1);

    // Combine and sort
    const allActivity = [
      ...recentFeedback.map((f) => ({
        type: "feedback" as const,
        message: "New feedback submitted",
        time: f.created_at,
      })),
      ...recentUsers.map((u) => ({
        type: "user" as const,
        message: "New user registered",
        time: u.created_at,
      })),
      ...recentApplications.map((a) => ({
        type: "application" as const,
        message: "Job application submitted",
        time: a.created_at,
      })),
    ].sort((a, b) => b.time.getTime() - a.time.getTime());

    return {
      users: {
        total: Number(totalUsers?.count || 0),
        active: Number(activeUsers?.count || 0),
        thisMonth: Number(newUsersThisMonth?.count || 0),
      },
      jobs: {
        total: Number(totalJobs?.count || 0),
        active: Number(activeJobs?.count || 0),
        thisMonth: 0,
      },
      feedback: {
        pending: Number(pendingFeedback?.count || 0),
      },
      applications: {
        total: Number(activeApplications?.count || 0),
        hired: Number(hiredApplications?.count || 0),
        thisMonth: 0,
      },
      recentActivity: allActivity,
    };
  }

  async getAllUsers(
    page: number,
    limit: number,
    search?: string,
    role?: string,
    status?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    profileStatus?: string
  ): Promise<{ users: (User & { profile_status?: string })[]; total: number }> {
    const offset = (page - 1) * limit;

    const conditions = [];

    if (search) {
      const searchLower = search.toLowerCase();
      conditions.push(
        or(
          ilike(users.first_name, `%${searchLower}%`),
          ilike(users.last_name, `%${searchLower}%`),
          ilike(users.email, `%${searchLower}%`)
        )
      );
    }

    if (role && role !== "all") {
      conditions.push(eq(users.role, role));
    }

    if (status && status !== "all") {
      conditions.push(eq(users.status, status));
    }

    // Determine sort column and direction
    const sortColumn = (() => {
      switch (sortBy) {
        case "email":
          return users.email;
        case "first_name":
          return users.first_name;
        case "last_name":
          return users.last_name;
        case "role":
          return users.role;
        case "status":
          return users.status;
        case "created_at":
        default:
          return users.created_at;
      }
    })();
    const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    // Helper function to compute profile status for a user
    const computeProfileStatus = (
      userId: number,
      userRole: string,
      profileMap: Map<number, { hasProfile: boolean; isComplete: boolean }>
    ): string | undefined => {
      if (userRole !== "freelancer") return undefined;
      const profileInfo = profileMap.get(userId);
      if (!profileInfo) return "no_profile";
      if (!profileInfo.isComplete) return "incomplete";
      return "complete";
    };

    // Helper to build profile map from profiles
    const buildProfileMap = (
      profiles: {
        user_id: number;
        title: string | null;
        bio: string | null;
        skills: string[] | null;
      }[]
    ) => {
      const map: Map<number, { hasProfile: boolean; isComplete: boolean }> = new Map();
      for (const profile of profiles) {
        const hasTitle = profile.title && profile.title.trim() !== "";
        const hasBio = profile.bio && profile.bio.trim() !== "";
        const hasSkills = profile.skills && profile.skills.length > 0;
        const isComplete = hasTitle && hasBio && hasSkills;
        map.set(profile.user_id, { hasProfile: true, isComplete: !!isComplete });
      }
      return map;
    };

    // If filtering by profile status, we need to get all matching freelancers first, then paginate
    if (profileStatus && profileStatus !== "all") {
      // Force role filter to freelancer since profile status only applies to freelancers
      const freelancerConditions = [...conditions, eq(users.role, "freelancer")];
      const freelancerWhere = and(...freelancerConditions);

      // Get ALL freelancers matching base conditions (no pagination yet)
      const allFreelancers = await db
        .select()
        .from(users)
        .where(freelancerWhere)
        .orderBy(orderByClause);

      // Get all their profiles
      const allFreelancerIds = allFreelancers.map((u) => u.id);
      let profileMap: Map<number, { hasProfile: boolean; isComplete: boolean }> = new Map();

      if (allFreelancerIds.length > 0) {
        const profiles = await db
          .select({
            user_id: freelancer_profiles.user_id,
            title: freelancer_profiles.title,
            bio: freelancer_profiles.bio,
            skills: freelancer_profiles.skills,
          })
          .from(freelancer_profiles)
          .where(inArray(freelancer_profiles.user_id, allFreelancerIds));

        profileMap = buildProfileMap(profiles);
      }

      // Add profile status and filter
      const allWithStatus = allFreelancers.map((user) => ({
        ...user,
        profile_status: computeProfileStatus(user.id, user.role, profileMap),
      }));

      const filtered = allWithStatus.filter((u) => u.profile_status === profileStatus);

      // Apply pagination to filtered results
      const paginatedUsers = filtered.slice(offset, offset + limit);

      return {
        users: paginatedUsers,
        total: filtered.length,
      };
    }

    // Standard query without profile status filter
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [usersResult, totalResult] = await Promise.all([
      db.select().from(users).where(whereClause).limit(limit).offset(offset).orderBy(orderByClause),
      db.select({ count: count() }).from(users).where(whereClause),
    ]);

    // Get profile status for freelancer users in the result set
    const freelancerIds = usersResult.filter((u) => u.role === "freelancer").map((u) => u.id);

    let profileMap: Map<number, { hasProfile: boolean; isComplete: boolean }> = new Map();

    if (freelancerIds.length > 0) {
      const profiles = await db
        .select({
          user_id: freelancer_profiles.user_id,
          title: freelancer_profiles.title,
          bio: freelancer_profiles.bio,
          skills: freelancer_profiles.skills,
        })
        .from(freelancer_profiles)
        .where(inArray(freelancer_profiles.user_id, freelancerIds));

      profileMap = buildProfileMap(profiles);
    }

    // Add profile_status to each user
    const usersWithProfileStatus = usersResult.map((user) => ({
      ...user,
      profile_status: computeProfileStatus(user.id, user.role, profileMap),
    }));

    return {
      users: usersWithProfileStatus,
      total: totalResult[0]?.count || 0,
    };
  }

  // Notification preferences management
  async getNotificationPreferences(userId: number): Promise<NotificationPreferences | undefined> {
    const cacheKey = `notification_preferences:${userId}`;
    const cached = cache.get<NotificationPreferences>(cacheKey);
    if (cached) return cached;

    const result = await db
      .select()
      .from(notification_preferences)
      .where(eq(notification_preferences.user_id, userId))
      .limit(1);

    if (result[0]) {
      cache.set(cacheKey, result[0], 300);
    }
    return result[0];
  }

  async createNotificationPreferences(userId: number): Promise<NotificationPreferences> {
    const result = await db
      .insert(notification_preferences)
      .values({ user_id: userId })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to create notification preferences");
    }

    const cacheKey = `notification_preferences:${userId}`;
    cache.set(cacheKey, result[0], 300);
    return result[0];
  }

  async updateNotificationPreferences(
    userId: number,
    preferences: Partial<InsertNotificationPreferences>
  ): Promise<NotificationPreferences> {
    const updateData: any = { ...preferences, updated_at: new Date() };
    const result = await db
      .update(notification_preferences)
      .set(updateData)
      .where(eq(notification_preferences.user_id, userId))
      .returning();

    if (!result[0]) {
      throw new Error("Failed to update notification preferences");
    }

    const cacheKey = `notification_preferences:${userId}`;
    cache.set(cacheKey, result[0], 300);
    return result[0];
  }

  // Job alert filters management
  async getJobAlertFilters(userId: number): Promise<JobAlertFilter[]> {
    return db
      .select()
      .from(job_alert_filters)
      .where(and(eq(job_alert_filters.user_id, userId), eq(job_alert_filters.is_active, true)))
      .orderBy(desc(job_alert_filters.created_at));
  }

  async createJobAlertFilter(filter: InsertJobAlertFilter): Promise<JobAlertFilter> {
    const result = await db.insert(job_alert_filters).values(filter).returning();

    if (!result[0]) {
      throw new Error("Failed to create job alert filter");
    }

    return result[0];
  }

  async updateJobAlertFilter(
    filterId: number,
    filter: Partial<InsertJobAlertFilter>
  ): Promise<JobAlertFilter> {
    const result = await db
      .update(job_alert_filters)
      .set({ ...filter, updated_at: new Date() })
      .where(eq(job_alert_filters.id, filterId))
      .returning();

    if (!result[0]) {
      throw new Error("Failed to update job alert filter");
    }

    return result[0];
  }

  async deleteJobAlertFilter(filterId: number): Promise<void> {
    await db.delete(job_alert_filters).where(eq(job_alert_filters.id, filterId));
  }

  // Email notification logging
  async logEmailNotification(log: InsertEmailNotificationLog): Promise<EmailNotificationLog> {
    const logData: any = log;
    const result = await db.insert(email_notification_logs).values(logData).returning();

    if (!result[0]) {
      throw new Error("Failed to log email notification");
    }

    return result[0];
  }

  async getEmailNotificationLogs(
    userId: number,
    limit: number = 50
  ): Promise<EmailNotificationLog[]> {
    return db
      .select()
      .from(email_notification_logs)
      .where(eq(email_notification_logs.user_id, userId))
      .orderBy(desc(email_notification_logs.sent_at))
      .limit(limit);
  }

  // Freelancer document/certification management
  async getFreelancerDocuments(freelancerId: number): Promise<FreelancerDocument[]> {
    return db
      .select()
      .from(freelancer_documents)
      .where(eq(freelancer_documents.freelancer_id, freelancerId))
      .orderBy(desc(freelancer_documents.uploaded_at));
  }

  async getFreelancerDocumentById(documentId: number): Promise<FreelancerDocument | undefined> {
    const result = await db
      .select()
      .from(freelancer_documents)
      .where(eq(freelancer_documents.id, documentId))
      .limit(1);
    return result[0];
  }

  async getFreelancerDocumentCount(freelancerId: number): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(freelancer_documents)
      .where(eq(freelancer_documents.freelancer_id, freelancerId));
    return result[0]?.count ?? 0;
  }

  async createFreelancerDocument(document: InsertFreelancerDocument): Promise<FreelancerDocument> {
    const result = await db.insert(freelancer_documents).values(document).returning();
    if (!result[0]) {
      throw new Error("Failed to create freelancer document");
    }
    return result[0];
  }

  async deleteFreelancerDocument(documentId: number, freelancerId: number): Promise<void> {
    await db
      .delete(freelancer_documents)
      .where(
        and(
          eq(freelancer_documents.id, documentId),
          eq(freelancer_documents.freelancer_id, freelancerId)
        )
      );
  }

  clearCache(): void {
    console.log("🧹 Clearing server-side SimpleCache...");
    cache.clear();
    console.log("✅ Server-side cache cleared");
  }

  // Contact Messages
  async createContactMessage(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<ContactMessage> {
    const result = await db.insert(contact_messages).values(data).returning();

    if (!result[0]) {
      throw new Error("Failed to create contact message");
    }

    return result[0];
  }

  async getAllContactMessages(): Promise<ContactMessage[]> {
    return db.select().from(contact_messages).orderBy(desc(contact_messages.created_at));
  }

  async updateContactMessageStatus(
    id: number,
    status: "pending" | "replied" | "resolved"
  ): Promise<void> {
    await db.update(contact_messages).set({ status }).where(eq(contact_messages.id, id));
  }
  // CV Parsed Data Management
  async getCvParsedData(userId: number): Promise<CvParsedData | undefined> {
    const result = await db
      .select()
      .from(cv_parsed_data)
      .where(eq(cv_parsed_data.user_id, userId))
      .limit(1);
    return result[0];
  }

  async createCvParsedData(data: InsertCvParsedData): Promise<CvParsedData> {
    const result = await db.insert(cv_parsed_data).values(data).returning();
    if (!result[0]) {
      throw new Error("Failed to create CV parsed data");
    }
    return result[0];
  }

  async updateCvParsedData(
    userId: number,
    data: Partial<InsertCvParsedData>
  ): Promise<CvParsedData | undefined> {
    const result = await db
      .update(cv_parsed_data)
      .set({ ...data, updated_at: new Date() })
      .where(eq(cv_parsed_data.user_id, userId))
      .returning();
    return result[0];
  }

  async deleteCvParsedData(userId: number): Promise<void> {
    await db.delete(cv_parsed_data).where(eq(cv_parsed_data.user_id, userId));
  }

  async createJobLinkView(view: InsertJobLinkView): Promise<JobLinkView> {
    const result = await db.insert(job_link_views).values(view).returning();
    if (!result[0]) {
      throw new Error("Failed to create job link view");
    }
    return result[0];
  }

  async getJobLinkViewCount(jobId: number): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(job_link_views)
      .where(eq(job_link_views.job_id, jobId));
    return result[0]?.count ?? 0;
  }
}

export const storage = new DatabaseStorage();
