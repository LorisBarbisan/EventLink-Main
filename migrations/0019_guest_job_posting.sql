-- Phase 1: Guest job posting infrastructure
-- Adds poster_type, moderation columns, job_drafts table, and user tracking fields.

-- ── jobs: poster_type ───────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS poster_type TEXT NOT NULL DEFAULT 'company';
ALTER TABLE jobs ADD CONSTRAINT jobs_poster_type_check
  CHECK (poster_type IN ('company', 'freelancer', 'guest'));

-- Backfill from the existing boolean flag so history is consistent
UPDATE jobs SET poster_type = 'freelancer' WHERE is_freelancer_posted = true;

-- ── jobs: moderation ────────────────────────────────────────────────────────
-- DEFAULT 'approved' preserves all existing rows and all future company/freelancer posts.
-- Only guest submissions are written with 'pending' explicitly by the server.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE jobs ADD CONSTRAINT jobs_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
-- INTEGER to match users.id (not UUID)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderated_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS moderation_note TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_moderation_pending
  ON jobs (created_at) WHERE moderation_status = 'pending';

-- ── job_drafts ───────────────────────────────────────────────────────────────
-- Server-side holding area. A draft is created when the guest submits the form
-- and destroyed (consumed_at stamped) when they click the magic link.
CREATE TABLE IF NOT EXISTS job_drafts (
  id                SERIAL PRIMARY KEY,
  payload           JSONB        NOT NULL,
  contact_name      TEXT         NOT NULL,
  contact_email     TEXT         NOT NULL,  -- stored lowercase
  token_hash        TEXT         NOT NULL UNIQUE,
  ip_address        TEXT,
  user_agent        TEXT,
  terms_version     TEXT         NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ  NOT NULL,
  consumed_at       TIMESTAMPTZ,
  published_job_id  INTEGER      REFERENCES jobs(id) ON DELETE SET NULL,
  nudge_sent_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_drafts_email  ON job_drafts (contact_email);
CREATE INDEX IF NOT EXISTS idx_job_drafts_expiry ON job_drafts (expires_at) WHERE consumed_at IS NULL;

-- ── users: provenance and abuse fields ──────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_via TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_suspended_at TIMESTAMPTZ;
