-- Changing your email address: the new address waits here until the link
-- sent to it is opened. Run BEFORE the code deploys: queries on users select
-- these columns. (Also applied on boot by ensureAdditiveSchema.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_expires timestamptz;
