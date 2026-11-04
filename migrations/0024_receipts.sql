-- ── Receipts ──────────────────────────────────────────────────────────────────
-- ocr_status and ocr_payload are added now so E7 (OCR) requires no migration
-- on live data. expense_id is nullable — receipts can be captured unattached
-- and linked to an expense later (the "inbox" pattern).

CREATE TABLE receipts (
  id            SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expense_id    INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
  file_key      TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ocr_status    TEXT NOT NULL DEFAULT 'none'
                  CHECK (ocr_status IN ('none','pending','done','failed')),
  ocr_payload   JSONB,
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX receipts_freelancer_idx    ON receipts (freelancer_id, captured_at);
CREATE INDEX receipts_expense_idx       ON receipts (expense_id);
CREATE INDEX receipts_unattached_idx    ON receipts (freelancer_id, expense_id);
