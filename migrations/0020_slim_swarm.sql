CREATE TABLE IF NOT EXISTS "availability_enquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"job_id" integer,
	"event_title" text NOT NULL,
	"event_date" text NOT NULL,
	"event_end_date" text,
	"call_time" text,
	"venue_address" text,
	"role_required" text,
	"agreed_rate" text,
	"additional_notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "availability_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"enquiry_id" integer NOT NULL,
	"freelancer_id" integer NOT NULL,
	"token" text NOT NULL,
	"response" text DEFAULT null,
	"response_note" text,
	"responded_at" timestamp with time zone,
	"converted_to_booking_id" integer,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_responses_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by_id" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"employer_id" integer NOT NULL,
	"freelancer_id" integer NOT NULL,
	"status" text DEFAULT 'enquired' NOT NULL,
	"event_date" text,
	"agreed_rate" text,
	"call_time" text,
	"venue_address" text,
	"employer_notes" text,
	"cancellation_reason" text,
	"cancelled_by" text,
	"google_event_id" text,
	"outlook_event_id" text,
	"ir35_status" text DEFAULT 'not_assessed',
	"ir35_assessed_at" timestamp with time zone,
	"ir35_notes" text,
	"role_required" text,
	"skill_tags" text[],
	"agreed_budget" integer,
	"actual_cost" integer,
	"expenses" integer,
	"budget_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brief_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"brief_id" integer NOT NULL,
	"object_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brief_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"name" text NOT NULL,
	"details" text,
	"call_time" text,
	"venue_address" text,
	"role_required" text,
	"dresscode" text,
	"parking_info" text,
	"contact_on_day" text,
	"schedule_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"employer_id" integer NOT NULL,
	"freelancer_id" integer NOT NULL,
	"event_title" text NOT NULL,
	"event_date" text NOT NULL,
	"call_time" text,
	"venue_address" text,
	"role_required" text,
	"agreed_rate" text,
	"details" text,
	"dresscode" text,
	"parking_info" text,
	"contact_on_day" text,
	"schedule_notes" text,
	"token" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledgement_note" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefs_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"calendar_id" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_connections_employer_id_unique" UNIQUE("employer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cv_parsed_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"extracted_full_name" text,
	"extracted_title" text,
	"extracted_skills" text[],
	"extracted_bio" text,
	"extracted_location" text,
	"extracted_country" text,
	"extracted_experience_years" integer,
	"extracted_education" text,
	"extracted_work_history" text,
	"extracted_certifications" text[],
	"section_data" text,
	"confidence_data" text,
	"cv_file_url" text,
	"parsed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cv_parsed_data_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "freelancer_date_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"freelancer_id" integer NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "freelancer_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"freelancer_id" integer NOT NULL,
	"referee_name" text,
	"referee_organisation" text,
	"referee_email" text,
	"referee_role" text,
	"q1_confirmed" boolean NOT NULL,
	"q2_rating" text,
	"q3_would_work_again" text,
	"comment" text,
	"badge_result" text,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"verification_type" text DEFAULT 'none' NOT NULL,
	"verified_email" text,
	"email_domain" text,
	"domain_trust_level" text,
	"linkedin_name" text,
	"linkedin_title" text,
	"linkedin_company" text,
	"linkedin_profile_id" text,
	"eventlink_user_id" integer,
	"verification_token" text,
	"verification_timestamp" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_application_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"application_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"guest_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"viewed_at" timestamp with time zone,
	CONSTRAINT "guest_application_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "help_content_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" text,
	"body" text,
	"learn_more_href" text,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "help_content_overrides_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "help_route_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"route" text NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"first_visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_route_visits_user_route_unique" UNIQUE("user_id","route")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "help_user_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"help_key" text NOT NULL,
	"seen_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	"dismissed_count" integer DEFAULT 0 NOT NULL,
	"dismissed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"content_version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_user_state_user_key_unique" UNIQUE("user_id","help_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"quote_id" integer,
	"booking_id" integer,
	"client_name" text NOT NULL,
	"client_email" text,
	"client_company" text,
	"client_address" text,
	"invoice_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"vat_rate" integer DEFAULT 20 NOT NULL,
	"vat_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"amount_paid" integer DEFAULT 0,
	"notes" text,
	"terms" text,
	"stripe_payment_link_url" text,
	"stripe_payment_link_id" text,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"event_name" text,
	"event_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"uploaded_by_user_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_key" text NOT NULL,
	"file_size" integer,
	"file_type" text,
	"document_type" text DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_documents_file_key_unique" UNIQUE("file_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"token_hash" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"terms_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"published_job_id" integer,
	"nudge_sent_at" timestamp with time zone,
	CONSTRAINT "job_drafts_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_link_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"source" text,
	"referrer" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_nudge_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"nudge_1_sent_at" timestamp with time zone,
	"nudge_2_sent_at" timestamp with time zone,
	"nudge_3_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_nudge_emails_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text,
	"client_company" text,
	"client_address" text,
	"event_name" text NOT NULL,
	"event_date" text,
	"venue_address" text,
	"quote_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"valid_until" text,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"vat_rate" integer DEFAULT 20 NOT NULL,
	"vat_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0,
	"notes" text,
	"terms" text,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"accepted_by_name" text,
	"accepted_by_ip" text,
	"booking_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reference_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference_id" integer NOT NULL,
	"reporter_id" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reference_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"freelancer_id" integer NOT NULL,
	"referee_email" text NOT NULL,
	"referee_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"reference_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_freelancers" (
	"id" serial PRIMARY KEY NOT NULL,
	"recruiter_id" integer NOT NULL,
	"freelancer_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"tier" text DEFAULT 'pro' NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_employer_id_unique" UNIQUE("employer_id"),
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer,
	"role" text DEFAULT 'manager' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_by_user_id" integer,
	"invite_token" text,
	"invite_email" text,
	"invite_expires_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_accounts_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_delegate_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"delegator_user_id" integer NOT NULL,
	"delegate_user_id" integer NOT NULL,
	"granted_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"sid" varchar NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL,
	CONSTRAINT "session_pkey" PRIMARY KEY("sid")
);
--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "state_province" text;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "profile_is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "reference_token" text;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "custom_slug" text;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "work_history" jsonb;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "education_history" jsonb;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "certifications" text[];--> statement-breakpoint
ALTER TABLE "job_alert_filters" ADD COLUMN "location_radius_km" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "closure_email_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "closure_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "posted_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "currency" text DEFAULT 'GBP';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "notification_batch_window" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "notification_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "is_urgent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "is_freelancer_posted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "poster_type" text DEFAULT 'company' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "moderation_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "moderated_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "moderation_note" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "company_size" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "founded_year" integer;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "company_registration_number" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "mission_statement" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "notable_clients" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "address_line1" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "county" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "postcode" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "instagram_url" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "twitter_url" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "billing_same_as_company" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "billing_address_line1" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "billing_address_line2" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "billing_city" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "billing_county" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "billing_postcode" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "specialisations" text[];--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "typical_roles" text[];--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "day_rate_min" integer;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "day_rate_max" integer;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "ir35_preference" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "public_liability_value" text;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "employers_liability" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "professional_indemnity" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "gdpr_compliant" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "industry_bodies" text[];--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD COLUMN "other_accreditations" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "welcome_email_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "marketing_emails_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "unsubscribe_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "job_alerts_opt_out" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_job_alert_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "job_alert_frequency_preference" text DEFAULT 'instant';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_via" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "posting_suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_tier" text DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "help_mode" text DEFAULT 'full';--> statement-breakpoint
ALTER TABLE "availability_enquiries" ADD CONSTRAINT "availability_enquiries_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_enquiries" ADD CONSTRAINT "availability_enquiries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_enquiry_id_availability_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."availability_enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_converted_to_booking_id_bookings_id_fk" FOREIGN KEY ("converted_to_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_attachments" ADD CONSTRAINT "brief_attachments_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_templates" ADD CONSTRAINT "brief_templates_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_parsed_data" ADD CONSTRAINT "cv_parsed_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_date_availability" ADD CONSTRAINT "freelancer_date_availability_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_references" ADD CONSTRAINT "freelancer_references_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_references" ADD CONSTRAINT "freelancer_references_eventlink_user_id_users_id_fk" FOREIGN KEY ("eventlink_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_application_tokens" ADD CONSTRAINT "guest_application_tokens_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_application_tokens" ADD CONSTRAINT "guest_application_tokens_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_content_overrides" ADD CONSTRAINT "help_content_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_route_visits" ADD CONSTRAINT "help_route_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_user_state" ADD CONSTRAINT "help_user_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_drafts" ADD CONSTRAINT "job_drafts_published_job_id_jobs_id_fk" FOREIGN KEY ("published_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_link_views" ADD CONSTRAINT "job_link_views_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_nudge_emails" ADD CONSTRAINT "profile_nudge_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_reports" ADD CONSTRAINT "reference_reports_reference_id_freelancer_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."freelancer_references"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_reports" ADD CONSTRAINT "reference_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_requests" ADD CONSTRAINT "reference_requests_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_requests" ADD CONSTRAINT "reference_requests_reference_id_freelancer_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."freelancer_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_freelancers" ADD CONSTRAINT "saved_freelancers_recruiter_id_users_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_freelancers" ADD CONSTRAINT "saved_freelancers_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_team_accounts_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_accounts" ADD CONSTRAINT "team_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_delegate_access" ADD CONSTRAINT "team_delegate_access_team_id_team_accounts_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_delegate_access" ADD CONSTRAINT "team_delegate_access_delegator_user_id_users_id_fk" FOREIGN KEY ("delegator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_delegate_access" ADD CONSTRAINT "team_delegate_access_delegate_user_id_users_id_fk" FOREIGN KEY ("delegate_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_delegate_access" ADD CONSTRAINT "team_delegate_access_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_history_booking_id_idx" ON "booking_status_history" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "fda_freelancer_date_idx" ON "freelancer_date_availability" USING btree ("freelancer_id","date");--> statement-breakpoint
CREATE INDEX "help_user_state_user_idx" ON "help_user_state" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_documents_job_id_idx" ON "job_documents" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_documents_uploaded_by_idx" ON "job_documents" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "job_drafts_email_idx" ON "job_drafts" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "job_drafts_expiry_idx" ON "job_drafts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "job_link_views_job_id_idx" ON "job_link_views" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_link_views_created_at_idx" ON "job_link_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "saved_freelancers_recruiter_idx" ON "saved_freelancers" USING btree ("recruiter_id");--> statement-breakpoint
CREATE INDEX "saved_freelancers_unique_pair_idx" ON "saved_freelancers" USING btree ("recruiter_id","freelancer_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "user_sessions" USING btree ("expire");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_posted_by_user_id_users_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_moderated_by_user_id_users_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_unsubscribe_token_unique" ON "users" USING btree ("unsubscribe_token") WHERE "users"."unsubscribe_token" IS NOT NULL;