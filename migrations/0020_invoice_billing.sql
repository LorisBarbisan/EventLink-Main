-- Phase 2: Freelancer billing profiles, invoices, and invoice reminders

CREATE TABLE freelancer_billing_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  trading_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postcode TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  utr TEXT,
  company_number TEXT,
  bank_account_name TEXT,
  bank_sort_code TEXT,
  bank_account_number TEXT,
  bank_iban TEXT,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  invoice_footer_note TEXT,
  vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
  vat_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  from_details JSONB NOT NULL,
  to_details JSONB NOT NULL,
  line_items JSONB NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  subtotal_pence BIGINT NOT NULL,
  vat_pence BIGINT NOT NULL DEFAULT 0,
  total_pence BIGINT NOT NULL,
  issue_date DATE,
  due_date DATE,
  sent_at TIMESTAMPTZ,
  sent_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  marked_sent_externally BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  paid_amount_pence BIGINT,
  notes TEXT,
  pdf_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoices_status_check
    CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  CONSTRAINT invoices_number_unique UNIQUE (freelancer_id, invoice_number)
);

CREATE INDEX invoices_freelancer_idx ON invoices (freelancer_id);
CREATE INDEX invoices_status_idx ON invoices (status);
CREATE INDEX invoices_due_date_idx ON invoices (due_date) WHERE status IN ('sent','overdue');
CREATE UNIQUE INDEX invoices_booking_unique ON invoices (booking_id) WHERE booking_id IS NOT NULL;

CREATE TABLE invoice_reminders (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  action TEXT NOT NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  actioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoice_reminders_stage_check
    CHECK (stage IN ('due_soon','overdue_1','overdue_7','overdue_14','final')),
  CONSTRAINT invoice_reminders_action_check
    CHECK (action IN ('sent','copied','dismissed','snoozed')),
  CONSTRAINT invoice_reminders_stage_unique UNIQUE (invoice_id, stage)
);
