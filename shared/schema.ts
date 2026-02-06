import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    password: text("password"), // Made nullable for social auth users
    role: text("role").notNull().$type<"freelancer" | "recruiter" | "admin">(),
    first_name: text("first_name"),
    last_name: text("last_name"),
    email_verified: boolean("email_verified").default(false).notNull(),
    email_verification_token: text("email_verification_token"),
    email_verification_expires: timestamp("email_verification_expires"),
    password_reset_token: text("password_reset_token"),
    password_reset_expires: timestamp("password_reset_expires", { withTimezone: true }),
    // Social auth fields
    auth_provider: text("auth_provider")
      .default("email")
      .$type<"email" | "google" | "facebook" | "linkedin">(),
    google_id: text("google_id"),
    facebook_id: text("facebook_id"),
    linkedin_id: text("linkedin_id"),
    profile_photo_url: text("profile_photo_url"), // For social auth profile photos
    last_login_method: text("last_login_method").$type<
      "email" | "google" | "facebook" | "linkedin" | "apple"
    >(),
    last_login_at: timestamp("last_login_at", { withTimezone: true }),
    // Soft delete support for account deletion conversations
    deleted_at: timestamp("deleted_at", { withTimezone: true }), // NULL = active user, timestamp = deleted user
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    status: text("status").default("pending").notNull(),
  },
  table => ({
    statusCheck: check(
      "users_status_check",
      sql`${table.status} IN ('pending', 'active', 'deactivated')`
    ),
  })
);

export const freelancer_profiles = pgTable(
  "freelancer_profiles",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    first_name: text("first_name"),
    last_name: text("last_name"),
    title: text("title"),
    superpower: text("superpower"), // Short standout skill (e.g. "vMix Operator")
    bio: text("bio"),
    location: text("location"),
    experience_years: integer("experience_years"),
    skills: text("skills").array(),
    portfolio_url: text("portfolio_url"),
    linkedin_url: text("linkedin_url"),
    website_url: text("website_url"),
    availability_status: text("availability_status")
      .default("available")
      .$type<"available" | "busy" | "unavailable">(),
    profile_photo_url: text("profile_photo_url"),
    cv_file_url: text("cv_file_url"),
    cv_file_name: text("cv_file_name"),
    cv_file_type: text("cv_file_type"),
    cv_file_size: integer("cv_file_size"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    titleIdx: index("freelancer_profiles_title_idx").on(table.title),
    locationIdx: index("freelancer_profiles_location_idx").on(table.location),
    availabilityIdx: index("freelancer_profiles_availability_idx").on(table.availability_status),
  })
);

