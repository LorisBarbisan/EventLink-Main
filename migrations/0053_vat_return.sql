-- VAT return (VAT epic PR 3). Additive only: safe to run before the code
-- deploys, and repeated in server/api/utils/ensure-additive-schema.ts.

-- How a VAT-registered freelancer accounts for VAT. Defaults to standard
-- (invoice) accounting, HMRC's default; flat_rate reclaims no input VAT.
ALTER TABLE freelancer_billing_profiles
  ADD COLUMN IF NOT EXISTS vat_scheme text NOT NULL DEFAULT 'standard';
-- HMRC quarter pattern: 1 = Mar/Jun/Sep/Dec, 2 = Apr/Jul/Oct/Jan, 3 = May/Aug/Nov/Feb
ALTER TABLE freelancer_billing_profiles
  ADD COLUMN IF NOT EXISTS vat_stagger integer NOT NULL DEFAULT 1;
-- Flat Rate Scheme percentage in basis points (1250 = 12.5%)
ALTER TABLE freelancer_billing_profiles
  ADD COLUMN IF NOT EXISTS vat_flat_rate_bp integer;

-- What was actually paid to (positive) or received from (negative) HMRC per quarter
CREATE TABLE IF NOT EXISTS vat_payments (
  id serial PRIMARY KEY,
  freelancer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_pence bigint NOT NULL,
  paid_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vat_payments_freelancer_period_key
  ON vat_payments (freelancer_id, period_end);
