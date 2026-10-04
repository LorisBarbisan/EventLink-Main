-- Pro subscription fields on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier        text         DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expires_at  timestamptz;

-- Vanity URL slug on freelancer_profiles
ALTER TABLE freelancer_profiles
  ADD COLUMN IF NOT EXISTS custom_slug    text,
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS contact_email  text;

CREATE UNIQUE INDEX IF NOT EXISTS freelancer_profiles_custom_slug_idx
  ON freelancer_profiles (custom_slug)
  WHERE custom_slug IS NOT NULL;

-- Portfolio posts table (kept in schema even though UI is not exposed)
CREATE TABLE IF NOT EXISTS portfolio_posts (
  id          serial       PRIMARY KEY,
  user_id     integer      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text         NOT NULL,
  description text,
  image_url   text,
  link_url    text,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_posts_user_id_idx ON portfolio_posts (user_id);
