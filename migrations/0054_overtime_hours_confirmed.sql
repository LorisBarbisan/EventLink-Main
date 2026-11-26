-- Confirmed overtime hours on a job. Additive only: safe to run before the code
-- deploys, and repeated in server/api/utils/ensure-additive-schema.ts.
--
-- When set, this figure is what the job bills for overtime (cards, invoices),
-- in place of the hours worked out from the logged days.

ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS overtime_hours_confirmed numeric(6,2);
