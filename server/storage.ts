import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  users, 
  freelancer_profiles, 
  recruiter_profiles,
  jobs,
  job_applications,
  conversations,
  messages,
  message_user_states,
  message_attachments,
  notifications,
  ratings,
  rating_requests,
  feedback,
  type User, 
  type InsertUser,
  type FreelancerProfile,
  type RecruiterProfile,
  type InsertFreelancerProfile,
  type InsertRecruiterProfile,
  type Job,
  type InsertJob,
  type JobApplication,
  type InsertJobApplication,
  type Conversation,
  type Message,
  type MessageUserState,
  type MessageAttachment,
  type InsertConversation,
  type InsertMessage,
  type InsertMessageUserState,
  type InsertMessageAttachment,
  type Notification,
  type InsertNotification,
  type Rating,
  type InsertRating,
  type RatingRequest,
  type InsertRatingRequest,
  type Feedback,
  type InsertFeedback
} from "@shared/schema";
import { eq, desc, isNull, and, or, sql, inArray } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, {
  max: 20,          // Maximum connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 5, // Reduced connection timeout for faster failure detection
  prepare: false,   // Disable prepared statements to reduce memory usage
  transform: {
    undefined: null // Transform undefined to null for better SQL compatibility
  },
  debug: process.env.NODE_ENV === 'development' ? false : false, // Disable debug in production
  onnotice: process.env.NODE_ENV === 'development' ? console.log : () => {}, // Log notices only in dev
  // Add connection retry logic for better reliability
  connection: {
    options: `--application_name=eventlink-${process.env.NODE_ENV || 'development'}`,
  }
});
const db = drizzle(client);

