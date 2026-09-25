ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS profile_is_public boolean NOT NULL DEFAULT true;
UPDATE freelancer_profiles SET profile_is_public = true WHERE profile_is_public = false;
