-- Same as scripts/apply-idempotent-constraints.sql (for manual / migrate use).
-- See scripts/apply-idempotent-constraints.ts (runs automatically on deploy via post-merge.sh).

UPDATE users
SET unsubscribe_token = md5(random()::text || id::text || clock_timestamp()::text)
WHERE unsubscribe_token IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY unsubscribe_token ORDER BY id) AS rn
  FROM users
  WHERE unsubscribe_token IS NOT NULL
)
UPDATE users u
SET unsubscribe_token = md5(random()::text || u.id::text || clock_timestamp()::text)
FROM ranked r
WHERE u.id = r.id AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_unsubscribe_token_unique'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_unsubscribe_token_unique UNIQUE (unsubscribe_token);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_sessions (
  sid varchar NOT NULL,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'user_sessions' AND c.contype = 'p'
  ) THEN
    ALTER TABLE user_sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON user_sessions (expire);
