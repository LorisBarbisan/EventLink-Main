import { pgTable, text, serial, integer, boolean, decimal, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"), // Made nullable for social auth users
  role: text("role").notNull().$type<'freelancer' | 'recruiter' | 'admin'>(),
  first_name: text("first_name"),
  last_name: text("last_name"),
  email_verified: boolean("email_verified").default(false).notNull(),
  email_verification_token: text("email_verification_token"),
  email_verification_expires: timestamp("email_verification_expires"),
  password_reset_token: text("password_reset_token"),
  password_reset_expires: timestamp("password_reset_expires"),
  // Social auth fields
  auth_provider: text("auth_provider").default('email').$type<'email' | 'google' | 'facebook' | 'linkedin'>(),
  google_id: text("google_id"),
  facebook_id: text("facebook_id"),
  linkedin_id: text("linkedin_id"),
  profile_photo_url: text("profile_photo_url"), // For social auth profile photos
  last_login_method: text("last_login_method").$type<'email' | 'google' | 'facebook' | 'linkedin'>(),
  last_login_at: timestamp("last_login_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const freelancer_profiles = pgTable("freelancer_profiles", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  first_name: text("first_name"),
  last_name: text("last_name"),
  title: text("title"),
  bio: text("bio"),
  location: text("location"),
  hourly_rate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  rate_type: text("rate_type").default('hourly').$type<'hourly' | 'daily'>(),
  experience_years: integer("experience_years"),
  skills: text("skills").array(),
  portfolio_url: text("portfolio_url"),
  linkedin_url: text("linkedin_url"),
  website_url: text("website_url"),
  availability_status: text("availability_status").default('available').$type<'available' | 'busy' | 'unavailable'>(),
  profile_photo_url: text("profile_photo_url"),
  cv_file_url: text("cv_file_url"),
  cv_file_name: text("cv_file_name"),
  cv_file_type: text("cv_file_type"),
  cv_file_size: integer("cv_file_size"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const recruiter_profiles = pgTable("recruiter_profiles", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  company_name: text("company_name").notNull(),
  contact_name: text("contact_name"),
  company_type: text("company_type"),
  location: text("location"),
  description: text("description"),
  website_url: text("website_url"),
  linkedin_url: text("linkedin_url"),
  company_logo_url: text("company_logo_url"), // No character limit for base64 image data
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  recruiter_id: integer("recruiter_id").references(() => users.id, { onDelete: "cascade" }), // Made nullable for external jobs
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  type: text("type").notNull().$type<'full-time' | 'part-time' | 'contract' | 'temporary' | 'freelance' | 'external'>(),
  rate: text("rate").notNull(),
  description: text("description").notNull(),
  event_date: text("event_date").notNull(), // Date when the event/job takes place
  status: text("status").default('active').$type<'active' | 'paused' | 'closed'>(),
  external_id: text("external_id"), // For external job IDs (reed_123, adzuna_456)
  external_source: text("external_source").$type<'reed' | 'adzuna' | null>(), // Source of external job
  external_url: text("external_url"), // URL to original job posting
  posted_date: text("posted_date"), // Original posting date from external source
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const job_applications = pgTable("job_applications", {
  id: serial("id").primaryKey(),
  job_id: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  freelancer_id: integer("freelancer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default('applied').$type<'applied' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired'>(),
  cover_letter: text("cover_letter"),
  rejection_message: text("rejection_message"), // Message explaining rejection
  applied_at: timestamp("applied_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  participant_one_id: integer("participant_one_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  participant_two_id: integer("participant_two_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  last_message_at: timestamp("last_message_at").defaultNow().notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversation_id: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  sender_id: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  is_read: boolean("is_read").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().$type<'application_update' | 'new_message' | 'job_update' | 'profile_view' | 'rating_received' | 'rating_request' | 'system'>(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  is_read: boolean("is_read").default(false).notNull(),
  priority: text("priority").default('normal').$type<'low' | 'normal' | 'high' | 'urgent'>(),
  related_entity_type: text("related_entity_type").$type<'job' | 'application' | 'message' | 'profile' | 'rating' | null>(),
  related_entity_id: integer("related_entity_id"),
  action_url: text("action_url"), // URL to navigate to when clicked
  metadata: text("metadata"), // JSON string for additional data
  expires_at: timestamp("expires_at"), // Optional expiration for temporary notifications
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  job_application_id: integer("job_application_id").notNull().references(() => job_applications.id, { onDelete: "cascade" }),
  recruiter_id: integer("recruiter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  freelancer_id: integer("freelancer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull().$type<1 | 2 | 3 | 4 | 5>(), // 1-5 stars
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const rating_requests = pgTable("rating_requests", {
  id: serial("id").primaryKey(),
  job_application_id: integer("job_application_id").notNull().references(() => job_applications.id, { onDelete: "cascade" }),
  freelancer_id: integer("freelancer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recruiter_id: integer("recruiter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default('pending').$type<'pending' | 'completed' | 'declined'>(),
  requested_at: timestamp("requested_at").defaultNow().notNull(),
  responded_at: timestamp("responded_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Schema for email/password registration (password required)
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  role: true,
}).extend({
  password: z.string().min(1, "Password is required"),
});

// Schema for social auth registration  
export const insertSocialUserSchema = createInsertSchema(users).pick({
  email: true,
  role: true,
  first_name: true,
  last_name: true,
  auth_provider: true,
  google_id: true,
  facebook_id: true,
  apple_id: true,
  profile_photo_url: true,
}).extend({
  password: z.string().optional(),
});

export const insertFreelancerProfileSchema = createInsertSchema(freelancer_profiles).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  user_id: z.number(),
  hourly_rate: z.number().nullable().transform((val) => val ? val.toString() : null),
});

export const insertRecruiterProfileSchema = createInsertSchema(recruiter_profiles).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  user_id: z.number(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  recruiter_id: z.number(),
});

export const insertJobApplicationSchema = createInsertSchema(job_applications).omit({
  id: true,
  applied_at: true,
  updated_at: true,
}).extend({
  job_id: z.number(),
  freelancer_id: z.number(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  created_at: true,
  last_message_at: true,
}).extend({
  participant_one_id: z.number(),
  participant_two_id: z.number(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  created_at: true,
}).extend({
  conversation_id: z.number(),
  sender_id: z.number(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  created_at: true,
}).extend({
  user_id: z.number(),
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  job_application_id: z.number(),
  recruiter_id: z.number(),
  freelancer_id: z.number(),
  rating: z.number().min(1).max(5),
});

// Feedback table for admin dashboard
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id, { onDelete: "set null" }), // Nullable for guest users
  feedback_type: text("feedback_type").notNull().$type<'malfunction' | 'feature-missing' | 'suggestion' | 'other'>(),
  message: text("message").notNull(),
  page_url: text("page_url"),
  source: text("source").$type<'header' | 'popup'>(),
  user_email: text("user_email"), // Store email for guest users
  user_name: text("user_name"), // Store name for guest users or logged-in users
  status: text("status").default('pending').$type<'pending' | 'in_review' | 'resolved' | 'closed'>(),
  admin_response: text("admin_response"),
  admin_user_id: integer("admin_user_id").references(() => users.id, { onDelete: "set null" }),
  priority: text("priority").default('normal').$type<'low' | 'normal' | 'high' | 'urgent'>(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  resolved_at: timestamp("resolved_at"),
});

export const insertRatingRequestSchema = createInsertSchema(rating_requests).omit({
  id: true,
  requested_at: true,
  created_at: true,
  updated_at: true,
}).extend({
  job_application_id: z.number(),
  freelancer_id: z.number(),
  recruiter_id: z.number(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSocialUser = z.infer<typeof insertSocialUserSchema>;
export type User = typeof users.$inferSelect;
export type FreelancerProfile = typeof freelancer_profiles.$inferSelect;
export type RecruiterProfile = typeof recruiter_profiles.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type InsertFreelancerProfile = z.infer<typeof insertFreelancerProfileSchema>;
export type InsertRecruiterProfile = z.infer<typeof insertRecruiterProfileSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type JobApplication = typeof job_applications.$inferSelect;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type RatingRequest = typeof rating_requests.$inferSelect;
export type InsertRatingRequest = z.infer<typeof insertRatingRequestSchema>;

// Feedback schemas and types
export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  created_at: true,
  updated_at: true,
  resolved_at: true,
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
