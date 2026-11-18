-- Direct ("invited") ratings get their own token, separate from reference_token,
-- so a leaked rating link grants nothing else and can be reset on its own.
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS rating_invite_token text;
