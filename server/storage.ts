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
  type InsertMessage
} from "@shared/schema";
import { eq, desc, isNull, and, or, sql } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  
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
  updateApplicationStatus(applicationId: number, status: 'applied' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired'): Promise<JobApplication>;
  
  // Messaging management
  getOrCreateConversation(userOneId: number, userTwoId: number): Promise<Conversation>;
  getConversationsByUserId(userId: number): Promise<Array<Conversation & { otherUser: User }>>;
  sendMessage(message: InsertMessage): Promise<Message>;
  getConversationMessages(conversationId: number): Promise<Array<Message & { sender: User }>>;
  markMessagesAsRead(conversationId: number, userId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const userData = {
      email: user.email,
      password: user.password,
      role: user.role as 'freelancer' | 'recruiter'
    };
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users)
      .set({ 
        password: hashedPassword,
        updated_at: new Date()
      })
      .where(eq(users.id, userId));
  }

  async getFreelancerProfile(userId: number): Promise<FreelancerProfile | undefined> {
    const result = await db.select().from(freelancer_profiles).where(eq(freelancer_profiles.user_id, userId)).limit(1);
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
    
    const result = await db.update(freelancer_profiles)
      .set(updateData)
      .where(eq(freelancer_profiles.user_id, userId))
      .returning();
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
}

export const storage = new DatabaseStorage();
