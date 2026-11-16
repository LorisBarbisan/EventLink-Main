-- Link a kit item to the expense that recorded its purchase and to the
-- earnings entry that recorded its sale. Links only: kit values never feed
-- totals directly, so nothing is counted twice. Additive and idempotent.

ALTER TABLE kit_items
  ADD COLUMN IF NOT EXISTS expense_id integer
    REFERENCES expenses(id) ON DELETE SET NULL;

ALTER TABLE kit_items
  ADD COLUMN IF NOT EXISTS disposal_entry_id integer
    REFERENCES earnings_entries(id) ON DELETE SET NULL;

-- "No, already recorded" is remembered separately from a link, so the
-- purchase prompt is offered once and not again.
ALTER TABLE kit_items
  ADD COLUMN IF NOT EXISTS expense_prompt_dismissed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS kit_items_expense_idx ON kit_items (expense_id);
CREATE INDEX IF NOT EXISTS kit_items_disposal_entry_idx ON kit_items (disposal_entry_id);
