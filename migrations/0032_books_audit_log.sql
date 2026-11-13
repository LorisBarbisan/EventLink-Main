-- PR 5: Append-only audit log for books records
-- Tracks who changed what and when on earnings entries, expenses, and mileage trips.

CREATE TABLE IF NOT EXISTS books_audit_log (
  id          SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,   -- 'earnings_entry' | 'expense' | 'mileage_trip'
  entity_id   INTEGER NOT NULL,
  action      TEXT NOT NULL,   -- 'created' | 'updated' | 'archived'
  summary     TEXT NOT NULL,   -- human-readable one-liner
  snapshot    JSONB,           -- full record state after the change
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS books_audit_log_lookup_idx
  ON books_audit_log (freelancer_id, entity_type, entity_id, changed_at DESC);
