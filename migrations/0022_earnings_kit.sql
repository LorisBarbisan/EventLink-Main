-- ── Earnings clients ──────────────────────────────────────────────────────────
CREATE TABLE earnings_clients (
  id               SERIAL PRIMARY KEY,
  freelancer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  normalised_name  TEXT NOT NULL,
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
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT earnings_clients_freelancer_name_unique UNIQUE (freelancer_id, normalised_name)
);
CREATE INDEX earnings_clients_freelancer_idx ON earnings_clients (freelancer_id);

-- ── Earnings roles ────────────────────────────────────────────────────────────
CREATE TABLE earnings_roles (
  id            SERIAL PRIMARY KEY,
  freelancer_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL = system role
  label         TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed system roles (freelancer_id = NULL)
INSERT INTO earnings_roles (freelancer_id, label, sort_order) VALUES
  (NULL, 'Sound Engineer (A1)',      1),
  (NULL, 'Sound Assistant (A2)',     2),
  (NULL, 'Lighting Technician',      3),
  (NULL, 'Lighting Designer',        4),
  (NULL, 'Followspot',               5),
  (NULL, 'Video Engineer',           6),
  (NULL, 'Vision Mixer',             7),
  (NULL, 'Camera Operator',          8),
  (NULL, 'Projectionist',            9),
  (NULL, 'Media Server / Playback',  10),
  (NULL, 'Graphics Operator',        11),
  (NULL, 'Streaming Operator',       12),
  (NULL, 'Broadcast Engineer',       13),
  (NULL, 'AV Technician',            14),
  (NULL, 'IT / Networking',          15),
  (NULL, 'Rigger',                   16),
  (NULL, 'Stagehand',                17),
  (NULL, 'Crew Chief',               18),
  (NULL, 'Set / Scenic',             19),
  (NULL, 'Stage Manager',            20),
  (NULL, 'Show Caller',              21),
  (NULL, 'Floor Manager',            22),
  (NULL, 'Production Manager',       23),
  (NULL, 'Project Manager',          24),
  (NULL, 'Technical Manager',        25),
  (NULL, 'Driver',                   26),
  (NULL, 'Other',                    27);

-- ── Earnings entries ──────────────────────────────────────────────────────────
CREATE TABLE earnings_entries (
  id                      SERIAL PRIMARY KEY,
  freelancer_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id               INTEGER REFERENCES earnings_clients(id) ON DELETE SET NULL,
  role_id                 INTEGER REFERENCES earnings_roles(id) ON DELETE SET NULL,
  source                  TEXT NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('booking','invoice','manual')),
  booking_id              INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  invoice_id              INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  description             TEXT NOT NULL,
  venue                   TEXT,
  work_date               DATE NOT NULL,
  work_end_date           DATE,
  quantity                DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit                    TEXT NOT NULL DEFAULT 'day'
                            CHECK (unit IN ('day','hour','job')),
  unit_amount_pence       BIGINT,
  gross_amount_pence      BIGINT NOT NULL,
  expenses_rebilled_pence BIGINT NOT NULL DEFAULT 0,
  deductions_pence        BIGINT NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'GBP',
  status                  TEXT NOT NULL DEFAULT 'expected'
                            CHECK (status IN ('expected','invoiced','paid','written_off')),
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

CREATE INDEX earnings_entries_freelancer_work_date_idx
  ON earnings_entries (freelancer_id, work_date);
CREATE INDEX earnings_entries_freelancer_paid_date_idx
  ON earnings_entries (freelancer_id, paid_date);
CREATE INDEX earnings_entries_client_idx
  ON earnings_entries (freelancer_id, client_id);
CREATE INDEX earnings_entries_status_idx
  ON earnings_entries (freelancer_id, status);

-- Partial unique indexes prevent double-counting from the same booking/invoice
CREATE UNIQUE INDEX earnings_entries_booking_unique
  ON earnings_entries (booking_id) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX earnings_entries_invoice_unique
  ON earnings_entries (invoice_id) WHERE invoice_id IS NOT NULL;

-- ── Kit items ─────────────────────────────────────────────────────────────────
CREATE TABLE kit_items (
  id                      SERIAL PRIMARY KEY,
  freelancer_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  category                TEXT NOT NULL DEFAULT 'other'
                            CHECK (category IN (
                              'audio','lighting','video','computing','networking',
                              'rigging','cable','case','vehicle','tools','other'
                            )),
  manufacturer            TEXT,
  model                   TEXT,
  serial_number           TEXT,
  quantity                INTEGER NOT NULL DEFAULT 1,
  purchase_date           DATE,
  purchase_price_pence    BIGINT,
  currency                TEXT NOT NULL DEFAULT 'GBP',
  supplier                TEXT,
  funding_method          TEXT NOT NULL DEFAULT 'purchased'
                            CHECK (funding_method IN ('purchased','finance','gift','pre_existing')),
  business_use_percent    INTEGER NOT NULL DEFAULT 100,
  replacement_value_pence BIGINT,
  condition_notes         TEXT,
  status                  TEXT NOT NULL DEFAULT 'in_service'
                            CHECK (status IN ('in_service','sold','disposed','lost','stolen')),
  disposal_date           DATE,
  disposal_proceeds_pence BIGINT,
  disposal_notes          TEXT,
  archived                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX kit_items_freelancer_idx ON kit_items (freelancer_id);
CREATE INDEX kit_items_status_idx ON kit_items (freelancer_id, status);

-- ── Kit item files ────────────────────────────────────────────────────────────
CREATE TABLE kit_item_files (
  id          SERIAL PRIMARY KEY,
  kit_item_id INTEGER NOT NULL REFERENCES kit_items(id) ON DELETE CASCADE,
  file_key    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  INTEGER,
  kind        TEXT NOT NULL DEFAULT 'receipt'
                CHECK (kind IN ('receipt','photo','warranty','other')),
  scan_status TEXT NOT NULL DEFAULT 'pending'
                CHECK (scan_status IN ('pending','safe','unsafe','error')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
