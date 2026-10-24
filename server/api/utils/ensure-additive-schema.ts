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
