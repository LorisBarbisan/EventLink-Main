ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS profile_is_public boolean NOT NULL DEFAULT false;
