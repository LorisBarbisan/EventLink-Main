ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "notification_batch_window" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "notification_sent_at" timestamp with time zone;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "is_urgent" boolean DEFAULT false;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_alerts_opt_out" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_job_alert_sent_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_alert_frequency_preference" text DEFAULT 'instant';
