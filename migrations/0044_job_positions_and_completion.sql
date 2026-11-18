-- Crew count and job completion.
-- positions: how many people the job needs. Filled is never stored — it is the
-- count of hired applications. Existing jobs default to 1, which is what they
-- have always meant.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS positions integer NOT NULL DEFAULT 1;
-- Job-level completion (the posting, not the bookings), and the day the
-- employer last answered "Not yet" to the day-after prompt.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_snoozed_on date;
