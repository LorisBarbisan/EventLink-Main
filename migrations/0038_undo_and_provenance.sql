-- Undo and provenance for earnings and expenses. Additive and idempotent.
--
-- archived_at / archived_by_batch_id: rollback and "start again" archive rather
-- than delete; a nightly sweep hard-deletes rows archived more than 30 days ago.
-- import_batch_id + source 'imported': an imported record says so, and keeps
-- saying so if its batch record is later deleted (ON DELETE SET NULL).

ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS archived_by_batch_id integer
  REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS import_batch_id integer
  REFERENCES import_batches(id) ON DELETE SET NULL;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS archived_by_batch_id integer
  REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS import_batch_id integer
  REFERENCES import_batches(id) ON DELETE SET NULL;

-- expenses.source has a CHECK constraint; widen it to allow 'imported'.
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_source_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_source_check
  CHECK (source IN ('manual', 'receipt', 'bank', 'imported'));

-- earnings_entries.source has one too (migration 0022).
ALTER TABLE earnings_entries DROP CONSTRAINT IF EXISTS earnings_entries_source_check;
ALTER TABLE earnings_entries ADD CONSTRAINT earnings_entries_source_check
  CHECK (source IN ('booking', 'invoice', 'manual', 'imported'));

-- Backfill provenance from import_rows while the links still exist.
UPDATE earnings_entries e
SET source = 'imported', import_batch_id = r.batch_id
FROM import_rows r
WHERE r.created_record_table = 'earnings_entries'
  AND r.created_record_id = e.id
  AND e.import_batch_id IS NULL;

UPDATE expenses x
SET source = 'imported', import_batch_id = r.batch_id
FROM import_rows r
WHERE r.created_record_table = 'expenses'
  AND r.created_record_id = x.id
  AND x.import_batch_id IS NULL;

CREATE INDEX IF NOT EXISTS earnings_entries_import_batch_idx ON earnings_entries (import_batch_id);
CREATE INDEX IF NOT EXISTS expenses_import_batch_idx ON expenses (import_batch_id);
CREATE INDEX IF NOT EXISTS earnings_entries_archived_at_idx ON earnings_entries (archived_at)
  WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS expenses_archived_at_idx ON expenses (archived_at)
  WHERE archived_at IS NOT NULL;
