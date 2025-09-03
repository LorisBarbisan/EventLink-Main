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
  notifications,
  ratings,
  rating_requests,
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
  type InsertConversation,
  type InsertMessage,
  type Notification,
  type InsertNotification,
  type Rating,
  type InsertRating,
  type RatingRequest,
  type InsertRatingRequest
} from "@shared/schema";
import { eq, desc, isNull, and, or, sql } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, {
  max: 20,          // Maximum connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false,   // Disable prepared statements to reduce memory usage
  transform: {
    undefined: null // Transform undefined to null for better SQL compatibility
  },
  debug: process.env.NODE_ENV === 'development' ? false : false, // Disable debug in production
  onnotice: process.env.NODE_ENV === 'development' ? console.log : () => {} // Log notices only in dev
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
  
  // Email verification methods
  verifyEmail(token: string): Promise<boolean>;
  updateUserVerificationToken(userId: number, token: string | null, expires: Date | null): Promise<void>;
  
  // Social auth methods
  getUserBySocialProvider(provider: 'google' | 'facebook' | 'apple', providerId: string): Promise<User | undefined>;
  createSocialUser(user: any): Promise<User>;
  linkSocialProvider(userId: number, provider: 'google' | 'facebook' | 'apple', providerId: string, profilePhotoUrl?: string): Promise<void>;
  updateUserLastLogin(userId: number, method: 'email' | 'google' | 'facebook' | 'apple'): Promise<void>;
  
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
  
  // Job application management
  createJobApplication(application: InsertJobApplication): Promise<JobApplication>;
  getFreelancerApplications(freelancerId: number): Promise<JobApplication[]>;
  getJobApplications(jobId: number): Promise<JobApplication[]>;
  getJobApplicationById(applicationId: number): Promise<JobApplication | undefined>;
  updateApplicationStatus(applicationId: number, status: 'applied' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired', rejectionMessage?: string): Promise<JobApplication>;
  
  // Messaging management
  getOrCreateConversation(userOneId: number, userTwoId: number): Promise<Conversation>;
  getConversationsByUserId(userId: number): Promise<Array<Conversation & { otherUser: User }>>;
  sendMessage(message: InsertMessage): Promise<Message>;
  getConversationMessages(conversationId: number): Promise<Array<Message & { sender: User }>>;
  markMessagesAsRead(conversationId: number, userId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  
  // Notification management
  createNotification(notification: InsertNotification): Promise<Notification>;
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
    const cached = cache.get(cacheKey);
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
    const cacheKey = `user:email:${email}`;
    const cached = cache.get<User>(cacheKey);
    if (cached) return cached;

    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
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
  async getUserBySocialProvider(provider: 'google' | 'facebook' | 'apple' | 'linkedin', providerId: string): Promise<User | undefined> {
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
      case 'apple':
        condition = eq(users.apple_id, providerId);
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
    auth_provider: 'google' | 'facebook' | 'apple' | 'linkedin';
    google_id?: string;
    facebook_id?: string;
    apple_id?: string;
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
      apple_id: userData.apple_id,
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

  async linkSocialProvider(userId: number, provider: 'google' | 'facebook' | 'apple' | 'linkedin', providerId: string, profilePhotoUrl?: string): Promise<void> {
    const updateData: any = { updated_at: new Date() };
    
    switch (provider) {
      case 'google':
        updateData.google_id = providerId;
        break;
      case 'facebook':
        updateData.facebook_id = providerId;
        break;
      case 'apple':
        updateData.apple_id = providerId;
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

  async updateUserLastLogin(userId: number, method: 'email' | 'google' | 'facebook' | 'apple' | 'linkedin'): Promise<void> {
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

  async updateUserAccount(userId: number, accountData: { first_name?: string; last_name?: string }): Promise<void> {
    await db.update(users)
      .set({ 
        ...accountData,
        updated_at: new Date()
      })
      .where(eq(users.id, userId));
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
      hourly_rate: profile.hourly_rate,
      rate_type: profile.rate_type as 'hourly' | 'daily',
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
    const updateData: any = { updated_at: new Date() };
    
    // Only include defined fields
    if (profile.first_name !== undefined) updateData.first_name = profile.first_name;
    if (profile.last_name !== undefined) updateData.last_name = profile.last_name;
    if (profile.title !== undefined) updateData.title = profile.title;
    if (profile.bio !== undefined) updateData.bio = profile.bio;
    if (profile.location !== undefined) updateData.location = profile.location;
    if (profile.hourly_rate !== undefined) updateData.hourly_rate = profile.hourly_rate;
    if (profile.rate_type !== undefined) updateData.rate_type = profile.rate_type;
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
        hourly_rate: updateData.hourly_rate || null,
        rate_type: updateData.rate_type || 'hourly',
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
    return await db.select().from(freelancer_profiles);
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
    return await db.select().from(job_applications).where(eq(job_applications.freelancer_id, freelancerId));
  }

  async getJobApplications(jobId: number): Promise<JobApplication[]> {
    return await db.select().from(job_applications).where(eq(job_applications.job_id, jobId));
  }

  async getJobApplicationsByFreelancer(freelancerId: number): Promise<JobApplication[]> {
    return await db.select().from(job_applications).where(eq(job_applications.freelancer_id, freelancerId));
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
      otherUserRole: users.role
    })
    .from(conversations)
    .leftJoin(
      users,
      sql`${users.id} = CASE 
        WHEN ${conversations.participant_one_id} = ${userId} THEN ${conversations.participant_two_id}
        ELSE ${conversations.participant_one_id}
      END`
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
        role: (row.otherUserRole as 'freelancer' | 'recruiter') || 'freelancer',
        password: '',
        first_name: null,
        last_name: null,
        email_verified: false,
        email_verification_token: null,
        email_verification_expires: null,
        password_reset_token: null,
        password_reset_expires: null,
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

  async getConversationMessages(conversationId: number): Promise<Array<Message & { sender: User }>> {
    const result = await db.select({
      id: messages.id,
      conversation_id: messages.conversation_id,
      sender_id: messages.sender_id,
      content: messages.content,
      is_read: messages.is_read,
      created_at: messages.created_at,
      senderEmail: users.email,
      senderRole: users.role
    })
    .from(messages)
    .leftJoin(users, eq(messages.sender_id, users.id))
    .where(eq(messages.conversation_id, conversationId))
    .orderBy(messages.created_at);

    return result.map(row => ({
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      content: row.content,
      is_read: row.is_read,
      created_at: row.created_at,
      sender: {
        id: row.sender_id,
        email: row.senderEmail || '',
        role: (row.senderRole as 'freelancer' | 'recruiter') || 'freelancer',
        password: '',
        first_name: null,
        last_name: null,
        email_verified: false,
        email_verification_token: null,
        email_verification_expires: null,
        password_reset_token: null,
        password_reset_expires: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    }));
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
      // Start a transaction to ensure all deletions succeed or all fail
      await db.transaction(async (tx) => {
        // 1. Delete all conversations where user is a participant
        // This will cascade delete all messages in those conversations
        await tx.delete(conversations)
          .where(
            or(
              eq(conversations.participant_one_id, userId),
              eq(conversations.participant_two_id, userId)
            )
          );

        // 2. Delete all job applications by this user
        await tx.delete(job_applications)
          .where(eq(job_applications.freelancer_id, userId));

        // 3. Delete all jobs posted by this user (if recruiter)
        // This will cascade delete all job applications for those jobs
        await tx.delete(jobs)
          .where(eq(jobs.recruiter_id, userId));

        // 4. Delete all notifications for this user
        await tx.delete(notifications)
          .where(eq(notifications.user_id, userId));

        // 5. Delete user profiles (freelancer or recruiter)
        // These should cascade delete due to foreign key constraints
        await tx.delete(freelancer_profiles)
          .where(eq(freelancer_profiles.user_id, userId));
        
        await tx.delete(recruiter_profiles)
          .where(eq(recruiter_profiles.user_id, userId));

        // 6. Finally, delete the user record
        // This ensures referential integrity is maintained
        await tx.delete(users)
          .where(eq(users.id, userId));
      });

      console.log(`Successfully deleted all data for user ID: ${userId}`);
    } catch (error) {
      console.error('Error during account deletion:', error);
      throw new Error('Failed to delete user account. Please try again.');
    }
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
}

export const storage = new DatabaseStorage();