// Simple in-memory cache for frequently accessed data
class SimpleCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  
  set(key: string, data: any, ttlSeconds: number = 300) {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expiry });
  }
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }
  
  delete(key: string) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  // Clear cache entries that start with a pattern
  clearPattern(pattern: string) {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

const cache = new SimpleCache();

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { email_verification_token?: string; email_verification_expires?: Date }): Promise<User>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  updateUserAccount(userId: number, accountData: { first_name?: string; last_name?: string }): Promise<void>;
  deleteUserAccount(userId: number): Promise<void>;
  isUserDeleted(userId: number): Promise<boolean>;
  canSendMessageToUser(senderId: number, recipientId: number): Promise<{ canSend: boolean; error?: string }>;
  
  // Email verification methods
  verifyEmail(token: string): Promise<boolean>;
  updateUserVerificationToken(userId: number, token: string | null, expires: Date | null): Promise<void>;
  
  // Social auth methods
  getUserBySocialProvider(provider: 'google' | 'facebook' | 'linkedin', providerId: string): Promise<User | undefined>;
  createSocialUser(user: any): Promise<User>;
  linkSocialProvider(userId: number, provider: 'google' | 'facebook' | 'linkedin', providerId: string, profilePhotoUrl?: string): Promise<void>;
  updateUserLastLogin(userId: number, method: 'email' | 'google' | 'facebook' | 'linkedin'): Promise<void>;
  
  // Freelancer profile management
  getFreelancerProfile(userId: number): Promise<FreelancerProfile | undefined>;
  createFreelancerProfile(profile: InsertFreelancerProfile): Promise<FreelancerProfile>;
  updateFreelancerProfile(userId: number, profile: Partial<InsertFreelancerProfile>): Promise<FreelancerProfile | undefined>;
  
  // Recruiter profile management
  getRecruiterProfile(userId: number): Promise<RecruiterProfile | undefined>;
  createRecruiterProfile(profile: InsertRecruiterProfile): Promise<RecruiterProfile>;
  updateRecruiterProfile(userId: number, profile: Partial<InsertRecruiterProfile>): Promise<RecruiterProfile | undefined>;
  
  // Job management
  getAllJobs(): Promise<Job[]>;
  getJobsByRecruiterId(recruiterId: number): Promise<Job[]>;
  getJobById(jobId: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(jobId: number, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(jobId: number): Promise<void>;
  
  // External job management
  getJobByExternalId(externalId: string): Promise<Job | undefined>;
  createExternalJob(job: any): Promise<Job>;
  getExternalJobs(): Promise<Job[]>;
  getAllJobsSortedByDate(): Promise<Job[]>;
  
  // Get all freelancer profiles for listings
  getAllFreelancerProfiles(): Promise<FreelancerProfile[]>;
  getAllRecruiterProfiles(): Promise<RecruiterProfile[]>;
  
  // Job application management
  createJobApplication(application: InsertJobApplication): Promise<JobApplication>;
  getFreelancerApplications(freelancerId: number): Promise<JobApplication[]>;
  getJobApplications(jobId: number): Promise<JobApplication[]>;
  getJobApplicationById(applicationId: number): Promise<JobApplication | undefined>;
  updateApplicationStatus(applicationId: number, status: 'applied' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired', rejectionMessage?: string): Promise<JobApplication>;
  // Soft delete methods for applications
  softDeleteApplication(applicationId: number, userRole: 'freelancer' | 'recruiter'): Promise<void>;
  getRecruiterApplications(recruiterId: number): Promise<JobApplication[]>;
  
  // Messaging management
  getOrCreateConversation(userOneId: number, userTwoId: number): Promise<Conversation>;
  getConversationsByUserId(userId: number): Promise<Array<Conversation & { otherUser: User }>>;
  sendMessage(message: InsertMessage): Promise<Message>;
  getConversationMessages(conversationId: number): Promise<Array<Message & { sender: User, attachments?: MessageAttachment[] }>>;
  getConversationMessagesForUser(conversationId: number, userId: number): Promise<Array<Message & { sender: User, attachments?: MessageAttachment[] }>>;
  markMessagesAsRead(conversationId: number, userId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  // Soft delete methods for messages
  markMessageDeletedForUser(messageId: number, userId: number): Promise<void>;
  deleteConversation(conversationId: number): Promise<void>;
  
  // Message attachment management
  createMessageAttachment(attachment: InsertMessageAttachment): Promise<MessageAttachment>;
  getMessageAttachments(messageId: number): Promise<MessageAttachment[]>;
  getAttachmentById(attachmentId: number): Promise<MessageAttachment | undefined>;
  getMessageById(messageId: number): Promise<Message | undefined>;
  getMessageAttachmentById(attachmentId: number): Promise<MessageAttachment | undefined>;
  createFileReport(report: { attachment_id: number, reporter_id: number, report_reason: string, report_details: string | null }): Promise<any>;
  
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
  getRatingByJobApplication(jobApplicationId: number): Promise<Rating | undefined>;
  getFreelancerRatings(freelancerId: number): Promise<Array<Rating & { recruiter: User; job_title?: string }>>;
  getFreelancerAverageRating(freelancerId: number): Promise<{ average: number; count: number }>;
  canRecruiterRateFreelancer(recruiterId: number, freelancerId: number, jobApplicationId: number): Promise<boolean>;

  // Rating request management
  createRatingRequest(request: InsertRatingRequest): Promise<RatingRequest>;
  getRatingRequestByJobApplication(jobApplicationId: number): Promise<RatingRequest | undefined>;
  getRecruiterRatingRequests(recruiterId: number): Promise<Array<RatingRequest & { freelancer: User; job_title?: string }>>;
  getFreelancerRatingRequests(freelancerId: number): Promise<Array<RatingRequest & { recruiter: User; job_title?: string }>>;
  updateRatingRequestStatus(requestId: number, status: 'completed' | 'declined'): Promise<RatingRequest>;

  // Feedback management for admin dashboard
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Array<Feedback & { user?: User }>>;
  getFeedbackById(id: number): Promise<Feedback | undefined>;
  updateFeedbackStatus(id: number, status: 'pending' | 'in_review' | 'resolved' | 'closed', adminUserId?: number): Promise<Feedback>;
  addAdminResponse(id: number, response: string, adminUserId: number): Promise<Feedback>;
  getFeedbackByStatus(status: 'pending' | 'in_review' | 'resolved' | 'closed'): Promise<Array<Feedback & { user?: User }>>;
  getFeedbackStats(): Promise<{ total: number; pending: number; resolved: number; byType: Record<string, number> }>;
  
  // Admin management
  updateUserRole(userId: number, role: 'freelancer' | 'recruiter' | 'admin'): Promise<User>;
  getAdminUsers(): Promise<User[]>;
  
  // Category-specific notification counts
  getCategoryUnreadCounts(userId: number): Promise<{
    messages: number;
    applications: number;
    jobs: number;
    ratings: number;
    total: number;
  }>;
  
  // Mark category-specific notifications as read
  markCategoryNotificationsAsRead(userId: number, category: 'messages' | 'applications' | 'jobs' | 'ratings'): Promise<void>;
  
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
  async getUserWithProfile(id: number): Promise<(User & { profile?: FreelancerProfile | RecruiterProfile }) | undefined> {
    const cacheKey = `user_with_profile:${id}`;
    const cached = cache.get<User & { profile?: FreelancerProfile | RecruiterProfile }>(cacheKey);
    if (cached) return cached;

    const user = await this.getUser(id);
    if (!user) return undefined;

    let profile: FreelancerProfile | RecruiterProfile | undefined;
    if (user.role === 'freelancer') {
      profile = await this.getFreelancerProfile(id);
    } else if (user.role === 'recruiter') {
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
    const result = await db.select().from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);
    if (result[0]) {
      cache.set(cacheKey, result[0], 300); // Cache for 5 minutes
      // Also cache by ID for consistency
      cache.set(`user:${result[0].id}`, result[0], 300);
    }
    return result[0];
  }

  async createUser(user: InsertUser & { email_verification_token?: string; email_verification_expires?: Date }): Promise<User> {
    const userData = {
      email: user.email,
      password: user.password,
      role: user.role as 'freelancer' | 'recruiter',
      email_verified: false,
      email_verification_token: user.email_verification_token,
      email_verification_expires: user.email_verification_expires
    };
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }

  async verifyEmail(token: string): Promise<boolean> {
    try {
      const result = await db.select().from(users)
        .where(eq(users.email_verification_token, token))
        .limit(1);
      
      if (!result[0]) return false;
      
      const user = result[0];
      
      // Check if token has expired
      if (user.email_verification_expires && new Date() > user.email_verification_expires) {
        return false;
      }
      
      // Update user as verified and clear verification token
      await db.update(users)
        .set({
          email_verified: true,
          email_verification_token: null,
          email_verification_expires: null,
          updated_at: new Date()
        })
        .where(eq(users.id, user.id));
      
      return true;
    } catch (error) {
      console.error('Error verifying email:', error);
      return false;
    }
  }

  async updateUserVerificationToken(userId: number, token: string | null, expires: Date | null): Promise<void> {
    await db.update(users)
      .set({
        email_verification_token: token,
        email_verification_expires: expires,
        updated_at: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Social auth methods
  async getUserBySocialProvider(provider: 'google' | 'facebook' | 'linkedin', providerId: string): Promise<User | undefined> {
    const cacheKey = `user:${provider}:${providerId}`;
    const cached = cache.get<User>(cacheKey);
    if (cached) return cached;

    let condition;
    switch (provider) {
      case 'google':
        condition = eq(users.google_id, providerId);
        break;
      case 'facebook':
        condition = eq(users.facebook_id, providerId);
        break;
      case 'linkedin':
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
    auth_provider: 'google' | 'facebook' | 'linkedin';
    google_id?: string;
    facebook_id?: string;
    linkedin_id?: string;
    profile_photo_url?: string;
    email_verified: boolean;
    role: 'freelancer' | 'recruiter';
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
      last_login_at: new Date()
    };

    const result = await db.insert(users).values(user).returning();
    
    // Clear cache since we added a new user
    cache.clearPattern('user:');
    
    return result[0];
  }

  async linkSocialProvider(userId: number, provider: 'google' | 'facebook' | 'linkedin', providerId: string, profilePhotoUrl?: string): Promise<void> {
    const updateData: any = { updated_at: new Date() };
    
    switch (provider) {
      case 'google':
        updateData.google_id = providerId;
        break;
      case 'facebook':
        updateData.facebook_id = providerId;
        break;
      case 'linkedin':
        updateData.linkedin_id = providerId;
        break;
    }

    if (profilePhotoUrl) {
      updateData.profile_photo_url = profilePhotoUrl;
    }

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    // Clear cache for this user
    cache.clearPattern(`user:${userId}`);
    cache.clearPattern(`user:${provider}:`);
  }

  async updateUserLastLogin(userId: number, method: 'email' | 'google' | 'facebook' | 'linkedin'): Promise<void> {
    await db.update(users)
      .set({
        last_login_method: method,
        last_login_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(users.id, userId));

    // Clear cache for this user
    cache.clearPattern(`user:${userId}`);
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users)
      .set({ 
        password: hashedPassword,
        updated_at: new Date()
      })
      .where(eq(users.id, userId));
  }

  async setPasswordResetToken(email: string, token: string, expires: Date): Promise<boolean> {
    try {
      const result = await db.update(users)
        .set({
          password_reset_token: token,
          password_reset_expires: expires,
          updated_at: new Date()
        })
        .where(eq(users.email, email));
      return true;
    } catch (error) {
      console.error('Error setting password reset token:', error);
      return false;
    }
  }

  async validatePasswordResetToken(token: string): Promise<{ isValid: boolean; userId?: number }> {
    try {
      const result = await db.select().from(users)
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
      console.error('Error validating password reset token:', error);
      return { isValid: false };
    }
  }

  async resetPassword(userId: number, hashedPassword: string): Promise<boolean> {
    try {
      await db.update(users)
        .set({
          password: hashedPassword,
          password_reset_token: null,
          password_reset_expires: null,
          updated_at: new Date()
        })
        .where(eq(users.id, userId));
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      return false;
    }
  }

  async updateUserAccount(userId: number, accountData: { first_name?: string; last_name?: string; role?: 'freelancer' | 'recruiter' | 'admin' }): Promise<void> {
    await db.update(users)
      .set({ 
        ...accountData,
        updated_at: new Date()
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

    const result = await db.select().from(freelancer_profiles).where(eq(freelancer_profiles.user_id, userId)).limit(1);
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
      bio: profile.bio,
      location: profile.location,
      experience_years: profile.experience_years,
      skills: profile.skills,
      portfolio_url: profile.portfolio_url,
      linkedin_url: profile.linkedin_url,
      website_url: profile.website_url,
      availability_status: profile.availability_status as 'available' | 'busy' | 'unavailable',
      profile_photo_url: profile.profile_photo_url
    };
    const result = await db.insert(freelancer_profiles).values([profileData]).returning();
    return result[0];
  }

  async updateFreelancerProfile(userId: number, profile: Partial<InsertFreelancerProfile>): Promise<FreelancerProfile | undefined> {
    // Clear cache BEFORE update to prevent any race conditions
    const cacheKey = `freelancer_profile:${userId}`;
    cache.delete(cacheKey);
    
    const updateData: any = { updated_at: new Date() };
    
    // Only include defined fields
    if (profile.first_name !== undefined) updateData.first_name = profile.first_name;
    if (profile.last_name !== undefined) updateData.last_name = profile.last_name;
    if (profile.title !== undefined) updateData.title = profile.title;
    if (profile.bio !== undefined) updateData.bio = profile.bio;
    if (profile.location !== undefined) updateData.location = profile.location;
    if (profile.experience_years !== undefined) updateData.experience_years = profile.experience_years;
    if (profile.skills !== undefined) updateData.skills = profile.skills;
    if (profile.portfolio_url !== undefined) updateData.portfolio_url = profile.portfolio_url;
    if (profile.linkedin_url !== undefined) updateData.linkedin_url = profile.linkedin_url;
    if (profile.website_url !== undefined) updateData.website_url = profile.website_url;
    if (profile.availability_status !== undefined) updateData.availability_status = profile.availability_status as 'available' | 'busy' | 'unavailable';
    if (profile.profile_photo_url !== undefined) {
      console.log('Updating profile_photo_url:', profile.profile_photo_url ? profile.profile_photo_url.substring(0, 50) + '...' : 'null');
      updateData.profile_photo_url = profile.profile_photo_url;
    }
    
    // CV fields
    if (profile.cv_file_url !== undefined) updateData.cv_file_url = profile.cv_file_url;
    if (profile.cv_file_name !== undefined) updateData.cv_file_name = profile.cv_file_name;
    if (profile.cv_file_type !== undefined) updateData.cv_file_type = profile.cv_file_type;
    if (profile.cv_file_size !== undefined) updateData.cv_file_size = profile.cv_file_size;
    
    const result = await db.update(freelancer_profiles)
      .set(updateData)
      .where(eq(freelancer_profiles.user_id, userId))
      .returning();
    
    // If no existing profile found, create one
    if (result.length === 0) {
      const newProfile = {
        user_id: userId,
        first_name: updateData.first_name || '',
        last_name: updateData.last_name || '',
        title: updateData.title || '',
        bio: updateData.bio || '',
        location: updateData.location || '',
        experience_years: updateData.experience_years || null,
        skills: updateData.skills || [],
        portfolio_url: updateData.portfolio_url || '',
        linkedin_url: updateData.linkedin_url || '',
        website_url: updateData.website_url || '',
        availability_status: updateData.availability_status || 'available',
        profile_photo_url: updateData.profile_photo_url || '',
        cv_file_url: updateData.cv_file_url || null,
        cv_file_name: updateData.cv_file_name || null,
        cv_file_type: updateData.cv_file_type || null,
        cv_file_size: updateData.cv_file_size || null
      };
      const createResult = await db.insert(freelancer_profiles).values([newProfile]).returning();
      return createResult[0];
    }
    
    return result[0];
  }

  async getRecruiterProfile(userId: number): Promise<RecruiterProfile | undefined> {
    const result = await db.select().from(recruiter_profiles)
      .where(eq(recruiter_profiles.user_id, userId))
      .orderBy(desc(recruiter_profiles.id))
      .limit(1);
    return result[0];
  }

  async createRecruiterProfile(profile: InsertRecruiterProfile): Promise<RecruiterProfile> {
    const result = await db.insert(recruiter_profiles).values(profile).returning();
    return result[0];
  }

  async updateRecruiterProfile(userId: number, profile: Partial<InsertRecruiterProfile>): Promise<RecruiterProfile | undefined> {
    const updateData: any = { updated_at: new Date() };
    
    // Only include defined fields
    if (profile.company_name !== undefined) updateData.company_name = profile.company_name;
    if (profile.contact_name !== undefined) updateData.contact_name = profile.contact_name;
    if (profile.company_type !== undefined) updateData.company_type = profile.company_type;
    if (profile.location !== undefined) updateData.location = profile.location;
    if (profile.description !== undefined) updateData.description = profile.description;
    if (profile.website_url !== undefined) updateData.website_url = profile.website_url;
    if (profile.linkedin_url !== undefined) updateData.linkedin_url = profile.linkedin_url;
    if (profile.company_logo_url !== undefined) updateData.company_logo_url = profile.company_logo_url;
    
    const result = await db.update(recruiter_profiles)
      .set(updateData)
      .where(eq(recruiter_profiles.user_id, userId))
      .returning();
    return result[0];
  }

  async getAllFreelancerProfiles(): Promise<FreelancerProfile[]> {
    // CRITICAL: Triple-check to ensure NO deleted user data appears anywhere
    // Join with users table to filter out deleted users with multiple safety checks
    const result = await db.select({
      id: freelancer_profiles.id,
      user_id: freelancer_profiles.user_id,
      first_name: freelancer_profiles.first_name,
      last_name: freelancer_profiles.last_name,
      title: freelancer_profiles.title,
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
      updated_at: freelancer_profiles.updated_at
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
    const safeResult = result.filter(profile => {
      return profile.first_name && profile.last_name && 
             !profile.first_name.toLowerCase().includes('deleted') &&
             !profile.last_name.toLowerCase().includes('deleted');
    });

    return safeResult;
  }

  async getAllRecruiterProfiles(): Promise<RecruiterProfile[]> {
    // Join with users table to filter out deleted users
    const result = await db.select({
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
      updated_at: recruiter_profiles.updated_at
    })
    .from(recruiter_profiles)
    .innerJoin(users, eq(recruiter_profiles.user_id, users.id))
    .where(isNull(users.deleted_at)); // Only non-deleted users

    return result;
  }

  // Job management methods
  async getAllJobs(): Promise<Job[]> {
    return await db.select().from(jobs);
  }

  async getAllJobsSortedByDate(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.created_at));
  }

  async getJobsByRecruiterId(recruiterId: number): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.recruiter_id, recruiterId));
  }

  async getJobById(jobId: number): Promise<Job | undefined> {
    const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    return result[0];
  }

  async createJob(job: InsertJob): Promise<Job> {
    const result = await db.insert(jobs).values([job as any]).returning();
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
    
    const result = await db.update(jobs)
      .set(updateData)
      .where(eq(jobs.id, jobId))
      .returning();
    return result[0];
  }

  async deleteJob(jobId: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, jobId));
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
    return await db.select().from(jobs).where(
      and(
        isNull(jobs.recruiter_id), 
        eq(jobs.type, 'external')
      )
    ); // External jobs have recruiter_id = null and type = 'external'
  }

  // Job application methods
  async createJobApplication(application: InsertJobApplication): Promise<JobApplication> {
    const result = await db.insert(job_applications).values([application as any]).returning();
    return result[0];
  }

  async getFreelancerApplications(freelancerId: number): Promise<JobApplication[]> {
    const result = await db.select({
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
    })
    .from(job_applications)
    .innerJoin(jobs, eq(jobs.id, job_applications.job_id))
    .where(
      and(
        eq(job_applications.freelancer_id, freelancerId),
        eq(job_applications.freelancer_deleted, false)
      )
    );
    return result as JobApplication[];
  }

  async getJobApplications(jobId: number): Promise<JobApplication[]> {
    const result = await db.select({
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
    })
    .from(job_applications)
    .innerJoin(jobs, eq(jobs.id, job_applications.job_id))
    .where(
      and(
        eq(job_applications.job_id, jobId),
        eq(job_applications.recruiter_deleted, false)
      )
    );
    return result as JobApplication[];
  }

  async getJobApplicationsByFreelancer(freelancerId: number): Promise<JobApplication[]> {
    return await db.select().from(job_applications).where(
      and(
        eq(job_applications.freelancer_id, freelancerId),
        eq(job_applications.freelancer_deleted, false)
      )
    );
  }

  // Soft delete methods for applications
  async softDeleteApplication(applicationId: number, userRole: 'freelancer' | 'recruiter'): Promise<void> {
    const fieldToUpdate = userRole === 'freelancer' ? 'freelancer_deleted' : 'recruiter_deleted';
    await db.update(job_applications)
      .set({ [fieldToUpdate]: true, updated_at: new Date() })
      .where(eq(job_applications.id, applicationId));
  }

  async getRecruiterApplications(recruiterId: number): Promise<JobApplication[]> {
    const result = await db.select({
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
      freelancer_profile: {
        id: freelancer_profiles.id,
        user_id: freelancer_profiles.user_id,
        first_name: freelancer_profiles.first_name,
        last_name: freelancer_profiles.last_name,
        title: freelancer_profiles.title,
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
    })
    .from(job_applications)
    .innerJoin(jobs, eq(jobs.id, job_applications.job_id))
    .leftJoin(freelancer_profiles, eq(freelancer_profiles.user_id, job_applications.freelancer_id))
    .where(
      and(
        eq(jobs.recruiter_id, recruiterId),
        eq(job_applications.recruiter_deleted, false)
      )
    );
    return result as JobApplication[];
  }

  async getJobApplicationById(applicationId: number): Promise<JobApplication | undefined> {
    const result = await db.select().from(job_applications).where(eq(job_applications.id, applicationId)).limit(1);
    return result[0];
  }

  async updateApplicationStatus(applicationId: number, status: 'applied' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired', rejectionMessage?: string): Promise<JobApplication> {
    const updateData: any = { 
      status: status,
      updated_at: sql`now()`
    };
    
    if (status === 'rejected' && rejectionMessage) {
      updateData.rejection_message = rejectionMessage;
    }
    
    const result = await db.update(job_applications)
      .set(updateData)
      .where(eq(job_applications.id, applicationId))
      .returning();

    // If hiring a freelancer, close the job posting
    if (status === 'hired') {
      const application = result[0];
      if (application?.job_id) {
        await db.update(jobs)
          .set({ 
            status: 'closed',
            updated_at: sql`now()`
          })
          .where(eq(jobs.id, application.job_id));
      }
    }
    
    return result[0];
  }

  // Messaging methods
  async getOrCreateConversation(userOneId: number, userTwoId: number): Promise<Conversation> {
    // First try to find existing conversation
    const existing = await db.select().from(conversations)
      .where(
        or(
          and(eq(conversations.participant_one_id, userOneId), eq(conversations.participant_two_id, userTwoId)),
          and(eq(conversations.participant_one_id, userTwoId), eq(conversations.participant_two_id, userOneId))
        )
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    // Create new conversation
    const result = await db.insert(conversations).values({
      participant_one_id: userOneId,
      participant_two_id: userTwoId
    }).returning();
    return result[0];
  }

  async getConversationsByUserId(userId: number): Promise<Array<Conversation & { otherUser: User }>> {
    const result = await db.select({
      id: conversations.id,
      participant_one_id: conversations.participant_one_id,
      participant_two_id: conversations.participant_two_id,
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
      recruiterCompanyName: recruiter_profiles.company_name
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
      eq(freelancer_profiles.user_id, sql`CASE 
        WHEN ${conversations.participant_one_id} = ${userId} THEN ${conversations.participant_two_id}
        ELSE ${conversations.participant_one_id}
      END`)
    )
    .leftJoin(
      recruiter_profiles,
      eq(recruiter_profiles.user_id, sql`CASE 
        WHEN ${conversations.participant_one_id} = ${userId} THEN ${conversations.participant_two_id}
        ELSE ${conversations.participant_one_id}
      END`)
    )
    .where(
      or(
        eq(conversations.participant_one_id, userId),
        eq(conversations.participant_two_id, userId)
      )
    )
    .orderBy(desc(conversations.last_message_at));

    return result.map(row => ({
      id: row.id,
      participant_one_id: row.participant_one_id,
      participant_two_id: row.participant_two_id,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
      otherUser: {
        id: row.otherUserId,
        email: row.otherUserEmail || '',
        role: (row.otherUserRole as 'freelancer' | 'recruiter' | 'admin') || 'freelancer',
        password: '',
        first_name: row.freelancerFirstName,
        last_name: row.freelancerLastName,
        company_name: row.recruiterCompanyName,
        email_verified: false,
        email_verification_token: null,
        email_verification_expires: null,
        password_reset_token: null,
        password_reset_expires: null,
        auth_provider: 'email' as const,
        google_id: null,
        facebook_id: null,
        linkedin_id: null,
        profile_photo_url: null,
        last_login_method: null,
        last_login_at: null,
        deleted_at: row.otherUserDeleted,
        created_at: new Date(),
        updated_at: new Date()
      }
    }));
  }

  async sendMessage(message: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(message).returning();
    
    // Update conversation last_message_at
    await db.update(conversations)
      .set({ last_message_at: new Date() })
      .where(eq(conversations.id, message.conversation_id));

    return result[0];
  }

  async getConversationMessages(conversationId: number): Promise<Array<Message & { sender: User, attachments?: MessageAttachment[] }>> {
    const result = await db.select({
      id: messages.id,
      conversation_id: messages.conversation_id,
      sender_id: messages.sender_id,
      content: messages.content,
      is_read: messages.is_read,
      is_system_message: messages.is_system_message,
      created_at: messages.created_at,
      senderEmail: users.email,
      senderRole: users.role
    })
    .from(messages)
    .leftJoin(users, eq(messages.sender_id, users.id))
    .where(eq(messages.conversation_id, conversationId))
    .orderBy(messages.created_at);

    // Return all messages for admin view
    return result.map(row => ({
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      content: row.content,
      is_read: row.is_read,
      is_system_message: row.is_system_message,
      created_at: row.created_at,
      sender: {
        id: row.sender_id || 0, // Use 0 for system messages with null sender_id
        email: row.senderEmail || '',
        role: row.senderRole || 'freelancer',
        password: '',
        first_name: null,
        last_name: null,
        email_verified: false,
        email_verification_token: null,
        email_verification_expires: null,
        password_reset_token: null,
        password_reset_expires: null,
        auth_provider: 'email',
        google_id: null,
        facebook_id: null,
        linkedin_id: null,
        profile_photo_url: null,
        last_login_method: null,
        last_login_at: null,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    }));
  }


  async getConversationMessagesForUser(conversationId: number, userId: number): Promise<Array<Message & { sender: User, attachments?: MessageAttachment[] }>> {
    const result = await db.select({
      id: messages.id,
      conversation_id: messages.conversation_id,
      sender_id: messages.sender_id,
      content: messages.content,
      is_read: messages.is_read,
      is_system_message: messages.is_system_message,
      created_at: messages.created_at,
      senderEmail: users.email,
      senderRole: users.role
    })
    .from(messages)
    .leftJoin(users, eq(messages.sender_id, users.id))
    .leftJoin(message_user_states, and(
      eq(message_user_states.message_id, messages.id),
      eq(message_user_states.user_id, userId)
    ))
    .where(and(
      eq(messages.conversation_id, conversationId),
      isNull(message_user_states.id) // Exclude messages deleted by this user
    ))
    .orderBy(messages.created_at);

    return result.map(row => ({
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      content: row.content,
      is_read: row.is_read,
      is_system_message: row.is_system_message,
      created_at: row.created_at,
      sender: {
        id: row.sender_id || 0, // Use 0 for system messages with null sender_id
        email: row.senderEmail || '',
        role: (row.senderRole as 'freelancer' | 'recruiter' | 'admin') || 'freelancer',
        password: '',
        first_name: null,
        last_name: null,
        email_verified: false,
        email_verification_token: null,
        email_verification_expires: null,
        password_reset_token: null,
        password_reset_expires: null,
        auth_provider: 'email' as const,
        google_id: null,
        facebook_id: null,
        linkedin_id: null,
        profile_photo_url: null,
        last_login_method: null,
        last_login_at: null,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    }));
  }

  // Soft delete methods for messages
  async markMessageDeletedForUser(messageId: number, userId: number): Promise<void> {
    await db.insert(message_user_states).values({
      message_id: messageId,
      user_id: userId
    });
  }

  async deleteConversation(conversationId: number): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, conversationId));
  }

  async markMessagesAsRead(conversationId: number, userId: number): Promise<void> {
    await db.update(messages)
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
      scan_status: attachment.scan_status as 'pending' | 'safe' | 'unsafe' | 'error' | null,
      moderation_status: attachment.moderation_status as 'pending' | 'approved' | 'rejected' | 'error' | null
    };
    const result = await db.insert(message_attachments).values([attachmentData]).returning();
    return result[0];
  }

  async getMessageAttachments(messageId: number): Promise<MessageAttachment[]> {
    const result = await db.select()
      .from(message_attachments)
      .where(eq(message_attachments.message_id, messageId))
      .orderBy(message_attachments.created_at);
    return result;
  }

  async getAttachmentById(attachmentId: number): Promise<MessageAttachment | undefined> {
    const result = await db.select()
      .from(message_attachments)
      .where(eq(message_attachments.id, attachmentId))
      .limit(1);
    return result[0];
  }

  async getMessageById(messageId: number): Promise<Message | undefined> {
    const result = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    return result[0];
  }

  async getMessageAttachmentById(attachmentId: number): Promise<MessageAttachment | undefined> {
    return this.getAttachmentById(attachmentId);
  }

  async createFileReport(report: { attachment_id: number, reporter_id: number, report_reason: string, report_details: string | null }): Promise<any> {
    // For now, just log the report - in production would save to a reports table
    console.log('File report received:', report);
    return { 
      id: Date.now(), 
      ...report,
      created_at: new Date(),
      status: 'pending'
    };
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const userConversations = await db.select({ id: conversations.id })
      .from(conversations)
      .where(
        or(
          eq(conversations.participant_one_id, userId),
          eq(conversations.participant_two_id, userId)
        )
      );

    if (userConversations.length === 0) return 0;

    const conversationIds = userConversations.map(c => c.id);
    
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          sql`${messages.conversation_id} IN (${conversationIds.join(',')})`,
          eq(messages.is_read, false),
          sql`${messages.sender_id} != ${userId}`
        )
      );

    return Number(result[0]?.count || 0);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values([{
      ...notification,
      type: notification.type as "application_update" | "new_message" | "job_update" | "profile_view" | "system",
      priority: notification.priority as "low" | "normal" | "high" | "urgent" | null | undefined
    }]).returning();
    return result[0];
  }

  async getNotification(notificationId: number): Promise<Notification | undefined> {
    const result = await db.select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);
    return result[0];
  }

  async getUserNotifications(userId: number, limit: number = 50): Promise<Notification[]> {
    const result = await db.select()
      .from(notifications)
      .where(and(
        eq(notifications.user_id, userId),
        or(
          isNull(notifications.expires_at),
          sql`${notifications.expires_at} > NOW()`
        )
      ))
      .orderBy(desc(notifications.created_at))
      .limit(limit);
    return result;
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.user_id, userId),
        eq(notifications.is_read, false),
        or(
          isNull(notifications.expires_at),
          sql`${notifications.expires_at} > NOW()`
        )
      ));
    return Number(result[0]?.count || 0);
  }

  async getCategoryUnreadCounts(userId: number): Promise<{
    messages: number;
    applications: number;
    jobs: number;
    ratings: number;
    total: number;
  }> {
    // Get counts for each category
    const [messagesResult, applicationsResult, jobsResult, ratingsResult] = await Promise.all([
      // Messages count
      db.select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(
          eq(notifications.user_id, userId),
          eq(notifications.is_read, false),
          eq(notifications.type, 'new_message'),
          or(
            isNull(notifications.expires_at),
            sql`${notifications.expires_at} > NOW()`
          )
        )),
      
      // Applications count
      db.select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(
          eq(notifications.user_id, userId),
          eq(notifications.is_read, false),
          eq(notifications.type, 'application_update'),
          or(
            isNull(notifications.expires_at),
            sql`${notifications.expires_at} > NOW()`
          )
        )),
      
      // Jobs count
      db.select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(
          eq(notifications.user_id, userId),
          eq(notifications.is_read, false),
          eq(notifications.type, 'job_update'),
          or(
            isNull(notifications.expires_at),
            sql`${notifications.expires_at} > NOW()`
          )
        )),
      
      // Ratings count (rating_received + rating_request)
      db.select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(
          eq(notifications.user_id, userId),
          eq(notifications.is_read, false),
          or(
            eq(notifications.type, 'rating_received'),
            eq(notifications.type, 'rating_request')
          ),
          or(
            isNull(notifications.expires_at),
            sql`${notifications.expires_at} > NOW()`
          )
        ))
    ]);

    const messages = Number(messagesResult[0]?.count || 0);
    const applications = Number(applicationsResult[0]?.count || 0);
    const jobs = Number(jobsResult[0]?.count || 0);
    const ratings = Number(ratingsResult[0]?.count || 0);
    const total = messages + applications + jobs + ratings;

    return {
      messages,
      applications,
      jobs,
      ratings,
      total
    };
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    await db.update(notifications)
      .set({ is_read: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db.update(notifications)
      .set({ is_read: true })
      .where(and(
        eq(notifications.user_id, userId),
        eq(notifications.is_read, false)
      ));
  }

  async markCategoryNotificationsAsRead(userId: number, category: 'messages' | 'applications' | 'jobs' | 'ratings'): Promise<void> {
    let notificationTypes: string[] = [];
    
    switch (category) {
      case 'messages':
        notificationTypes = ['new_message'];
        break;
      case 'applications':
        notificationTypes = ['application_update'];
        break;
      case 'jobs':
        notificationTypes = ['job_update'];
        break;
      case 'ratings':
        notificationTypes = ['rating_received', 'rating_request'];
        break;
    }

    if (notificationTypes.length === 0) return;

    await db.update(notifications)
      .set({ is_read: true })
      .where(and(
        eq(notifications.user_id, userId),
        eq(notifications.is_read, false),
        or(
          ...notificationTypes.map(type => eq(notifications.type, type as any))
        )
      ));
  }

  async deleteNotification(notificationId: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, notificationId));
  }

  async deleteExpiredNotifications(): Promise<void> {
    await db.delete(notifications)
      .where(
        and(
          sql`${notifications.expires_at} IS NOT NULL`,
          sql`${notifications.expires_at} < NOW()`
        )
      );
  }

  async deleteUserAccount(userId: number): Promise<void> {
    try {
      // Start a transaction to ensure all operations succeed or all fail
      await db.transaction(async (tx) => {
        // 1. Get user info before soft deletion
        const user = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user.length) {
          throw new Error('User not found');
        }

        // 2. Get all conversations where this user is a participant
        const userConversations = await tx.select().from(conversations)
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
            is_system_message: true
          });

          // Update conversation's last_message_at timestamp
          await tx.update(conversations)
            .set({ last_message_at: new Date() })
            .where(eq(conversations.id, conversation.id));
        }

        // 4. Soft delete user profiles (keep data but mark as deleted)
        await tx.delete(freelancer_profiles)
          .where(eq(freelancer_profiles.user_id, userId));
        
        await tx.delete(recruiter_profiles)
          .where(eq(recruiter_profiles.user_id, userId));

        // 5. Delete job applications by this user (hard delete as these become invalid)
        await tx.delete(job_applications)
          .where(eq(job_applications.freelancer_id, userId));

        // 6. Delete jobs posted by this user (hard delete as these become invalid)
        await tx.delete(jobs)
          .where(eq(jobs.recruiter_id, userId));

        // 7. Delete notifications for this user (hard delete as they're no longer needed)
        await tx.delete(notifications)
          .where(eq(notifications.user_id, userId));

        // 8. Soft delete the user record (mark as deleted instead of removing)
        await tx.update(users)
          .set({ 
            deleted_at: new Date(),
            email: `deleted_${userId}_${user[0].email}` // Prevent email conflicts for new registrations
          })
          .where(eq(users.id, userId));

        // 9. Create system messages in all conversations where this user was a participant
        const allUserConversations = await tx.select()
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
            is_system_message: true
          });
        }
      });

      console.log(`Successfully soft-deleted user account for user ID: ${userId}`);
    } catch (error) {
      console.error('Error during account deletion:', error);
      throw new Error('Failed to delete user account. Please try again.');
    }
  }

  // User deletion helper methods
  async isUserDeleted(userId: number): Promise<boolean> {
    const user = await db.select({ deleted_at: users.deleted_at })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    return user.length > 0 && user[0].deleted_at !== null;
  }

  async canSendMessageToUser(senderId: number, recipientId: number): Promise<{ canSend: boolean; error?: string }> {
    // Check if recipient is deleted
    if (await this.isUserDeleted(recipientId)) {
      return { 
        canSend: false, 
        error: "This account has been deleted and can no longer receive messages." 
      };
    }

    // Check if sender is deleted (shouldn't happen if auth is working, but for safety)
    if (await this.isUserDeleted(senderId)) {
      return { 
        canSend: false, 
        error: "You cannot send messages from a deleted account." 
      };
    }

    return { canSend: true };
  }

  // Rating management methods
  async createRating(rating: InsertRating): Promise<Rating> {
    const result = await db.insert(ratings).values([rating as any]).returning();
    return result[0];
  }

  async getRatingByJobApplication(jobApplicationId: number): Promise<Rating | undefined> {
    const result = await db.select().from(ratings).where(eq(ratings.job_application_id, jobApplicationId)).limit(1);
    return result[0];
  }

  async getFreelancerRatings(freelancerId: number): Promise<Array<Rating & { recruiter: User; job_title?: string }>> {
    const result = await db.select({
      id: ratings.id,
      job_application_id: ratings.job_application_id,
      recruiter_id: ratings.recruiter_id,
      freelancer_id: ratings.freelancer_id,
      rating: ratings.rating,
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
        password: users.password
      },
      job_title: jobs.title
    })
    .from(ratings)
    .leftJoin(users, eq(ratings.recruiter_id, users.id))
    .leftJoin(job_applications, eq(ratings.job_application_id, job_applications.id))
    .leftJoin(jobs, eq(job_applications.job_id, jobs.id))
    .where(eq(ratings.freelancer_id, freelancerId))
    .orderBy(desc(ratings.created_at));

    return result as Array<Rating & { recruiter: User; job_title?: string }>;
  }

  async getFreelancerAverageRating(freelancerId: number): Promise<{ average: number; count: number }> {
    const result = await db.select({
      average: sql<number>`ROUND(AVG(${ratings.rating}), 1)`,
      count: sql<number>`count(*)::int`
    })
    .from(ratings)
    .where(eq(ratings.freelancer_id, freelancerId));

    return {
      average: Number(result[0]?.average || 0),
      count: Number(result[0]?.count || 0)
    };
  }

  async canRecruiterRateFreelancer(recruiterId: number, freelancerId: number, jobApplicationId: number): Promise<boolean> {
    // Check if this is a valid hired job application
    const application = await db.select()
      .from(job_applications)
      .leftJoin(jobs, eq(job_applications.job_id, jobs.id))
      .where(and(
        eq(job_applications.id, jobApplicationId),
        eq(job_applications.freelancer_id, freelancerId),
        eq(job_applications.status, 'hired'),
        eq(jobs.recruiter_id, recruiterId)
      ))
      .limit(1);

    if (!application.length) return false;

    // Check if rating already exists
    const existingRating = await this.getRatingByJobApplication(jobApplicationId);
    return !existingRating;
  }

  // Rating request management methods
  async createRatingRequest(request: InsertRatingRequest): Promise<RatingRequest> {
    const result = await db.insert(rating_requests).values([request as any]).returning();
    return result[0];
  }

  async getRatingRequestByJobApplication(jobApplicationId: number): Promise<RatingRequest | undefined> {
    const result = await db.select().from(rating_requests).where(eq(rating_requests.job_application_id, jobApplicationId)).limit(1);
    return result[0];
  }

  async getRecruiterRatingRequests(recruiterId: number): Promise<Array<RatingRequest & { freelancer: User; job_title?: string }>> {
    const result = await db.select({
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
        password: users.password
      },
      job_title: jobs.title
    })
    .from(rating_requests)
    .leftJoin(users, eq(rating_requests.freelancer_id, users.id))
    .leftJoin(job_applications, eq(rating_requests.job_application_id, job_applications.id))
    .leftJoin(jobs, eq(job_applications.job_id, jobs.id))
    .where(eq(rating_requests.recruiter_id, recruiterId))
    .orderBy(desc(rating_requests.requested_at));

    return result as Array<RatingRequest & { freelancer: User; job_title?: string }>;
  }

  async getFreelancerRatingRequests(freelancerId: number): Promise<Array<RatingRequest & { recruiter: User; job_title?: string }>> {
    const result = await db.select({
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
        password: users.password
      },
      job_title: jobs.title
    })
    .from(rating_requests)
    .leftJoin(users, eq(rating_requests.recruiter_id, users.id))
    .leftJoin(job_applications, eq(rating_requests.job_application_id, job_applications.id))
    .leftJoin(jobs, eq(job_applications.job_id, jobs.id))
    .where(eq(rating_requests.freelancer_id, freelancerId))
    .orderBy(desc(rating_requests.requested_at));

    return result as Array<RatingRequest & { recruiter: User; job_title?: string }>;
  }

  async updateRatingRequestStatus(requestId: number, status: 'completed' | 'declined'): Promise<RatingRequest> {
    const result = await db.update(rating_requests)
      .set({ 
        status: status,
        responded_at: new Date(),
        updated_at: sql`now()`
      })
      .where(eq(rating_requests.id, requestId))
      .returning();
    return result[0];
  }

  // Feedback management methods for admin dashboard
  async createFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const result = await db.insert(feedback).values([feedbackData as any]).returning();
    return result[0];
  }

  async getAllFeedback(): Promise<Array<Feedback & { user?: User }>> {
    const result = await db.select({
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
      }
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.user_id, users.id))
    .orderBy(desc(feedback.created_at));

    return result as Array<Feedback & { user?: User }>;
  }

  async getFeedbackById(id: number): Promise<Feedback | undefined> {
    const result = await db.select().from(feedback).where(eq(feedback.id, id)).limit(1);
    return result[0];
  }

  async updateFeedbackStatus(id: number, status: 'pending' | 'in_review' | 'resolved' | 'closed', adminUserId?: number): Promise<Feedback> {
    const updateData: any = {
      status: status,
      updated_at: sql`now()`,
    };

    if (adminUserId) {
      updateData.admin_user_id = adminUserId;
    }

    if (status === 'resolved' || status === 'closed') {
      updateData.resolved_at = new Date();
    }

    const result = await db.update(feedback)
      .set(updateData)
      .where(eq(feedback.id, id))
      .returning();
    return result[0];
  }

  async addAdminResponse(id: number, response: string, adminUserId: number): Promise<Feedback> {
    const result = await db.update(feedback)
      .set({ 
        admin_response: response,
        admin_user_id: adminUserId,
        status: 'in_review',
        updated_at: sql`now()`
      })
      .where(eq(feedback.id, id))
      .returning();
    return result[0];
  }

  async getFeedbackByStatus(status: 'pending' | 'in_review' | 'resolved' | 'closed'): Promise<Array<Feedback & { user?: User }>> {
    const result = await db.select({
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
      }
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.user_id, users.id))
    .where(eq(feedback.status, status))
    .orderBy(desc(feedback.created_at));

    return result as Array<Feedback & { user?: User }>;
  }

  async getFeedbackStats(): Promise<{ total: number; pending: number; resolved: number; byType: Record<string, number> }> {
    // Get total count and status counts
    const statusStats = await db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(case when status = 'pending' then 1 end)::int`,
      in_review: sql<number>`count(case when status = 'in_review' then 1 end)::int`,
      resolved: sql<number>`count(case when status = 'resolved' then 1 end)::int`,
      closed: sql<number>`count(case when status = 'closed' then 1 end)::int`,
    })
    .from(feedback);

    // Get type breakdown
    const typeStats = await db.select({
      feedback_type: feedback.feedback_type,
      count: sql<number>`count(*)::int`
    })
    .from(feedback)
    .groupBy(feedback.feedback_type);

    const byType: Record<string, number> = {};
    typeStats.forEach(stat => {
      if (stat.feedback_type) {
        byType[stat.feedback_type] = Number(stat.count);
      }
    });

    const stats = statusStats[0];
    return {
      total: Number(stats?.total || 0),
      pending: Number(stats?.pending || 0),
      resolved: Number((stats?.resolved || 0) + (stats?.closed || 0)),
      byType
    };
  }

  // Admin management methods
  async updateUserRole(userId: number, role: 'freelancer' | 'recruiter' | 'admin'): Promise<User> {
    const result = await db.update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) {
      throw new Error('User not found');
    }

    // Clear cache for this user
    cache.delete(`user:${userId}`);
    cache.clearPattern(`user_with_profile:${userId}`);
    
    // Clear admin users cache when admin roles change
    cache.delete('admin_users');

    return result[0];
  }

  async getAdminUsers(): Promise<User[]> {
    const cacheKey = 'admin_users';
    const cached = cache.get<User[]>(cacheKey);
    if (cached) return cached;

    // Get users with admin role from database
    const dbAdmins = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      first_name: users.first_name,
      last_name: users.last_name,
      email_verified: users.email_verified,
      auth_provider: users.auth_provider,
      created_at: users.created_at,
      last_login_at: users.last_login_at
    })
    .from(users)
    .where(eq(users.role, 'admin'))
    .orderBy(desc(users.created_at));

    // Get admin emails from environment variable (same as auth.ts)
    const ADMIN_EMAILS = process.env.ADMIN_EMAILS 
      ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase())
      : [];

    // Get admin users from environment variable list (regardless of their role column)
    const hardcodedAdmins = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      first_name: users.first_name,
      last_name: users.last_name,
      email_verified: users.email_verified,
      auth_provider: users.auth_provider,
      created_at: users.created_at,
      last_login_at: users.last_login_at
    })
    .from(users)
    .where(or(
      ...ADMIN_EMAILS.map(email => eq(sql`LOWER(${users.email})`, email.toLowerCase()))
    ))
    .orderBy(desc(users.created_at));

    // Combine and deduplicate admin users
    const allAdmins = [...dbAdmins, ...hardcodedAdmins];
    const uniqueAdmins = allAdmins.filter((admin, index, arr) => 
      arr.findIndex(a => a.id === admin.id) === index
    );

    // Apply computed role for hardcoded admins
    const adminUsers = uniqueAdmins.map(admin => ({
      ...admin,
      role: ADMIN_EMAILS.includes(admin.email.toLowerCase()) ? 'admin' as const : admin.role
    })) as User[];

    cache.set(cacheKey, adminUsers, 60); // Cache for 1 minute
    return adminUsers;
  }

  clearCache(): void {
    console.log('🧹 Clearing server-side SimpleCache...');
    cache.clear();
    console.log('✅ Server-side cache cleared');
  }
}

export const storage = new DatabaseStorage();
