/**
 * Applies idempotent DB constraints before drizzle-kit push so deploy
 * does not repeatedly prompt to truncate users / user_sessions.
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "apply-idempotent-constraints.sql");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = readFileSync(sqlPath, "utf8");
  const db = postgres(connectionString, { max: 1, prepare: false });

  try {
    await db.unsafe(sql);
    console.log("✅ Idempotent constraints applied (users.unsubscribe_token, user_sessions)");
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch(err => {
  console.error("❌ Failed to apply idempotent constraints:", err);
  process.exit(1);
});
