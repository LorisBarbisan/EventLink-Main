-- Migration 0026: link job_applications to their earnings entry
-- Run on Neon BEFORE deploying the code that references this column.

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS earnings_entry_id INTEGER
    REFERENCES earnings_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS job_applications_earnings_entry_idx
  ON job_applications (earnings_entry_id);
