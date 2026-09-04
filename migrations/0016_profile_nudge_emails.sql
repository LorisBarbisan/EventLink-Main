CREATE TABLE IF NOT EXISTS profile_nudge_emails (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  nudge_1_sent_at timestamptz,
  nudge_2_sent_at timestamptz,
  nudge_3_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
