import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  users, 
  freelancer_profiles, 
  recruiter_profiles,
  jobs,
  type User, 
  type InsertUser,
  type FreelancerProfile,
  type RecruiterProfile,
  type InsertFreelancerProfile,
  type InsertRecruiterProfile,
  type Job,
  type InsertJob
} from "@shared/schema";
import { eq } from "drizzle-orm";

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
  
  // Get all freelancer profiles for listings
  getAllFreelancerProfiles(): Promise<FreelancerProfile[]>;
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
    const result = await db.select().from(recruiter_profiles).where(eq(recruiter_profiles.user_id, userId)).limit(1);
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

  async getJobsByRecruiterId(recruiterId: number): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.recruiter_id, recruiterId));
  }

  async createJob(job: InsertJob): Promise<Job> {
    const result = await db.insert(jobs).values([job]).returning();
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
}

export const storage = new DatabaseStorage();
