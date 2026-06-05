import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
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
    welcome_email_sent: boolean("welcome_email_sent").default(false).notNull(),
    marketing_emails_opt_out: boolean("marketing_emails_opt_out").default(false).notNull(),
    unsubscribe_token: text("unsubscribe_token"),
    job_alerts_opt_out: boolean("job_alerts_opt_out").default(false), // Freelancer has unsubscribed from job alert emails
    last_job_alert_sent_at: timestamp("last_job_alert_sent_at", { withTimezone: true }), // Timestamp of last job alert email sent
    job_alert_frequency_preference: text("job_alert_frequency_preference").default("instant").$type<"instant" | "weekly" | "none">(), // 'instant' = include in batch, 'none' = no automated emails
  },
  table => ({
    statusCheck: check(
      "users_status_check",
      sql`${table.status} IN ('pending', 'active', 'deactivated')`
    ),
    // Partial unique index — matches the live DB definition exactly so drizzle-kit
    // does not propose to swap a regular unique constraint for this on every push.
    unsubscribeTokenUnique: uniqueIndex("users_unsubscribe_token_unique")
      .on(table.unsubscribe_token)
      .where(sql`${table.unsubscribe_token} IS NOT NULL`),
  })
);

/** Express session store (`connect-pg-simple`, `tableName: user_sessions`). Rows are written by the session middleware, not app code. */
export const user_sessions = pgTable(
  "user_sessions",
  {
    sid: varchar("sid").notNull(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
  },
  table => ({
    pk: primaryKey({ name: "session_pkey", columns: [table.sid] }),
    expireIdx: index("IDX_session_expire").on(table.expire),
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
    reference_token: text("reference_token"), // UUID for public reference request link
    slug: text("slug"), // SEO-friendly URL slug e.g. james-harris-sound-engineer
    // Structured CV-derived fields (confirmed by freelancer from CV parsing)
    work_history: jsonb("work_history"), // JSON array of {jobTitle, company, dates, details}
    education_history: jsonb("education_history"), // JSON array of {qualification, institution, dates}
    certifications: text("certifications").array(), // Array of certification names
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
  slug: text("slug"), // SEO-friendly URL slug e.g. live-nation
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  recruiter_id: integer("recruiter_id").references(() => users.id, { onDelete: "cascade" }), // Company owner id; nullable for external jobs
  posted_by_user_id: integer("posted_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }), // User who created the posting — receives application alerts (legacy rows: company owner)
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
  slug: text("slug"), // SEO-friendly URL slug e.g. sound-engineer-london-4821
  last_notified_at: timestamp("last_notified_at", { withTimezone: true }), // When admin last sent "Notify Freelancers" for this job
  notification_batch_window: text("notification_batch_window").$type<"morning" | "afternoon" | null>(), // Batch window assignment; cleared after send
  notification_sent_at: timestamp("notification_sent_at", { withTimezone: true }), // When automated batch notification was sent
  is_urgent: boolean("is_urgent").default(false), // true when event date is within 48h of publication
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
  closure_email_sent: boolean("closure_email_sent").notNull().default(false),
  closure_email_sent_at: timestamp("closure_email_sent_at", { withTimezone: true }),
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
    description: z.string().optional().default(""),
    type: z.string().optional().default("freelance"),
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

// CV parsed data - stores extracted information from CV in draft state until confirmed
export const cv_parsed_data = pgTable("cv_parsed_data", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // Parsing status
  status: text("status")
    .default("pending")
    .notNull()
    .$type<"pending" | "parsing" | "completed" | "failed" | "confirmed" | "rejected">(),
  error_message: text("error_message"), // Error details if parsing failed
  // Extracted fields (stored as JSON for flexibility)
  extracted_full_name: text("extracted_full_name"),
  extracted_title: text("extracted_title"),
  extracted_skills: text("extracted_skills").array(), // Array of skills
  extracted_bio: text("extracted_bio"),
  extracted_location: text("extracted_location"),
  extracted_experience_years: integer("extracted_experience_years"),
  extracted_education: text("extracted_education"), // JSON string for education history
  extracted_work_history: text("extracted_work_history"), // JSON string for work experience
  extracted_certifications: text("extracted_certifications").array(), // Array of certifications
  // Pipeline stage data
  section_data: text("section_data"), // JSON: detected sections (headerBlock, summaryBlock, etc.)
  confidence_data: text("confidence_data"), // JSON: per-field confidence scores
  // Tracking
  cv_file_url: text("cv_file_url"), // Reference to the CV that was parsed
  parsed_at: timestamp("parsed_at", { withTimezone: true }),
  confirmed_at: timestamp("confirmed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCvParsedDataSchema = createInsertSchema(cv_parsed_data)
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    parsed_at: true,
    confirmed_at: true,
  })
  .extend({
    user_id: z.number(),
  });

export type CvParsedData = typeof cv_parsed_data.$inferSelect;
export type InsertCvParsedData = z.infer<typeof insertCvParsedDataSchema>;

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

// Job link view tracking for social sharing analytics
export const job_link_views = pgTable(
  "job_link_views",
  {
    id: serial("id").primaryKey(),
    job_id: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    source: text("source").$type<"direct" | "linkedin" | "whatsapp" | "email" | "facebook" | "twitter" | "copy" | "other">(),
    referrer: text("referrer"),
    user_agent: text("user_agent"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    jobIdIdx: index("job_link_views_job_id_idx").on(table.job_id),
    createdAtIdx: index("job_link_views_created_at_idx").on(table.created_at),
  })
);

export const insertJobLinkViewSchema = createInsertSchema(job_link_views).omit({
  id: true,
  created_at: true,
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
export type JobLinkView = typeof job_link_views.$inferSelect;
export type InsertJobLinkView = z.infer<typeof insertJobLinkViewSchema>;

export const saved_freelancers = pgTable(
  "saved_freelancers",
  {
    id: serial("id").primaryKey(),
    recruiter_id: integer("recruiter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    freelancer_id: integer("freelancer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    recruiterIdx: index("saved_freelancers_recruiter_idx").on(table.recruiter_id),
    uniquePair: index("saved_freelancers_unique_pair_idx").on(table.recruiter_id, table.freelancer_id),
  })
);

export const insertSavedFreelancerSchema = createInsertSchema(saved_freelancers).omit({
  id: true,
  created_at: true,
});

export type SavedFreelancer = typeof saved_freelancers.$inferSelect;
export type InsertSavedFreelancer = z.infer<typeof insertSavedFreelancerSchema>;

// Freelancer References (external reputation building)
export const freelancer_references = pgTable("freelancer_references", {
  id: serial("id").primaryKey(),
  freelancer_id: integer("freelancer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  referee_name: text("referee_name"),
  referee_organisation: text("referee_organisation"),
  referee_email: text("referee_email"),
  referee_role: text("referee_role"),
  q1_confirmed: boolean("q1_confirmed").notNull(),
  q2_rating: text("q2_rating").$type<"excellent" | "good" | "mixed" | "prefer_not_to_say">(),
  q3_would_work_again: text("q3_would_work_again").$type<"absolutely" | "yes" | "unlikely" | "prefer_not_to_say">(),
  comment: text("comment"),
  badge_result: text("badge_result").$type<"highly_recommended" | "recommended" | "verified_private" | "work_history_confirmed" | "flagged">(),
  is_flagged: boolean("is_flagged").default(false).notNull(),
  verification_type: text("verification_type").$type<"none" | "email" | "linkedin" | "eventlink_member">().default("none").notNull(),
  verified_email: text("verified_email"),
  email_domain: text("email_domain"),
  domain_trust_level: text("domain_trust_level").$type<"high" | "medium" | "low">(),
  linkedin_name: text("linkedin_name"),
  linkedin_title: text("linkedin_title"),
  linkedin_company: text("linkedin_company"),
  linkedin_profile_id: text("linkedin_profile_id"),
  eventlink_user_id: integer("eventlink_user_id").references(() => users.id),
  verification_token: text("verification_token"),
  verification_timestamp: timestamp("verification_timestamp", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFreelancerReferenceSchema = createInsertSchema(freelancer_references).omit({
  id: true,
  badge_result: true,
  is_flagged: true,
  verification_type: true,
  verified_email: true,
  email_domain: true,
  domain_trust_level: true,
  linkedin_name: true,
  linkedin_title: true,
  linkedin_company: true,
  linkedin_profile_id: true,
  eventlink_user_id: true,
  verification_token: true,
  verification_timestamp: true,
  created_at: true,
});

export type FreelancerReference = typeof freelancer_references.$inferSelect;
export type InsertFreelancerReference = z.infer<typeof insertFreelancerReferenceSchema>;

// Reference Requests (tracking sent/pending/completed)
export const reference_requests = pgTable("reference_requests", {
  id: serial("id").primaryKey(),
  freelancer_id: integer("freelancer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  referee_email: text("referee_email").notNull(),
  referee_name: text("referee_name"),
  status: text("status").$type<"pending" | "completed" | "cancelled">().default("pending").notNull(),
  reminder_sent: boolean("reminder_sent").default(false).notNull(),
  reminder_sent_at: timestamp("reminder_sent_at", { withTimezone: true }),
  reference_id: integer("reference_id").references(() => freelancer_references.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertReferenceRequestSchema = createInsertSchema(reference_requests).omit({
  id: true,
  status: true,
  reminder_sent: true,
  reminder_sent_at: true,
  reference_id: true,
  created_at: true,
});

export type ReferenceRequest = typeof reference_requests.$inferSelect;
export type InsertReferenceRequest = z.infer<typeof insertReferenceRequestSchema>;

// Reference Reports (employer flagging suspicious references)
export const reference_reports = pgTable("reference_reports", {
  id: serial("id").primaryKey(),
  reference_id: integer("reference_id")
    .notNull()
    .references(() => freelancer_references.id, { onDelete: "cascade" }),
  reporter_id: integer("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason"),
  status: text("status").$type<"pending" | "reviewed" | "dismissed">().default("pending").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertReferenceReportSchema = createInsertSchema(reference_reports).omit({
  id: true,
  status: true,
  created_at: true,
});

export type ReferenceReport = typeof reference_reports.$inferSelect;
export type InsertReferenceReport = z.infer<typeof insertReferenceReportSchema>;

// ============================================================
// FMS Phase 1 — Bookings
// ============================================================

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    employerId: integer("employer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    freelancerId: integer("freelancer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("enquired"),
    agreedRate: text("agreed_rate"),
    callTime: text("call_time"),
    venueAddress: text("venue_address"),
    employerNotes: text("employer_notes"),
    cancellationReason: text("cancellation_reason"),
    cancelledBy: text("cancelled_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    jobFreelancerUnique: unique("bookings_job_freelancer_unique").on(
      table.jobId,
      table.freelancerId
    ),
    employerIdIdx: index("bookings_employer_id_idx").on(table.employerId),
    freelancerIdIdx: index("bookings_freelancer_id_idx").on(table.freelancerId),
    jobIdIdx: index("bookings_job_id_idx").on(table.jobId),
    statusIdx: index("bookings_status_idx").on(table.status),
  })
);

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedById: integer("changed_by_id")
      .notNull()
      .references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    bookingIdIdx: index("booking_history_booking_id_idx").on(table.bookingId),
  })
);

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBookingSchema = createInsertSchema(bookings)
  .omit({ id: true, jobId: true, employerId: true, freelancerId: true, createdAt: true })
  .partial();

export const bookingStatusValues = [
  "enquired",
  "confirmed",
  "briefed",
  "completed",
  "cancelled",
] as const;

export type BookingStatus = (typeof bookingStatusValues)[number];

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;
export type BookingStatusHistory = typeof bookingStatusHistory.$inferSelect;

// ============================================================
// Team Members
// ============================================================

export const teamMembers = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    role: text("role").notNull().default("manager"),
    invitedEmail: text("invited_email").notNull(),
    inviteToken: text("invite_token").unique(),
    inviteAccepted: boolean("invite_accepted").notNull().default(false),
    inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }).defaultNow(),
    inviteAcceptedAt: timestamp("invite_accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    userUnique: unique("team_members_user_unique").on(table.userId),
    companyIdIdx: index("team_members_company_id_idx").on(table.companyId),
    userIdIdx: index("team_members_user_id_idx").on(table.userId),
    inviteTokenIdx: index("team_members_invite_token_idx").on(table.inviteToken),
  })
);

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

// ============================================================
// Job Documents
// ============================================================

export const jobDocuments = pgTable(
  "job_documents",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    uploadedByUserId: integer("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(),
    fileKey: text("file_key").notNull().unique(),
    fileSize: integer("file_size"),
    fileType: text("file_type"),
    documentType: text("document_type").notNull().default("other"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    jobIdIdx: index("job_documents_job_id_idx").on(table.jobId),
    uploadedByIdx: index("job_documents_uploaded_by_idx").on(table.uploadedByUserId),
  })
);

export type JobDocument = typeof jobDocuments.$inferSelect;
export type InsertJobDocument = typeof jobDocuments.$inferInsert;
