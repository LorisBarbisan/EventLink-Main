ALTER TABLE "freelancer_profiles" ADD COLUMN "slug" text;
ALTER TABLE "recruiter_profiles" ADD COLUMN "slug" text;
ALTER TABLE "jobs" ADD COLUMN "slug" text;

CREATE UNIQUE INDEX IF NOT EXISTS "freelancer_profiles_slug_idx" ON "freelancer_profiles" ("slug") WHERE "slug" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "recruiter_profiles_slug_idx" ON "recruiter_profiles" ("slug") WHERE "slug" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "jobs_slug_idx" ON "jobs" ("slug") WHERE "slug" IS NOT NULL;
