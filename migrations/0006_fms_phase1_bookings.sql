-- ============================================================
-- FMS Phase 1 — Booking Confirmation Workflow
-- Drop into: migrations/0006_fms_phase1_bookings.sql
-- ============================================================

-- Booking status workflow:
-- enquired → confirmed → briefed → completed → (cancelled at any point)

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" serial PRIMARY KEY NOT NULL,
  "job_id" integer NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "employer_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "freelancer_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'enquired',
  -- Status values: enquired | confirmed | briefed | completed | cancelled
  "agreed_rate" text,
  -- What was actually agreed (may differ from posted rate)
  "call_time" text,
  -- e.g. "08:00"
  "venue_address" text,
  -- Specific venue address if different from job location
  "employer_notes" text,
  -- Private notes visible to employer only
  "cancellation_reason" text,
  -- Populated when status = cancelled
  "cancelled_by" text,
  -- 'employer' | 'freelancer'
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Prevent duplicate bookings for the same job+freelancer pair
  CONSTRAINT "bookings_job_freelancer_unique" UNIQUE ("job_id", "freelancer_id")
);

-- Index for fast employer dashboard queries
CREATE INDEX IF NOT EXISTS "bookings_employer_id_idx" ON "bookings"("employer_id");
CREATE INDEX IF NOT EXISTS "bookings_freelancer_id_idx" ON "bookings"("freelancer_id");
CREATE INDEX IF NOT EXISTS "bookings_job_id_idx" ON "bookings"("job_id");
CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings"("status");

-- ============================================================
-- Booking status history — audit trail of every status change
-- ============================================================
CREATE TABLE IF NOT EXISTS "booking_status_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "from_status" text,
  "to_status" text NOT NULL,
  "changed_by_id" integer NOT NULL REFERENCES "users"("id"),
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "booking_history_booking_id_idx" ON "booking_status_history"("booking_id");
