import postgres from "postgres";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("No DATABASE_URL — skipping pre-deploy migration");
  process.exit(0);
}

const sql = postgres(url, { max: 1 });

async function castColumnToJsonb(table, column) {
  const [{ data_type }] = await sql`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `.catch(() => [{ data_type: null }]);

  if (!data_type) {
    console.log(`  ${table}.${column} — column not found, skipping`);
    return;
  }
  if (data_type === "jsonb") {
    console.log(`  ${table}.${column} — already jsonb, no change`);
    return;
  }
  console.log(`  ${table}.${column} — converting ${data_type} → jsonb`);
  await sql`
    ALTER TABLE ${sql(table)}
    ALTER COLUMN ${sql(column)} TYPE jsonb
    USING ${sql(column)}::jsonb
  `;
  console.log(`  ${table}.${column} — done`);
}

async function run() {
  console.log("Pre-deploy migration: ensuring jsonb column types...");
  await castColumnToJsonb("freelancer_profiles", "work_history");
  await castColumnToJsonb("freelancer_profiles", "education_history");
  console.log("Pre-deploy migration complete.");
  await sql.end();
}

run().catch(err => {
  console.error("Pre-deploy migration error:", err.message);
  process.exit(1);
});
