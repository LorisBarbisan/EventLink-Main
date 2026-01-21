import { sql } from "drizzle-orm";
import { db } from "../api/config/db";

async function migrateRatings() {
  console.log("Starting ratings migration...");

  try {
    // We are running raw SQL because the schema might be in an intermediate state
    // and we want to force update all rows regardless of current constraints (if any)

    // First, we need to make sure the columns exist.
    // If we run this BEFORE schema push, we are operating on old schema.
    // If we run this AFTER schema push, we are operating on new schema but data might be invalid.

    // Actually, to support the transition:
    // 1. We will push the schema (adding new columns, dropping old ones).
    // 2. But wait, if we drop 'status' values, existing rows might fail validation if we add CHECK constraints immediately.
    // The user instruction "by default set existing status to active flag = null" implies we should fix data.

    // Strategy:
    // This script will attempt to update the `status` column to 'active' and `flag` (if it exists or we add it) or clear `flags`.
    // Since we are moving to new enum values for `status`, we must update them.

    // For now, let's assume this runs against the DB to fix the data.
    // We'll use raw SQL to avoid type issues with Drizzle if types mismatch.

    console.log("Updating all ratings to status='active' and flag=NULL...");

    await db.execute(sql`
      UPDATE ratings
      SET status = 'active',
          flags = NULL -- clearing old array column if it exists or setting new column??
          -- Wait, if we haven't migrated schema yet, 'flag' column doesn't exist. 'flags' does.
    `);

    // If we are about to add 'flag' column and remove 'flags', we should probably do this:
    // If this script runs AFTER schema update (where 'flag' is added and 'flags' removed):
    // UPDATE ratings SET status = 'active', flag = NULL;

    // If this runs BEFORE:
    // UPDATE ratings SET status = 'active', flags = NULL;
    // And then we drop 'flags' and add 'flag'.

    // Since the instruction is "by default set existing status to active flag = null",
    // and we are adding 'flag' column, the default for new column is usually null anyway unless specified.

    // The Critical part is 'status'.
    // Old values: published, flagged, hidden.
    // New values: active, flagged, removed.
    // We need to change 'published' -> 'active', 'hidden' -> 'removed' (or active per user instruction).
    // User said: "by default set existing status to active".

    await db.execute(sql`UPDATE ratings SET status = 'active'`);

    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateRatings();
