// ============================================================
// Additive migration for the credential register (Epic 1). Adds the credential
// columns to freelancer_documents and the expiry_date index, if they don't
// already exist.
//
// Uses ADD COLUMN / CREATE INDEX IF NOT EXISTS with the same column types,
// defaults and index name Drizzle generates, so it is idempotent and leaves no
// drift for a future `drizzle-kit` run. It touches ONLY freelancer_documents —
// nothing else — and never drops anything.
//
// Run it against EVERY database the app uses (production and any others) BEFORE
// deploying the code that selects these columns — otherwise document reads break
// the same way sign-in did when help_mode / the Stripe columns were missing.
//
// Usage (from a folder linked to the Railway project, or with DATABASE_URL set):
//   railway run npx tsx server/scripts/migrate-credential-columns.ts
// ============================================================

import { sql } from "drizzle-orm";
import { db } from "../api/config/db";

const statements = [
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS issuing_body text`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS reference_number text`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS issue_date date`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS expiry_date date`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS expiry_source text`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'document_on_file'`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS superseded_by_id integer`,
  `ALTER TABLE freelancer_documents ADD COLUMN IF NOT EXISTS archived_at timestamptz`,
  `CREATE INDEX IF NOT EXISTS freelancer_documents_expiry_idx ON freelancer_documents (expiry_date)`,
];

async function migrate() {
  console.log(
    "Adding credential-register columns to freelancer_documents (additive, IF NOT EXISTS)…"
  );
  for (const stmt of statements) {
    console.log("→", stmt.replace(/\s+/g, " ").trim(), "…");
    await db.execute(sql.raw(stmt));
  }
  console.log("✅ Credential columns ensured.");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("migrate-credential-columns failed:", err);
    process.exit(1);
  });
