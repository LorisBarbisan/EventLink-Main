import { pgTable, text, serial, integer, boolean, decimal, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().$type<'freelancer' | 'recruiter'>(),
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
  company_logo_url: text("company_logo_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  role: true,
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
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type FreelancerProfile = typeof freelancer_profiles.$inferSelect;
export type RecruiterProfile = typeof recruiter_profiles.$inferSelect;
export type InsertFreelancerProfile = z.infer<typeof insertFreelancerProfileSchema>;
export type InsertRecruiterProfile = z.infer<typeof insertRecruiterProfileSchema>;
