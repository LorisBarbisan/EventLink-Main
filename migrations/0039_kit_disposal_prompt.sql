-- "Sold it?" can be answered no, like the purchase offer (QA 2.4).
-- Additive and idempotent; a NOT NULL column with a default does not rewrite
-- the table on modern Postgres.
ALTER TABLE kit_items
  ADD COLUMN IF NOT EXISTS disposal_prompt_dismissed boolean NOT NULL DEFAULT false;