export const recruiter_profiles = pgTable("recruiter_profiles", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  company_name: text("company_name").notNull(),
  contact_name: text("contact_name"),
  company_type: text("company_type"),
  location: text("location"),
  description: text("description"),
  website_url: text("website_url"),
  linkedin_url: text("linkedin_url"),
  company_logo_url: text("company_logo_url"), // No character limit for base64 image data
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  recruiter_id: integer("recruiter_id").references(() => users.id, { onDelete: "cascade" }), // Made nullable for external jobs
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  type: text("type")
    .notNull()
    .$type<"full-time" | "part-time" | "contract" | "temporary" | "freelance" | "external">(),
  contract_type: text("contract_type"), // Specific contract type when type is 'contract'
  rate: text("rate").notNull(),
  description: text("description").notNull(),
  event_date: text("event_date"), // Start date of the event/job
  end_date: text("end_date"), // Optional end date of the event/job
  // Job duration fields - user can choose one of three options
  duration_type: text("duration_type").$type<"time" | "days" | "hours" | null>(), // Which duration option was selected
  start_time: text("start_time"), // Optional start time (e.g., "09:00")
  end_time: text("end_time"), // Optional end time (e.g., "17:00")
  days: integer("days"), // Number of days if duration_type = 'days'
  hours: integer("hours"), // Number of hours if duration_type = 'hours'
  status: text("status").default("private").$type<"active" | "paused" | "closed" | "private">(),
  external_id: text("external_id"), // For external job IDs (reed_123, adzuna_456)
  external_source: text("external_source").$type<"reed" | "adzuna" | null>(), // Source of external job
  external_url: text("external_url"), // URL to original job posting
  posted_date: text("posted_date"), // Original posting date from external source
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
    .$type<
      "applied" | "reviewed" | "shortlisted" | "rejected" | "hired" | "invited" | "declined"
    >(),
  cover_letter: text("cover_letter"),
  rejection_message: text("rejection_message"), // Message explaining rejection (recruiter -> freelancer)
  invitation_message: text("invitation_message"), // Message sent with invitation (recruiter -> freelancer)
  freelancer_response: text("freelancer_response"), // Response message when declining (freelancer -> recruiter)
  freelancer_deleted: boolean("freelancer_deleted").default(false).notNull(), // Soft delete flag for freelancer view
  recruiter_deleted: boolean("recruiter_deleted").default(false).notNull(), // Soft delete flag for recruiter view
  applied_at: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  participant_one_id: integer("participant_one_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  participant_two_id: integer("participant_two_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  participant_one_deleted: boolean("participant_one_deleted").default(false).notNull(), // Soft delete flag for participant one
  participant_two_deleted: boolean("participant_two_deleted").default(false).notNull(), // Soft delete flag for participant two
  participant_one_deleted_at: timestamp("participant_one_deleted_at", { withTimezone: true }), // Timestamp when participant one deleted (null = not deleted)
  participant_two_deleted_at: timestamp("participant_two_deleted_at", { withTimezone: true }), // Timestamp when participant two deleted (null = not deleted)
  last_message_at: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversation_id: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  sender_id: integer("sender_id").references(() => users.id, { onDelete: "cascade" }), // Made nullable for system messages
  content: text("content").notNull(),
  is_read: boolean("is_read").default(false).notNull(),
  is_system_message: boolean("is_system_message").default(false).notNull(), // For account deletion and other system notifications
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const message_user_states = pgTable("message_user_states", {
  id: serial("id").primaryKey(),
  message_id: integer("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deleted_at: timestamp("deleted_at").defaultNow().notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const message_attachments = pgTable("message_attachments", {
  id: serial("id").primaryKey(),
  message_id: integer("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  object_path: text("object_path").notNull(), // Path to file in object storage (e.g., "/objects/uuid")
  original_filename: text("original_filename").notNull(), // Original filename from user
  file_type: text("file_type").notNull(), // MIME type (e.g., "application/pdf", "image/jpeg")
  file_size: integer("file_size").notNull(), // Size in bytes
  scan_status: text("scan_status")
    .default("pending")
    .$type<"pending" | "safe" | "unsafe" | "error">(),
  scan_result: text("scan_result"), // JSON string with scan details
  moderation_status: text("moderation_status")
    .default("pending")
    .$type<"pending" | "approved" | "rejected" | "error">(),
  moderation_result: text("moderation_result"), // JSON string with moderation details
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const file_reports = pgTable("file_reports", {
  id: serial("id").primaryKey(),
  attachment_id: integer("attachment_id")
    .notNull()
    .references(() => message_attachments.id, { onDelete: "cascade" }),
  reporter_id: integer("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  report_reason: text("report_reason")
    .notNull()
    .$type<"malware" | "inappropriate" | "harassment" | "other">(),
  report_details: text("report_details"), // Additional details from reporter
  status: text("status")
    .default("pending")
    .$type<"pending" | "under_review" | "resolved" | "dismissed">(),
  admin_notes: text("admin_notes"), // Admin notes for review
  admin_user_id: integer("admin_user_id").references(() => users.id, { onDelete: "set null" }),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type")
    .notNull()
    .$type<
      | "application_update"
      | "new_message"
      | "job_update"
      | "profile_view"
      | "rating_received"
      | "rating_request"
      | "system"
      | "feedback"
      | "contact_message"
    >(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  is_read: boolean("is_read").default(false).notNull(),
  priority: text("priority").default("normal").$type<"low" | "normal" | "high" | "urgent">(),
  related_entity_type: text("related_entity_type").$type<
    "job" | "application" | "message" | "profile" | "rating" | null
  >(),
  related_entity_id: integer("related_entity_id"),
  action_url: text("action_url"), // URL to navigate to when clicked
  metadata: text("metadata"), // JSON string for additional data
  expires_at: timestamp("expires_at", { withTimezone: true }), // Optional expiration for temporary notifications
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    job_application_id: integer("job_application_id").references(() => job_applications.id, {
      onDelete: "cascade",
    }), // Made nullable for standalone reviews
    recruiter_id: integer("recruiter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    freelancer_id: integer("freelancer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull().$type<1 | 2 | 3 | 4 | 5>(), // 1-5 stars
    review: text("review"), // Optional written review
    status: text("status").default("active").notNull().$type<"active" | "flagged" | "removed">(),
    flag: text("flag"), // Reason for reporting: "spam", "harassment", etc.
    admin_notes: text("admin_notes"), // Notes from admin moderation
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    statusCheck: check(
      "ratings_status_check",
      sql`${table.status} IN ('active', 'flagged', 'removed')`
    ),
  })
);

export const rating_requests = pgTable("rating_requests", {
  id: serial("id").primaryKey(),
  job_application_id: integer("job_application_id")
    .notNull()
    .references(() => job_applications.id, { onDelete: "cascade" }),
  freelancer_id: integer("freelancer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recruiter_id: integer("recruiter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default("pending").$type<"pending" | "completed" | "declined">(),
  requested_at: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  responded_at: timestamp("responded_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Schema for email/password registration (password required)
export const insertUserSchema = createInsertSchema(users)
  .pick({
    email: true,
    password: true,
    role: true,
    first_name: true,
    last_name: true,
  })
  .extend({
    password: z.string().min(1, "Password is required"),
  });

// Schema for social auth registration
export const insertSocialUserSchema = createInsertSchema(users)
  .pick({
    email: true,
    role: true,
    first_name: true,
    last_name: true,
    auth_provider: true,
    google_id: true,
    facebook_id: true,
    linkedin_id: true,
    profile_photo_url: true,
  })
  .extend({
    password: z.string().optional(),
  });

export const insertFreelancerProfileSchema = createInsertSchema(freelancer_profiles)
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    user_id: z.number(),
    superpower: z.string().max(40).optional().nullable(),
    hourly_rate: z
      .number()
      .nullable()
      .transform(val => (val ? val.toString() : null)),
  });

export const insertRecruiterProfileSchema = createInsertSchema(recruiter_profiles)
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    user_id: z.number(),
  });

export const insertJobSchema = createInsertSchema(jobs)
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    recruiter_id: z.number(),
    company: z.string().min(1, "Company name is required"),
    title: z.string().min(1, "Job title is required"),
    location: z.string().min(1, "Location is required"),
    description: z.string().min(1, "Description is required"),
  });

export const insertJobApplicationSchema = createInsertSchema(job_applications)
  .omit({
    id: true,
    applied_at: true,
    updated_at: true,
    freelancer_deleted: true, // Auto-generated field
    recruiter_deleted: true, // Auto-generated field
  })
  .extend({
    job_id: z.number(),
    freelancer_id: z.number(),
  });

export const insertMessageUserStateSchema = createInsertSchema(message_user_states).omit({
  id: true,
  created_at: true,
  deleted_at: true, // Auto-generated field
});

export const insertConversationSchema = createInsertSchema(conversations)
  .omit({
    id: true,
    created_at: true,
    last_message_at: true,
  })
  .extend({
    participant_one_id: z.number(),
    participant_two_id: z.number(),
  });

export const insertMessageSchema = createInsertSchema(messages)
  .omit({
    id: true,
    created_at: true,
  })
  .extend({
    conversation_id: z.number(),
    sender_id: z.number().nullable().optional(), // Made optional for system messages
    is_system_message: z.boolean().optional().default(false),
  });

export const insertNotificationSchema = createInsertSchema(notifications)
  .omit({
    id: true,
    created_at: true,
  })
  .extend({
    user_id: z.number(),
  });

export const insertRatingSchema = createInsertSchema(ratings)
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    status: true,
    flag: true,
    admin_notes: true,
  })
  .extend({
    job_application_id: z.number().optional().nullable(),
    recruiter_id: z.number(),
    freelancer_id: z.number(),
    rating: z.number().min(1).max(5),
    review: z.string().max(500, "Review must be 500 characters or less").optional().nullable(),
  });

// Feedback table for admin dashboard
export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id").references(() => users.id, { onDelete: "set null" }), // Nullable for guest users
    feedback_type: text("feedback_type")
      .notNull()
      .$type<"malfunction" | "feature-missing" | "suggestion" | "other">(),
    message: text("message").notNull(),
    page_url: text("page_url"),
    source: text("source").$type<"header" | "popup">(),
    user_email: text("user_email"), // Store email for guest users
    user_name: text("user_name"), // Store name for guest users or logged-in users
    status: text("status")
      .default("pending")
      .$type<"pending" | "in_review" | "resolved" | "closed">(),
    admin_response: text("admin_response"),
    admin_user_id: integer("admin_user_id").references(() => users.id, { onDelete: "set null" }),
    priority: text("priority").default("normal").$type<"low" | "normal" | "high" | "urgent">(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
  },
  table => ({
    createdAtIdx: index("feedback_created_at_idx").on(table.created_at),
  })
);

export const contact_messages = pgTable(
  "contact_messages",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status").default("pending").$type<"pending" | "replied" | "resolved">(),
    ip_address: text("ip_address"), // For rate limiting and spam prevention
    user_agent: text("user_agent"), // Browser/device information
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    createdAtIdx: index("contact_messages_created_at_idx").on(table.created_at),
  })
);

// Email notification preferences for users
export const notification_preferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // Email notification toggles
  email_messages: boolean("email_messages").default(true).notNull(), // New internal messages
  email_application_updates: boolean("email_application_updates").default(true).notNull(), // Application status changes (freelancers only)
  email_job_updates: boolean("email_job_updates").default(true).notNull(), // New applications on posted jobs (recruiters only)
  email_job_alerts: boolean("email_job_alerts").default(true).notNull(), // New job posts matching filters
  email_rating_requests: boolean("email_rating_requests").default(true).notNull(), // Rating requests
  email_system_updates: boolean("email_system_updates").default(true).notNull(), // Platform updates and announcements
  // Future: digest mode settings
  digest_mode: text("digest_mode").default("instant").$type<"instant" | "daily" | "weekly">(),
  digest_time: text("digest_time").default("09:00"), // Time to send daily digest (HH:MM format)
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Job alert filters for personalized job notifications
export const job_alert_filters = pgTable("job_alert_filters", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Filter criteria
  skills: text("skills").array(), // Array of skills to match
  locations: text("locations").array(), // Array of locations to match
  date_from: text("date_from"), // Start date range (YYYY-MM-DD)
  date_to: text("date_to"), // End date range (YYYY-MM-DD)
  job_types: text("job_types").array(), // Array of job types to match
  keywords: text("keywords").array(), // Array of keywords to search in title/description
  location_radius_km: integer("location_radius_km").default(30), // Radius in km for geographic location matching (10, 30, 60, 100)
  is_active: boolean("is_active").default(true).notNull(), // Whether this filter is active
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Log of sent email notifications for debugging and tracking
export const email_notification_logs = pgTable("email_notification_logs", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id, { onDelete: "set null" }), // Nullable in case user is deleted
  email: text("email").notNull(), // Email address where notification was sent
  notification_type: text("notification_type")
    .notNull()
    .$type<
      "message" | "application_update" | "job_update" | "job_alert" | "rating_request" | "system"
    >(),
  subject: text("subject").notNull(),
  status: text("status").notNull().$type<"sent" | "failed" | "bounced">(),
  error_message: text("error_message"), // Error details if failed
  related_entity_type: text("related_entity_type").$type<
    "job" | "application" | "message" | "rating" | null
  >(),
  related_entity_id: integer("related_entity_id"), // ID of related entity (job, application, etc.)
  metadata: text("metadata"), // JSON string for additional data
  sent_at: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRatingRequestSchema = createInsertSchema(rating_requests)
  .omit({
    id: true,
    requested_at: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    job_application_id: z.number(),
    freelancer_id: z.number(),
    recruiter_id: z.number(),
  });

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  created_at: true,
  updated_at: true,
  resolved_at: true,
});

