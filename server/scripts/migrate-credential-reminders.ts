// ============================================================
// Additive migration for credential renewal reminders (Epic 2). Creates the
// credential_reminders ledger table + its unique index, and adds the
// users.credential_reminders_opt_out column.
//
// Uses CREATE TABLE / CREATE INDEX / ADD COLUMN IF NOT EXISTS with the same
// names Drizzle generates, so it is idempotent and leaves no drift. It touches
// ONLY these objects and never drops anything.
//
// Run it against EVERY database the app uses BEFORE deploying the code that
// reads these objects.
//
// Usage (from a folder linked to the Railway project, or with DATABASE_URL set):
//   railway run npx tsx server/scripts/migrate-credential-reminders.ts
// ============================================================

import { sql } from "drizzle-orm";
import { db } from "../api/config/db";

const statements = [
  `CREATE TABLE IF NOT EXISTS credential_reminders (
     id serial PRIMARY KEY,
     document_id integer NOT NULL REFERENCES freelancer_documents(id) ON DELETE CASCADE,
     stage text NOT NULL,
     sent_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credential_reminders_doc_stage_idx
     ON credential_reminders (document_id, stage)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS credential_reminders_opt_out boolean NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS credential_backfill_campaign (
     id serial PRIMARY KEY,
     user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
     round1_sent_at timestamptz,
     round2_sent_at timestamptz
   )`,
];

async function migrate() {
  console.log("Ensuring credential_reminders table + opt-out column (additive, IF NOT EXISTS)…");
  for (const stmt of statements) {
    console.log("→", stmt.replace(/\s+/g, " ").trim().slice(0, 80), "…");
    await db.execute(sql.raw(stmt));
  }
  console.log("✅ Credential reminder objects ensured.");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("migrate-credential-reminders failed:", err);
    process.exit(1);
  });
