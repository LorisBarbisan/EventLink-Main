-- Add logo_url to billing profiles for invoice header customisation
ALTER TABLE freelancer_billing_profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
