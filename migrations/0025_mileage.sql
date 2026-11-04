-- Migration 0025: mileage rates, saved places, mileage trips
-- Run on Neon BEFORE deploying the code that references these tables.

-- ── Mileage rates ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mileage_rates (
  id              SERIAL PRIMARY KEY,
  vehicle_type    TEXT    NOT NULL DEFAULT 'car',
  rate_pence      INTEGER NOT NULL,
  threshold_miles INTEGER,
  rate_above_pence INTEGER,
  effective_from  DATE    NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mileage_rates_vehicle_from_idx
  ON mileage_rates (vehicle_type, effective_from);

-- Seed current HMRC approved mileage rates (effective from 2011-04-06)
INSERT INTO mileage_rates (vehicle_type, rate_pence, threshold_miles, rate_above_pence, effective_from)
VALUES
  ('car',         45, 10000, 25, '2011-04-06'),
  ('motorcycle',  24, NULL,  NULL, '2011-04-06'),
  ('bicycle',      5, NULL,  NULL, '2011-04-06')
ON CONFLICT DO NOTHING;

-- ── Saved places ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_places (
  id            SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         TEXT    NOT NULL,
  address       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_places_freelancer_idx
  ON saved_places (freelancer_id);

-- ── Mileage trips ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mileage_trips (
  id               SERIAL PRIMARY KEY,
  freelancer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_date        DATE    NOT NULL,
  from_place       TEXT    NOT NULL,
  to_place         TEXT    NOT NULL,
  miles            INTEGER NOT NULL,
  purpose          TEXT    NOT NULL,
  vehicle_type     TEXT    NOT NULL DEFAULT 'car',
  amount_pence     INTEGER NOT NULL,
  rate_pence       INTEGER NOT NULL,
  rate_above_pence INTEGER,
  booking_id       INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  notes            TEXT,
  archived         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mileage_trips_freelancer_date_idx
  ON mileage_trips (freelancer_id, trip_date);

CREATE INDEX IF NOT EXISTS mileage_trips_booking_idx
  ON mileage_trips (booking_id);
