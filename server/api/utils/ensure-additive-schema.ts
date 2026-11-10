import { sql } from "drizzle-orm";
import { db } from "../config/db";

// Additive, idempotent schema statements run on every boot BEFORE any query, so
// a deploy can never be ahead of the database. When Drizzle selects a column the
// DB doesn't have yet, every read/write on that table errors (rows look like
// they've "disappeared" and inserts fail) — this guard closes that gap.
//
// ONLY `ADD COLUMN` / `CREATE TABLE` / `CREATE INDEX ... IF NOT EXISTS`. Never a
// drop or a destructive change. Keep this list in step with new columns/tables
// added to shared/schema.ts; anything already applied is a cheap no-op.
const STATEMENTS = [
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
  // PR 2 — job selector on mileage
  `ALTER TABLE mileage_trips ADD COLUMN IF NOT EXISTS earnings_entry_id integer REFERENCES earnings_entries(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS mileage_trips_earnings_entry_idx ON mileage_trips (earnings_entry_id)`,
  // Invoice → job link: job board applications don't create a bookings row,
  // so store the job_id directly for the briefcase icon in InvoicesTab.
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_id integer REFERENCES jobs(id) ON DELETE SET NULL`,
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
