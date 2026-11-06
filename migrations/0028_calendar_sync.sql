-- Migration: calendar sync tables
-- Run on Neon BEFORE deploying code that uses these tables.

-- ── calendar_connections ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_connections (
  id                       SERIAL PRIMARY KEY,
  user_id                  INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider                 TEXT    NOT NULL CHECK (provider IN ('google', 'outlook')),

  -- tokens stored as AES-256-GCM ciphertext (iv:tag:ciphertext, base64)
  access_token_encrypted   TEXT    NOT NULL,
  refresh_token_encrypted  TEXT,
  token_expires_at         TIMESTAMPTZ,
  calendar_id              TEXT,

  -- read path: incremental-sync cursors and webhook registration
  sync_token               TEXT,
  delta_link               TEXT,
  webhook_channel_id       TEXT,
  webhook_resource_id      TEXT,
  webhook_subscription_id  TEXT,
  webhook_expires_at       TIMESTAMPTZ,
  last_read_sync_at        TIMESTAMPTZ,
  last_write_sync_at       TIMESTAMPTZ,

  -- provider-issued event id for each booking (JSON map bookingId → eventId)
  booking_event_ids        JSONB   NOT NULL DEFAULT '{}',

  -- user preferences
  push_bookings            BOOLEAN NOT NULL DEFAULT TRUE,
  push_availability        BOOLEAN NOT NULL DEFAULT TRUE,
  read_external            BOOLEAN NOT NULL DEFAULT TRUE,

  status                   TEXT    NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'needs_reconnect', 'error')),
  last_error               TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calendar_connections_user_idx
  ON calendar_connections (user_id);
CREATE INDEX IF NOT EXISTS calendar_connections_webhook_expiry_idx
  ON calendar_connections (webhook_expires_at);

-- ── freelancer_date_availability ──────────────────────────────────────────────
-- Day-granularity availability blocks freelancers mark in their EventLink calendar.
CREATE TABLE IF NOT EXISTS freelancer_date_availability (
  id            SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE    NOT NULL,  -- stored as proper DATE, not text
  status        TEXT    NOT NULL CHECK (status IN ('available', 'tentative', 'unavailable')),
  note          TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS fda_freelancer_date_unique
  ON freelancer_date_availability (freelancer_id, date);
CREATE INDEX IF NOT EXISTS fda_freelancer_date_idx
  ON freelancer_date_availability (freelancer_id, date);
