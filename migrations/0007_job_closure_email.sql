ALTER TABLE "job_applications"
ADD COLUMN IF NOT EXISTS "closure_email_sent" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "closure_email_sent_at" timestamp with time zone;
