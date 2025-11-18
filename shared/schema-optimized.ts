import { boolean, decimal, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// OPTIMIZED SCHEMA: Simplified for maximum efficiency

// Core users table - minimal essential fields only
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().$type<"freelancer" | "recruiter">(),
  email_verified: boolean("email_verified").default(false).notNull(),
  email_verification_token: text("email_verification_token"),
  email_verification_expires: timestamp("email_verification_expires", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Simplified profiles - merge freelancer/recruiter into single profiles table
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),

  // Universal fields (used by both freelancers and recruiters)
  first_name: text("first_name"),
  last_name: text("last_name"),
  location: text("location"),
  bio: text("bio"),
  website_url: text("website_url"),
  linkedin_url: text("linkedin_url"),
  profile_photo_url: text("profile_photo_url"),

  // Freelancer-specific fields (null for recruiters)
  title: text("title"), // Job title for freelancers
  hourly_rate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  rate_type: text("rate_type").default("hourly").$type<"hourly" | "daily">(),
  experience_years: integer("experience_years"),
  skills: text("skills").array(),
  portfolio_url: text("portfolio_url"),
  availability_status: text("availability_status")
    .default("available")
    .$type<"available" | "busy" | "unavailable">(),
  cv_file_url: text("cv_file_url"),

  // Recruiter-specific fields (null for freelancers)
  company_name: text("company_name"), // Company name for recruiters
  company_type: text("company_type"),
  company_description: text("company_description"), // Renamed from 'description' for clarity
  company_logo_url: text("company_logo_url"),

  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Simplified jobs table - removed external job complexity for now
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  recruiter_id: integer("recruiter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  type: text("type")
    .notNull()
    .$type<"full-time" | "part-time" | "contract" | "temporary" | "freelance">(),
  rate: text("rate").notNull(),
  description: text("description").notNull(),
  status: text("status").default("active").$type<"active" | "paused" | "closed">(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Simplified job applications
export const job_applications = pgTable("job_applications", {
  id: serial("id").primaryKey(),
  job_id: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  freelancer_id: integer("freelancer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status")
    .default("applied")
    .$type<"applied" | "reviewed" | "shortlisted" | "rejected" | "hired">(),
  cover_letter: text("cover_letter"),
  applied_at: timestamp("applied_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Simplified messaging - remove conversations complexity, direct user-to-user messaging
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  from_user_id: integer("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  to_user_id: integer("to_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  is_read: boolean("is_read").default(false).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Simplified notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().$type<"application" | "message" | "job" | "system">(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  is_read: boolean("is_read").default(false).notNull(),
  action_url: text("action_url"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Optimized insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  role: true,
});

export const insertProfileSchema = createInsertSchema(profiles)
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    user_id: z.number(),
    hourly_rate: z
      .number()
      .nullable()
      .transform(val => (val ? val.toString() : null)),
  });

export const insertJobSchema = createInsertSchema(jobs)
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    recruiter_id: z.number(),
  });

export const insertJobApplicationSchema = createInsertSchema(job_applications)
  .omit({
    id: true,
    applied_at: true,
    updated_at: true,
  })
  .extend({
    job_id: z.number(),
    freelancer_id: z.number(),
  });

export const insertMessageSchema = createInsertSchema(messages)
  .omit({
    id: true,
    created_at: true,
  })
  .extend({
    from_user_id: z.number(),
    to_user_id: z.number(),
  });

export const insertNotificationSchema = createInsertSchema(notifications)
  .omit({
    id: true,
    created_at: true,
  })
  .extend({
    user_id: z.number(),
  });

// Optimized types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobApplication = typeof job_applications.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
