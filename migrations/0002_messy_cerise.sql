CREATE TABLE "freelancer_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"freelancer_id" integer NOT NULL,
	"document_type" text NOT NULL,
	"file_url" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'private';--> statement-breakpoint
ALTER TABLE "ratings" ALTER COLUMN "job_application_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD COLUMN "superpower" text;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "invitation_message" text;--> statement-breakpoint
ALTER TABLE "job_applications" ADD COLUMN "freelancer_response" text;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "review" text;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "flag" text;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "admin_notes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "freelancer_documents" ADD CONSTRAINT "freelancer_documents_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "freelancer_documents_freelancer_idx" ON "freelancer_documents" USING btree ("freelancer_id");--> statement-breakpoint
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_status_check" CHECK ("ratings"."status" IN ('active', 'flagged', 'removed'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_check" CHECK ("users"."status" IN ('pending', 'active', 'deactivated'));