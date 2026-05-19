-- Idempotent constraints for users.unsubscribe_token and user_sessions.
-- Safe to run on every deploy; no truncation.

-- Backfill missing unsubscribe tokens
UPDATE users
SET unsubscribe_token = md5(random()::text || id::text || clock_timestamp()::text)
WHERE unsubscribe_token IS NULL;

-- Fix duplicate non-null unsubscribe tokens (keep lowest id per token)
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

-- Add unique constraint once (PostgreSQL names it users_unsubscribe_token_unique)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_unsubscribe_token_unique'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_unsubscribe_token_unique UNIQUE (unsubscribe_token);
  END IF;
END $$;

-- Ensure user_sessions exists (connect-pg-simple / Drizzle)
CREATE TABLE IF NOT EXISTS user_sessions (
  sid varchar NOT NULL,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

-- Add primary key once (connect-pg-simple uses session_pkey even for user_sessions table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'user_sessions'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE user_sessions
      ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON user_sessions (expire);
