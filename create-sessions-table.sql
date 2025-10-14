-- Create user_sessions table for production deployment
-- Run this SQL in your production database via the Database pane

CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
) WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON user_sessions ("expire");

-- Verify table was created
SELECT 'user_sessions table created successfully!' AS status;
