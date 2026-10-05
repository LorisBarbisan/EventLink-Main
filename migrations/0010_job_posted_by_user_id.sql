ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "posted_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;

UPDATE "jobs"
SET "posted_by_user_id" = "recruiter_id"
WHERE "posted_by_user_id" IS NULL AND "recruiter_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "jobs_posted_by_user_id_idx" ON "jobs"("posted_by_user_id");
