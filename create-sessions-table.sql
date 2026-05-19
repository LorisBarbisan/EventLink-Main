-- Legacy one-off: `user_sessions` is defined in shared/schema.ts for Drizzle.
-- Prefer: npm run db:fix-constraints (runs on deploy) then npm run db:push.
-- Use this file only if you need raw SQL in a host that does not run Drizzle push.

CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
) WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON user_sessions ("expire");

-- Verify table was created
SELECT 'user_sessions table created successfully!' AS status;
