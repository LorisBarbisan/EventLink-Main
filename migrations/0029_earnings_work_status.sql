-- Migration: add work_status, call_time, venue_address to earnings_entries
-- Run on Neon BEFORE deploying code that uses these columns.
--
-- work_status IS NULL   → ordinary earnings line (imported, invoice-derived)
-- work_status IS NOT NULL → scheduled piece of work (appears on calendar + My Jobs)

ALTER TABLE earnings_entries
  ADD COLUMN IF NOT EXISTS work_status   TEXT
    CHECK (work_status IN ('pencilled','confirmed','completed','cancelled')),
  ADD COLUMN IF NOT EXISTS call_time     TEXT,
  ADD COLUMN IF NOT EXISTS venue_address TEXT;

CREATE INDEX IF NOT EXISTS earnings_work_status_date_idx
  ON earnings_entries (freelancer_id, work_status, work_date)
  WHERE work_status IS NOT NULL;
