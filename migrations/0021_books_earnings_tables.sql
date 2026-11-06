-- Migration: create Books-tab earnings/expenses tables
-- Run this on Neon BEFORE deploying code that uses these tables.

-- ── earnings_clients ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS earnings_clients (
  id               SERIAL PRIMARY KEY,
  freelancer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  normalised_name  TEXT    NOT NULL,
  employer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  contact_name     TEXT,
  contact_email    TEXT,
  address_line1    TEXT,
  city             TEXT,
  postcode         TEXT,
  country          TEXT,
  notes            TEXT,
  archived         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS earnings_clients_freelancer_name_unique
  ON earnings_clients (freelancer_id, normalised_name);
CREATE INDEX IF NOT EXISTS earnings_clients_freelancer_idx
  ON earnings_clients (freelancer_id);

-- ── earnings_roles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS earnings_roles (
  id            SERIAL PRIMARY KEY,
  freelancer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  label         TEXT    NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── earnings_entries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS earnings_entries (
  id                      SERIAL PRIMARY KEY,
  freelancer_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id               INTEGER REFERENCES earnings_clients(id) ON DELETE SET NULL,
  role_id                 INTEGER REFERENCES earnings_roles(id)   ON DELETE SET NULL,
  source                  TEXT NOT NULL DEFAULT 'manual',
  booking_id              INTEGER REFERENCES bookings(id)  ON DELETE SET NULL,
  invoice_id              INTEGER REFERENCES invoices(id)  ON DELETE SET NULL,
  description             TEXT NOT NULL,
  venue                   TEXT,
  work_date               DATE NOT NULL,
  work_end_date           DATE,
  quantity                NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit                    TEXT NOT NULL DEFAULT 'day',
  unit_amount_pence       BIGINT,
  gross_amount_pence      BIGINT NOT NULL,
  expenses_rebilled_pence BIGINT NOT NULL DEFAULT 0,
  deductions_pence        BIGINT NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'GBP',
  status                  TEXT NOT NULL DEFAULT 'expected',
  invoiced_date           DATE,
  paid_date               DATE,
  paid_amount_pence       BIGINT,
  needs_review            BOOLEAN NOT NULL DEFAULT FALSE,
  rate_raw                TEXT,
  notes                   TEXT,
  archived                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS earnings_entries_freelancer_work_date_idx
  ON earnings_entries (freelancer_id, work_date);
CREATE INDEX IF NOT EXISTS earnings_entries_freelancer_paid_date_idx
  ON earnings_entries (freelancer_id, paid_date);
CREATE INDEX IF NOT EXISTS earnings_entries_client_idx
  ON earnings_entries (freelancer_id, client_id);
CREATE INDEX IF NOT EXISTS earnings_entries_status_idx
  ON earnings_entries (freelancer_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS earnings_entries_booking_unique
  ON earnings_entries (booking_id) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS earnings_entries_invoice_unique
  ON earnings_entries (invoice_id) WHERE invoice_id IS NOT NULL;

-- ── expense_categories ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  id              SERIAL PRIMARY KEY,
  freelancer_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  normalised_name TEXT    NOT NULL,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expense_categories_freelancer_idx
  ON expense_categories (freelancer_id);
CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_freelancer_name_unique
  ON expense_categories (freelancer_id, normalised_name);

-- ── expenses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                   SERIAL PRIMARY KEY,
  freelancer_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id          INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  booking_id           INTEGER REFERENCES bookings(id)       ON DELETE SET NULL,
  earnings_entry_id    INTEGER REFERENCES earnings_entries(id) ON DELETE SET NULL,
  source               TEXT    NOT NULL DEFAULT 'manual',
  supplier             TEXT,
  description          TEXT    NOT NULL,
  expense_date         DATE    NOT NULL,
  net_amount_pence     BIGINT  NOT NULL,
  vat_amount_pence     BIGINT  NOT NULL DEFAULT 0,
  currency             TEXT    NOT NULL DEFAULT 'GBP',
  payment_method       TEXT,
  business_use_percent INTEGER NOT NULL DEFAULT 100,
  billable_to_client   BOOLEAN NOT NULL DEFAULT FALSE,
  rebilled             BOOLEAN NOT NULL DEFAULT FALSE,
  notes                TEXT,
  archived             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expenses_freelancer_date_idx
  ON expenses (freelancer_id, expense_date);
CREATE INDEX IF NOT EXISTS expenses_freelancer_category_idx
  ON expenses (freelancer_id, category_id);
CREATE INDEX IF NOT EXISTS expenses_booking_idx
  ON expenses (booking_id);
CREATE INDEX IF NOT EXISTS expenses_billable_idx
  ON expenses (freelancer_id, billable_to_client);

-- ── Add FK column to job_applications ────────────────────────────────────────
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS earnings_entry_id INTEGER REFERENCES earnings_entries(id) ON DELETE SET NULL;