export const insertContactMessageSchema = createInsertSchema(contact_messages)
  .omit({
    id: true,
    created_at: true,
    status: true,
  })
  .extend({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Valid email is required"),
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(10, "Message must be at least 10 characters"),
  });

export const insertMessageAttachmentSchema = createInsertSchema(message_attachments).omit({
  id: true,
  created_at: true,
});

export const insertFileReportSchema = createInsertSchema(file_reports).omit({
  id: true,
  created_at: true,
  updated_at: true,
  resolved_at: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notification_preferences)
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    user_id: z.number(),
  });

export const insertJobAlertFilterSchema = createInsertSchema(job_alert_filters)
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    user_id: z.number(),
  });

export const insertEmailNotificationLogSchema = createInsertSchema(email_notification_logs).omit({
  id: true,
  sent_at: true,
});

// Document type constants for controlled list
export const DOCUMENT_TYPES = [
  "PLI",
  "BS7909",
  "IPAF",
  "NRC",
  "PASMA",
  "First Aid",
  "Electrical Safety",
  "Working at Height",
  "Risk Assessment",
  "Method Statement",
  "Other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// Freelancer documents/certifications table
export const freelancer_documents = pgTable(
  "freelancer_documents",
  {
    id: serial("id").primaryKey(),
    freelancer_id: integer("freelancer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    document_type: text("document_type").notNull().$type<DocumentType>(),
    custom_type_name: text("custom_type_name"),
    file_url: text("file_url").notNull(),
    original_filename: text("original_filename").notNull(),
    file_size: integer("file_size").notNull(),
    file_type: text("file_type").notNull(),
    uploaded_at: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    freelancerIdx: index("freelancer_documents_freelancer_idx").on(table.freelancer_id),
  })
);

export const insertFreelancerDocumentSchema = createInsertSchema(freelancer_documents)
  .omit({
    id: true,
    uploaded_at: true,
  })
  .extend({
    freelancer_id: z.number(),
    document_type: z.enum(DOCUMENT_TYPES),
    custom_type_name: z.string().max(50).nullable().optional(),
    file_url: z.string().min(1),
    original_filename: z.string().min(1),
    file_size: z.number().positive(),
    file_type: z.string().min(1),
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
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MessageUserState = typeof message_user_states.$inferSelect;
export type MessageAttachment = typeof message_attachments.$inferSelect;
export type FileReport = typeof file_reports.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertMessageUserState = z.infer<typeof insertMessageUserStateSchema>;
export type InsertMessageAttachment = z.infer<typeof insertMessageAttachmentSchema>;
export type InsertFileReport = z.infer<typeof insertFileReportSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type RatingRequest = typeof rating_requests.$inferSelect;
export type InsertRatingRequest = z.infer<typeof insertRatingRequestSchema>;
export type ContactMessage = typeof contact_messages.$inferSelect;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type NotificationPreferences = typeof notification_preferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type JobAlertFilter = typeof job_alert_filters.$inferSelect;
export type InsertJobAlertFilter = z.infer<typeof insertJobAlertFilterSchema>;
export type EmailNotificationLog = typeof email_notification_logs.$inferSelect;
export type InsertEmailNotificationLog = z.infer<typeof insertEmailNotificationLogSchema>;
export type FreelancerDocument = typeof freelancer_documents.$inferSelect;
export type InsertFreelancerDocument = z.infer<typeof insertFreelancerDocumentSchema>;
