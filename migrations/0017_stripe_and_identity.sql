-- Add Stripe subscription tracking columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Add ID verification columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_identity_session_id text;
