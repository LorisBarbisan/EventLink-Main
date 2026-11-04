-- ── Expense categories ────────────────────────────────────────────────────────
-- null freelancer_id = system seed category, visible to everyone.

CREATE TABLE expense_categories (
  id               SERIAL PRIMARY KEY,
  freelancer_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  normalised_name  TEXT NOT NULL,
  is_system        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  archived         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX expense_categories_freelancer_idx
  ON expense_categories (freelancer_id);

-- Partial unique index: per-freelancer uniqueness, plus system-category uniqueness
-- (freelancer_id IS NULL rows form their own distinct unique set via NULL != NULL,
--  so we enforce system uniqueness with a separate WHERE IS NULL index.)
CREATE UNIQUE INDEX expense_categories_freelancer_name_unique
  ON expense_categories (freelancer_id, normalised_name)
  WHERE freelancer_id IS NOT NULL;

CREATE UNIQUE INDEX expense_categories_system_name_unique
  ON expense_categories (normalised_name)
  WHERE freelancer_id IS NULL;

-- Seed system categories (built for event-crew trade, not generic accounting)
INSERT INTO expense_categories
  (freelancer_id, name, normalised_name, is_system, sort_order)
VALUES
  (NULL, 'Travel and parking',               'travel and parking',               TRUE,  1),
  (NULL, 'Accommodation',                     'accommodation',                     TRUE,  2),
  (NULL, 'Subsistence',                       'subsistence',                       TRUE,  3),
  (NULL, 'Tools and consumables',             'tools and consumables',             TRUE,  4),
  (NULL, 'PPE',                               'ppe',                               TRUE,  5),
  (NULL, 'Kit hire',                          'kit hire',                          TRUE,  6),
  (NULL, 'Insurance',                         'insurance',                         TRUE,  7),
  (NULL, 'Professional subscriptions',        'professional subscriptions',        TRUE,  8),
  (NULL, 'Training and certification',        'training and certification',        TRUE,  9),
  (NULL, 'Phone and data',                    'phone and data',                    TRUE, 10),
  (NULL, 'Software',                          'software',                          TRUE, 11),
  (NULL, 'Accountancy and professional fees', 'accountancy and professional fees', TRUE, 12),
  (NULL, 'Bank charges',                      'bank charges',                      TRUE, 13),
  (NULL, 'Other',                             'other',                             TRUE, 14);

-- ── Expenses ──────────────────────────────────────────────────────────────────

CREATE TABLE expenses (
  id                   SERIAL PRIMARY KEY,
  freelancer_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id          INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  booking_id           INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  earnings_entry_id    INTEGER REFERENCES earnings_entries(id) ON DELETE SET NULL,
  source               TEXT NOT NULL DEFAULT 'manual'
                         CHECK (source IN ('manual','receipt','bank')),
  supplier             TEXT,
  description          TEXT NOT NULL,
  expense_date         DATE NOT NULL,
  net_amount_pence     BIGINT NOT NULL,
  vat_amount_pence     BIGINT NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'GBP',
  payment_method       TEXT CHECK (payment_method IN ('card','cash','bank_transfer','other')),
  business_use_percent INTEGER NOT NULL DEFAULT 100,
  billable_to_client   BOOLEAN NOT NULL DEFAULT FALSE,
  rebilled             BOOLEAN NOT NULL DEFAULT FALSE,
  notes                TEXT,
  archived             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX expenses_freelancer_date_idx
  ON expenses (freelancer_id, expense_date);
CREATE INDEX expenses_freelancer_category_idx
  ON expenses (freelancer_id, category_id);
CREATE INDEX expenses_booking_idx
  ON expenses (booking_id);
CREATE INDEX expenses_billable_idx
  ON expenses (freelancer_id, billable_to_client);
