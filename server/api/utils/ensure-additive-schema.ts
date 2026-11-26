import { sql } from "drizzle-orm";
import { db } from "../config/db";

// Additive, idempotent schema statements run on every boot BEFORE any query, so
// a deploy can never be ahead of the database. When Drizzle selects a column the
// DB doesn't have yet, every read/write on that table errors (rows look like
// they've "disappeared" and inserts fail) — this guard closes that gap.
//
// Schema lives in shared/schema.ts and the numbered files in migrations/ (run
// on Neon before the deploy). This list only REPEATS them as a safety net —
// never the only place a table or column exists (ensure-additive-schema.test.ts
// enforces that for tables).
//
// ONLY `ADD COLUMN` / `CREATE TABLE` / `CREATE INDEX ... IF NOT EXISTS`. Never a
// drop or a destructive change. Keep this list in step with new columns/tables
// added to shared/schema.ts; anything already applied is a cheap no-op.
const STATEMENTS = [
  // Direct offers ("Send me a job")
  `ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS accepts_direct_offers boolean NOT NULL DEFAULT true`,
  // Direct offers — freelancer can report an abusive offer
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reported_at timestamptz`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS report_reason text`,
  // Credential register (Epic 1)
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS issuing_body text`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS reference_number text`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS issue_date date`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS expiry_date date`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS expiry_source text`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'document_on_file'`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS superseded_by_id integer`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS archived_at timestamptz`,
  `CREATE INDEX IF NOT EXISTS freelancer_documents_expiry_idx ON freelancer_documents (expiry_date)`,
  // Renewal reminders (Epic 2)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS credential_reminders_opt_out boolean NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS credential_reminders (
     id serial PRIMARY KEY,
     document_id integer NOT NULL REFERENCES freelancer_documents(id) ON DELETE CASCADE,
     stage text NOT NULL,
     sent_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credential_reminders_doc_stage_idx ON credential_reminders (document_id, stage)`,
  `CREATE TABLE IF NOT EXISTS credential_backfill_campaign (
     id serial PRIMARY KEY,
     user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
     round1_sent_at timestamptz,
     round2_sent_at timestamptz
   )`,
  // Job soft-delete: deleting a job marks it deleted instead of removing the
  // row, so applicants keep their application history (job_applications.job_id
  // cascades on a hard delete).
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz`,
  // Import pipeline (Historical accounts import epic)
  `CREATE TABLE IF NOT EXISTS import_batches (
     id serial PRIMARY KEY,
     freelancer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     source text NOT NULL DEFAULT 'unknown',
     file_key text NOT NULL,
     file_name text NOT NULL,
     mime_type text NOT NULL,
     size_bytes integer NOT NULL,
     status text NOT NULL DEFAULT 'uploaded',
     full_fidelity_from date,
     date_format text,
     period_start date,
     period_end date,
     row_count integer NOT NULL DEFAULT 0,
     committed_count integer NOT NULL DEFAULT 0,
     parse_job_id text,
     parse_started_at timestamptz,
     parse_completed_at timestamptz,
     parse_progress integer NOT NULL DEFAULT 0,
     error text,
     committed_at timestamptz,
     rolled_back_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS import_batches_freelancer_idx ON import_batches (freelancer_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS import_batches_status_idx ON import_batches (status)`,
  `CREATE TABLE IF NOT EXISTS import_rows (
     id serial PRIMARY KEY,
     batch_id integer NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
     row_number integer NOT NULL,
     raw jsonb NOT NULL,
     parsed jsonb,
     target text,
     confidence integer,
     issues jsonb,
     decision text NOT NULL DEFAULT 'pending',
     created_record_table text,
     created_record_id integer,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS import_rows_batch_idx ON import_rows (batch_id, row_number)`,
  `CREATE INDEX IF NOT EXISTS import_rows_decision_idx ON import_rows (batch_id, decision)`,
  // PR 1 — Saved clients for invoicing
  `ALTER TABLE earnings_clients ADD COLUMN IF NOT EXISTS address_line2 text`,
  `ALTER TABLE earnings_clients ADD COLUMN IF NOT EXISTS accounts_email text`,
  `ALTER TABLE earnings_clients ADD COLUMN IF NOT EXISTS payment_terms_days integer`,
  `ALTER TABLE earnings_clients ADD COLUMN IF NOT EXISTS requires_po boolean NOT NULL DEFAULT false`,
  `ALTER TABLE earnings_clients ADD COLUMN IF NOT EXISTS vat_number text`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_number text`,
  // Migration 0050 — email suppression (bounces / complaints)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_suppressed_at timestamptz`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_suppression_reason text`,
  // Migration 0051 — changing your email address
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_token text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_expires timestamptz`,
  // Migration 0047 — hot-table indexes. CONCURRENTLY so a boot never blocks
  // writes; each statement runs on its own (not in a transaction), which
  // CONCURRENTLY requires. A no-op once the migration has been run on Neon.
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS job_applications_job_status_idx ON job_applications (job_id, status)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS job_applications_freelancer_idx ON job_applications (freelancer_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at)`,
  // Migration 0046 — receipt capture fields and two usage events
  `ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_date date`,
  `ALTER TABLE receipts ADD COLUMN IF NOT EXISTS note text`,
  `ALTER TABLE books_usage_events DROP CONSTRAINT IF EXISTS books_usage_events_event_check`,
  `ALTER TABLE books_usage_events ADD CONSTRAINT books_usage_events_event_check CHECK (event IN ('workbook.downloaded', 'receipt.captured', 'receipt.filed'))`,
  // Migration 0045 — opt-in public calendar
  `ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS show_calendar_publicly boolean NOT NULL DEFAULT false`,
  // Migration 0044 — crew count and job completion
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS positions integer NOT NULL DEFAULT 1`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at timestamptz`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_snoozed_on date`,
  // Migration 0043 — reporting and blocking a person
  `CREATE TABLE IF NOT EXISTS user_reports (
     id serial PRIMARY KEY,
     reporter_id integer REFERENCES users(id) ON DELETE SET NULL,
     subject_id integer NOT NULL,
     subject_name text,
     category text NOT NULL CHECK (category IN ('unsafe_site','unpaid','no_show','abusive_messages','credentials_mismatch','other')),
     details text,
     conversation_id integer,
     booking_id integer,
     status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','actioned','dismissed')),
     admin_notes text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS user_reports_subject_idx ON user_reports (subject_id)`,
  `CREATE INDEX IF NOT EXISTS user_reports_status_idx ON user_reports (status, created_at)`,
  `CREATE TABLE IF NOT EXISTS user_blocks (
     blocker_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     blocked_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (blocker_id, blocked_id)
   )`,
  `CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks (blocked_id)`,
  // Migration 0042 — separate token for direct rating links
  `ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS rating_invite_token text`,
  // Migration 0041 — Books usage log (thin: fixed event, day only)
  `CREATE TABLE IF NOT EXISTS books_usage_events (
     id bigserial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     event text NOT NULL CHECK (event IN ('workbook.downloaded')),
     occurred_on date NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS books_usage_events_user_idx ON books_usage_events (user_id, event)`,
  // Migration 0040 — VAT rate on invoices
  `ALTER TABLE freelancer_billing_profiles ADD COLUMN IF NOT EXISTS vat_rate_pct integer NOT NULL DEFAULT 20`,
  // PR 2 — job selector on mileage
  `ALTER TABLE mileage_trips ADD COLUMN IF NOT EXISTS earnings_entry_id integer REFERENCES earnings_entries(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS mileage_trips_earnings_entry_idx ON mileage_trips (earnings_entry_id)`,
  // Invoice → job link: job board applications don't create a bookings row,
  // so store the job_id directly for the briefcase icon in InvoicesTab.
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_id integer REFERENCES jobs(id) ON DELETE SET NULL`,
  // PR 3 — Time and overtime
  `ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS standard_hours_per_day integer`,
  `ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS overtime_rate_pence integer`,
  // Confirmed overtime hours (migration 0054) — overrides the logged calculation
  `ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS overtime_hours_confirmed numeric(6,2)`,
  `CREATE TABLE IF NOT EXISTS job_time_entries (
     id serial PRIMARY KEY,
     freelancer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     earnings_entry_id integer NOT NULL REFERENCES earnings_entries(id) ON DELETE CASCADE,
     work_date date NOT NULL,
     start_time text NOT NULL,
     finish_time text NOT NULL,
     break_minutes integer NOT NULL DEFAULT 0,
     notes text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS job_time_freelancer_date_idx ON job_time_entries (freelancer_id, work_date)`,
  `CREATE INDEX IF NOT EXISTS job_time_entry_idx ON job_time_entries (earnings_entry_id)`,
  // Gigs epic (migration 0029): scheduled-gig fields on earnings_entries
  `ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS work_status text`,
  `ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS call_time text`,
  `ALTER TABLE earnings_entries ADD COLUMN IF NOT EXISTS venue_address text`,
  `CREATE TABLE IF NOT EXISTS import_mappings (
     id serial PRIMARY KEY,
     freelancer_id integer REFERENCES users(id) ON DELETE CASCADE,
     signature text NOT NULL,
     source text NOT NULL,
     column_map jsonb NOT NULL,
     category_map jsonb,
     is_system boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  // VAT return (migration 0053)
  `ALTER TABLE freelancer_billing_profiles ADD COLUMN IF NOT EXISTS vat_scheme text NOT NULL DEFAULT 'standard'`,
  `ALTER TABLE freelancer_billing_profiles ADD COLUMN IF NOT EXISTS vat_stagger integer NOT NULL DEFAULT 1`,
  `ALTER TABLE freelancer_billing_profiles ADD COLUMN IF NOT EXISTS vat_flat_rate_bp integer`,
  `CREATE TABLE IF NOT EXISTS vat_payments (
     id serial PRIMARY KEY,
     freelancer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     period_start date NOT NULL,
     period_end date NOT NULL,
     amount_pence bigint NOT NULL,
     paid_date date NOT NULL,
     notes text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vat_payments_freelancer_period_key ON vat_payments (freelancer_id, period_end)`,
];

export async function ensureAdditiveSchema(): Promise<void> {
  let ok = 0;
  for (const stmt of STATEMENTS) {
    try {
      await db.execute(sql.raw(stmt));
      ok++;
    } catch (err) {
      // Log loudly but keep going: one statement failing shouldn't block the
      // rest, and the statements are idempotent so the next boot retries.
      console.error(
        "❌ ensureAdditiveSchema statement failed:",
        stmt.replace(/\s+/g, " ").trim().slice(0, 90),
        err
      );
    }
  }
  console.log(`✅ ensureAdditiveSchema: ${ok}/${STATEMENTS.length} additive statements ensured.`);
}
