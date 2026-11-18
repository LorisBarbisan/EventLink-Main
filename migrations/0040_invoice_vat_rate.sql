-- VAT on invoices: the rate a VAT-registered freelancer charges, set once in
-- invoice settings and applied to every invoice (20 standard, 5 reduced, 0 zero-rated).
ALTER TABLE freelancer_billing_profiles
  ADD COLUMN IF NOT EXISTS vat_rate_pct integer NOT NULL DEFAULT 20;
