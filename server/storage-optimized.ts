import {
  job_applications,
  jobs,
  messages,
  notifications,
  profiles,
  users,
  type InsertJob,
  type InsertJobApplication,
  type InsertMessage,
  type InsertNotification,
  type InsertProfile,
  type InsertUser,
  type Job,
  type JobApplication,
  type Message,
  type Notification,
  type Profile,
  type User,
} from "@shared/schema-optimized";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

// OPTIMIZED STORAGE: Simplified interface with essential operations only

export interface IOptimizedStorage {
  // User management - core authentication
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(
    user: InsertUser & { email_verification_token?: string; email_verification_expires?: Date }
  ): Promise<User>;
  deleteUserAccount(userId: number): Promise<void>;
  verifyEmail(token: string): Promise<boolean>;

  // Profile management - unified for freelancers and recruiters
  getProfile(userId: number): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: number, profile: Partial<InsertProfile>): Promise<Profile | undefined>;

  // Job management - simplified
  getAllJobs(): Promise<Job[]>;
  getJobsByRecruiterId(recruiterId: number): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(jobId: number, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(jobId: number): Promise<void>;

  // Application management
  createJobApplication(application: InsertJobApplication): Promise<JobApplication>;
  getApplicationsByFreelancer(freelancerId: number): Promise<JobApplication[]>;
  getApplicationsByJob(jobId: number): Promise<JobApplication[]>;
  updateApplicationStatus(applicationId: number, status: string): Promise<void>;

  // Messaging - simplified direct messaging
  sendMessage(message: InsertMessage): Promise<Message>;
  getMessagesBetweenUsers(user1: number, user2: number): Promise<Message[]>;
  markMessagesAsRead(fromUserId: number, toUserId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;

  // Notifications - simplified
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: number): Promise<Notification[]>;
  markNotificationAsRead(notificationId: number): Promise<void>;
  getUnreadNotificationCount(userId: number): Promise<number>;
}

export class OptimizedStorage implements IOptimizedStorage {
  // User management
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(
    user: InsertUser & { email_verification_token?: string; email_verification_expires?: Date }
  ): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async deleteUserAccount(userId: number): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async verifyEmail(token: string): Promise<boolean> {
    const user = await db.select().from(users).where(eq(users.email_verification_token, token));
    if (!user[0] || !user[0].email_verification_expires) return false;

    if (new Date() > user[0].email_verification_expires) return false;

    await db
      .update(users)
      .set({
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
      })
      .where(eq(users.id, user[0].id));

    return true;
  }

  // Profile management - unified
  async getProfile(userId: number): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.user_id, userId));
    return result[0];
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const result = await db.insert(profiles).values(profile).returning();
    return result[0];
  }

  async updateProfile(
    userId: number,
    profile: Partial<InsertProfile>
  ): Promise<Profile | undefined> {
    const result = await db
      .update(profiles)
      .set({ ...profile, updated_at: new Date() })
      .where(eq(profiles.user_id, userId))
      .returning();
    return result[0];
  }

  // Job management
  async getAllJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.created_at));
  }

  async getJobsByRecruiterId(recruiterId: number): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.recruiter_id, recruiterId));
  }

  async createJob(job: InsertJob): Promise<Job> {
    const result = await db.insert(jobs).values(job).returning();
    return result[0];
  }

  async updateJob(jobId: number, job: Partial<InsertJob>): Promise<Job | undefined> {
    const result = await db
      .update(jobs)
      .set({ ...job, updated_at: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();
    return result[0];
  }

  async deleteJob(jobId: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, jobId));
  }

  // Application management
  async createJobApplication(application: InsertJobApplication): Promise<JobApplication> {
    const result = await db.insert(job_applications).values(application).returning();
    return result[0];
  }

  async getApplicationsByFreelancer(freelancerId: number): Promise<JobApplication[]> {
    return await db
      .select()
      .from(job_applications)
      .where(eq(job_applications.freelancer_id, freelancerId))
      .orderBy(desc(job_applications.applied_at));
  }

  async getApplicationsByJob(jobId: number): Promise<JobApplication[]> {
    return await db
      .select()
      .from(job_applications)
      .where(eq(job_applications.job_id, jobId))
      .orderBy(desc(job_applications.applied_at));
  }

  async updateApplicationStatus(applicationId: number, status: string): Promise<void> {
    await db
      .update(job_applications)
      .set({ status: status as any, updated_at: new Date() })
      .where(eq(job_applications.id, applicationId));
  }

  // Messaging - simplified
  async sendMessage(message: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(message).returning();
    console.log("message send result========>", result);
    return result[0];
  }

  async getMessagesBetweenUsers(user1: number, user2: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(
        or(
          and(eq(messages.from_user_id, user1), eq(messages.to_user_id, user2)),
          and(eq(messages.from_user_id, user2), eq(messages.to_user_id, user1))
        )
      )
      .orderBy(messages.created_at);
  }

  async markMessagesAsRead(fromUserId: number, toUserId: number): Promise<void> {
    await db
      .update(messages)
      .set({ is_read: true })
      .where(
        and(
          eq(messages.from_user_id, fromUserId),
          eq(messages.to_user_id, toUserId),
          eq(messages.is_read, false)
        )
      );
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.to_user_id, userId), eq(messages.is_read, false)));
    return Number(result[0]?.count || 0);
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async getUserNotifications(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, userId))
      .orderBy(desc(notifications.created_at))
      .limit(50);
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ is_read: true })
      .where(eq(notifications.id, notificationId));
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
    return Number(result[0]?.count || 0);
  }
}

export const optimizedStorage = new OptimizedStorage();
