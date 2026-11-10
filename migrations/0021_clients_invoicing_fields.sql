-- PR 1: Saved clients for invoicing
-- Additive only — safe to run before or after deploy.

ALTER TABLE "earnings_clients"
  ADD COLUMN IF NOT EXISTS "address_line2"       text,
  ADD COLUMN IF NOT EXISTS "accounts_email"      text,
  ADD COLUMN IF NOT EXISTS "payment_terms_days"  integer,
  ADD COLUMN IF NOT EXISTS "requires_po"         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "vat_number"          text;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "po_number" text;
