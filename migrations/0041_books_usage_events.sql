-- Books usage log: deliberately thin. A fixed event name, the day (not the
-- time), and the user. No IP, user agent, session or record ids. Deleted with
-- the account; rows older than 24 months are pruned nightly.
CREATE TABLE IF NOT EXISTS books_usage_events (
  id          bigserial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event       text NOT NULL CHECK (event IN ('workbook.downloaded')),
  occurred_on date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS books_usage_events_user_idx ON books_usage_events (user_id, event);
