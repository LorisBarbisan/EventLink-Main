-- Reporting and blocking a person.
--
-- user_reports deliberately has NO foreign key on subject_id: a report must
-- survive the subject deleting their account, or the pattern across reports
-- disappears exactly when it matters (legitimate interest: safety records).
-- The reporter's id is set to NULL if the reporter deletes their account.
CREATE TABLE IF NOT EXISTS user_reports (
  id              serial PRIMARY KEY,
  reporter_id     integer REFERENCES users(id) ON DELETE SET NULL,
  subject_id      integer NOT NULL,
  subject_name    text,
  category        text NOT NULL CHECK (category IN
                    ('unsafe_site','unpaid','no_show','abusive_messages','credentials_mismatch','other')),
  details         text,
  conversation_id integer,
  booking_id      integer,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','actioned','dismissed')),
  admin_notes     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_reports_subject_idx ON user_reports (subject_id);
CREATE INDEX IF NOT EXISTS user_reports_status_idx ON user_reports (status, created_at);

-- A block stops new messages in both directions. Neither person is told.
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks (blocked_id);
