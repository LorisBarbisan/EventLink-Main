-- Hard bounces and spam complaints from SendGrid stop email to that address.
-- Run BEFORE the code deploys: every query on users selects these columns.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_suppressed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_suppression_reason text;
