-- Phone receipt capture: the date the receipt is for (editable, defaults to
-- the day it was photographed) and an optional note. Amount, category and job
-- are filled in later, at a desk, when the receipt is filed as an expense.
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_date date;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS note text;

-- Two more usage events: a receipt captured into the inbox, and one filed
-- onto an expense. Together they show whether the inbox gets emptied.
ALTER TABLE books_usage_events DROP CONSTRAINT IF EXISTS books_usage_events_event_check;
ALTER TABLE books_usage_events ADD CONSTRAINT books_usage_events_event_check
  CHECK (event IN ('workbook.downloaded', 'receipt.captured', 'receipt.filed'));
