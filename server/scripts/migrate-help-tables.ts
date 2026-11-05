// ============================================================
// Additive migration for the contextual help system. Creates the three help
// tables and the users.help_mode column if they don't already exist.
//
// Uses CREATE TABLE / ADD COLUMN IF NOT EXISTS with the same constraint and
// index names Drizzle generates, so it is idempotent and leaves no drift for a
// future `drizzle-kit push`. It touches ONLY help objects — nothing else.
//
// Usage (from a folder linked to the Railway project):
//   railway run npx tsx server/scripts/migrate-help-tables.ts
// ============================================================

import { sql } from "drizzle-orm";
import { db } from "../api/config/db";

const statements = [
  `CREATE TABLE IF NOT EXISTS help_user_state (
     id serial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     help_key text NOT NULL,
     seen_count integer NOT NULL DEFAULT 0,
     last_seen_at timestamptz,
     dismissed_count integer NOT NULL DEFAULT 0,
     dismissed_at timestamptz,
     completed_at timestamptz,
     content_version integer NOT NULL DEFAULT 1,
     updated_at timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT help_user_state_user_key_unique UNIQUE (user_id, help_key)
   )`,
  `CREATE INDEX IF NOT EXISTS help_user_state_user_idx ON help_user_state (user_id)`,

  `CREATE TABLE IF NOT EXISTS help_route_visits (
     id serial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     route text NOT NULL,
     visit_count integer NOT NULL DEFAULT 0,
     first_visited_at timestamptz NOT NULL DEFAULT now(),
     last_visited_at timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT help_route_visits_user_route_unique UNIQUE (user_id, route)
   )`,

  `CREATE TABLE IF NOT EXISTS help_content_overrides (
     id serial PRIMARY KEY,
     key text NOT NULL,
     title text,
     body text,
     learn_more_href text,
     version integer NOT NULL DEFAULT 1,
     updated_at timestamptz NOT NULL DEFAULT now(),
     updated_by integer REFERENCES users(id) ON DELETE SET NULL,
     CONSTRAINT help_content_overrides_key_unique UNIQUE (key)
   )`,

  `ALTER TABLE users ADD COLUMN IF NOT EXISTS help_mode text DEFAULT 'full'`,
];

async function migrate() {
  console.log("Creating help system tables (additive, IF NOT EXISTS)…");
  for (const stmt of statements) {
    console.log("→", stmt.split("\n")[0].trim(), "…");
    await db.execute(sql.raw(stmt));
  }
  console.log("✅ Help tables ensured.");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("migrate-help-tables failed:", err);
    process.exit(1);
  });
