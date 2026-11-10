ALTER TABLE "earnings_entries"
  ADD COLUMN IF NOT EXISTS "standard_hours_per_day" integer,
  ADD COLUMN IF NOT EXISTS "overtime_rate_pence" integer;

CREATE TABLE IF NOT EXISTS "job_time_entries" (
  "id" serial PRIMARY KEY,
  "freelancer_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "earnings_entry_id" integer NOT NULL REFERENCES "earnings_entries"("id") ON DELETE CASCADE,
  "work_date" date NOT NULL,
  "start_time" text NOT NULL,
  "finish_time" text NOT NULL,
  "break_minutes" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "job_time_freelancer_date_idx" ON "job_time_entries" ("freelancer_id", "work_date");
CREATE INDEX IF NOT EXISTS "job_time_entry_idx" ON "job_time_entries" ("earnings_entry_id");
