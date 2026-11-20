/**
 * Compare two databases' schemas and draft the SQL that brings the target up
 * to the source. READ-ONLY on both: every session is set read-only, and the
 * SQL is written to a file for a person to review and run — never executed.
 *
 *   SOURCE_DATABASE_URL=<staging>  TARGET_DATABASE_URL=<production>  \
 *     node scripts/schema-diff.mjs  [out.sql]
 *
 * Prints a summary, writes the draft (default: schema-catchup.sql).
 * Draft order: tables (no foreign keys) → missing columns → type changes
 * (commented out: they need a look at the data) → constraints → indexes →
 * reference data (mileage rates, tax rates, system expense categories).
 */
import postgres from "postgres";
import { writeFileSync } from "fs";

const SRC = process.env.SOURCE_DATABASE_URL;
const TGT = process.env.TARGET_DATABASE_URL;
const OUT = process.argv[2] || "schema-catchup.sql";
if (!SRC || !TGT) {
  console.error("Set SOURCE_DATABASE_URL (staging) and TARGET_DATABASE_URL (production).");
  process.exit(1);
}
if (SRC === TGT) {
  console.error("SOURCE and TARGET are the same database.");
  process.exit(1);
}

const open = (url) =>
  postgres(url, {
    max: 1,
    onnotice: () => {},
    connection: { default_transaction_read_only: "on" },
  });

async function snapshot(sql) {
  const columns = await sql`
    SELECT c.table_name AS t, c.column_name AS c, c.ordinal_position AS pos,
           format_type(a.atttypid, a.atttypmod) AS type,
           c.is_nullable = 'YES' AS nullable, c.column_default AS def
    FROM information_schema.columns c
    JOIN pg_attribute a ON a.attrelid = format('public.%I', c.table_name)::regclass
                       AND a.attname = c.column_name
    JOIN information_schema.tables tb ON tb.table_name = c.table_name
                                     AND tb.table_schema = 'public'
                                     AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position`;
  const constraints = await sql`
    SELECT rel.relname AS t, con.conname AS name, con.contype AS kind,
           pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public' AND con.contype IN ('p','u','f','c')`;
  // Indexes that aren't backing a constraint (those come with the constraint)
  const indexes = await sql`
    SELECT i.tablename AS t, i.indexname AS name, i.indexdef AS def
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conname = i.indexname)`;
  return { columns, constraints, indexes };
}

const key = (...p) => p.join(".");
const q = (id) => `"${id.replace(/"/g, '""')}"`;

function columnDDL(col, newTable) {
  const def = col.def ?? "";
  // serial columns: in a new table, let serial create its own sequence
  if (newTable && /^nextval\(/.test(def)) {
    const serial = col.type === "bigint" ? "bigserial" : "serial";
    return `${q(col.c)} ${serial}${col.nullable ? "" : " NOT NULL"}`;
  }
  return `${q(col.c)} ${col.type}${def ? ` DEFAULT ${def}` : ""}${col.nullable ? "" : " NOT NULL"}`;
}

async function referenceData(src, tgtTables) {
  const out = [];
  // Values are read as Postgres's own text form (::text below), so a date
  // stays '2026-04-06' whatever the local time zone, and the target column
  // casts the quoted literal back to its type.
  const lit = (v) =>
    v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
  /**
   * Copy reference rows. `guard` names the columns that identify a row: the
   * insert is skipped when a row with those values already exists, so a
   * second run adds nothing even where no unique index backs it.
   */
  const copy = async (table, where, cols, guard) => {
    let rows;
    try {
      rows = await src.unsafe(
        `SELECT ${cols.map((c) => `${q(c)}::text AS ${q(c)}`).join(", ")} FROM ${q(table)} ${where}`
      );
    } catch {
      return;
    }
    if (!rows.length || !cols.length) return;
    out.push(`-- ${table}: ${rows.length} reference row(s) from the source`);
    for (const r of rows) {
      const match = guard
        .map((c) => (r[c] === null ? `${q(c)} IS NULL` : `${q(c)} = ${lit(r[c])}`))
        .join(" AND ");
      out.push(
        `INSERT INTO ${q(table)} (${cols.map(q).join(", ")}) SELECT ${cols
          .map((c) => lit(r[c]))
          .join(", ")} WHERE NOT EXISTS (SELECT 1 FROM ${q(table)} WHERE ${match});`
      );
    }
    out.push("");
  };
  const columnsOf = async (table) => {
    try {
      const cols = await src`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=${table}
          AND column_name NOT IN ('id','created_at','updated_at')
        ORDER BY ordinal_position`;
      return cols.map((c) => c.column_name);
    } catch {
      return [];
    }
  };
  await copy(
    "mileage_rates",
    "ORDER BY vehicle_type, effective_from",
    ["vehicle_type", "rate_pence", "threshold_miles", "rate_above_pence", "effective_from"],
    ["vehicle_type", "effective_from"]
  );
  await copy(
    "tax_rates",
    "ORDER BY tax_year",
    ["tax_year", "effective_from", "bands"],
    ["tax_year"]
  );
  // System rows (no owner) seeded by 0023 and 0022
  await copy(
    "expense_categories",
    "WHERE freelancer_id IS NULL ORDER BY id",
    await columnsOf("expense_categories"),
    ["freelancer_id", "name"]
  );
  await copy(
    "earnings_roles",
    "WHERE freelancer_id IS NULL ORDER BY id",
    await columnsOf("earnings_roles"),
    ["freelancer_id", "label"]
  );
  void tgtTables;
  return out;
}

async function main() {
  const src = open(SRC);
  const tgt = open(TGT);
  try {
    const [s, t] = await Promise.all([snapshot(src), snapshot(tgt)]);

    const tgtTables = new Set(t.columns.map((c) => c.t));
    const srcTables = new Set(s.columns.map((c) => c.t));
    const tgtCols = new Map(t.columns.map((c) => [key(c.t, c.c), c]));
    const srcCols = new Map(s.columns.map((c) => [key(c.t, c.c), c]));
    const tgtCons = new Set(t.constraints.map((c) => key(c.t, c.name)));
    const tgtIdx = new Set(t.indexes.map((i) => i.name));

    const newTables = [...srcTables].filter((x) => !tgtTables.has(x)).sort();
    const newCols = s.columns.filter((c) => tgtTables.has(c.t) && !tgtCols.has(key(c.t, c.c)));
    const typeDiffs = s.columns.filter((c) => {
      const o = tgtCols.get(key(c.t, c.c));
      return o && o.type !== c.type;
    });
    const newCons = s.constraints.filter((c) => !tgtCons.has(key(c.t, c.name)));
    const newIdx = s.indexes.filter((i) => !tgtIdx.has(i.name));
    const onlyInTarget = [...tgtTables].filter((x) => !srcTables.has(x)).sort();
    const colsOnlyInTarget = t.columns.filter(
      (c) => srcTables.has(c.t) && !srcCols.has(key(c.t, c.c))
    );

    const sqlOut = [
      "-- Draft generated by scripts/schema-diff.mjs. REVIEW BEFORE RUNNING.",
      "-- Run on a copy of production first (a Neon branch), then on production.",
      "-- Everything is IF NOT EXISTS / guarded, so a second run is harmless.",
      "",
      "BEGIN;",
      "",
      "-- ── 1. New tables (columns only; keys and links are added below) ──",
    ];
    for (const tbl of newTables) {
      const cols = s.columns.filter((c) => c.t === tbl).sort((a, b) => a.pos - b.pos);
      sqlOut.push(
        `CREATE TABLE IF NOT EXISTS ${q(tbl)} (\n  ${cols.map((c) => columnDDL(c, true)).join(",\n  ")}\n);`
      );
    }
    sqlOut.push("", "-- ── 2. New columns on existing tables ──");
    for (const c of newCols) {
      sqlOut.push(`ALTER TABLE ${q(c.t)} ADD COLUMN IF NOT EXISTS ${columnDDL(c, false)};`);
    }
    sqlOut.push("", "-- ── 3. Type changes — commented out: check the data converts first ──");
    for (const c of typeDiffs) {
      const o = tgtCols.get(key(c.t, c.c));
      sqlOut.push(
        `-- ${c.t}.${c.c}: target ${o.type} → source ${c.type}`,
        `-- ALTER TABLE ${q(c.t)} ALTER COLUMN ${q(c.c)} TYPE ${c.type} USING ${q(c.c)}::${c.type};`
      );
    }
    sqlOut.push("", "-- ── 4. Keys, uniques, checks and links ──");
    const order = { p: 0, u: 1, c: 2, f: 3 };
    for (const c of [...newCons].sort((a, b) => order[a.kind] - order[b.kind])) {
      sqlOut.push(
        `DO $$ BEGIN\n  ALTER TABLE ${q(c.t)} ADD CONSTRAINT ${q(c.name)} ${c.def};\nEXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;\nEND $$;`
      );
    }
    sqlOut.push("", "-- ── 5. Indexes ──");
    for (const i of newIdx) {
      sqlOut.push(i.def.replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS ") + ";");
    }
    sqlOut.push("", "-- ── 6. Reference data ──");
    sqlOut.push(...(await referenceData(src, tgtTables)));
    sqlOut.push("COMMIT;", "");
    writeFileSync(OUT, sqlOut.join("\n"));

    const list = (title, items) => {
      console.log(`\n${title}: ${items.length}`);
      for (const x of items.slice(0, 200)) console.log(`  ${x}`);
    };
    list("Tables missing from target", newTables);
    list(
      "Columns missing from target (existing tables)",
      newCols.map((c) => `${c.t}.${c.c} ${c.type}`)
    );
    list(
      "Type differences",
      typeDiffs.map(
        (c) => `${c.t}.${c.c}: target ${tgtCols.get(key(c.t, c.c)).type}, source ${c.type}`
      )
    );
    list(
      "Constraints missing from target",
      newCons.map((c) => `${c.t}.${c.name}`)
    );
    list(
      "Indexes missing from target",
      newIdx.map((i) => `${i.t}.${i.name}`)
    );
    list("Tables only in target (left alone)", onlyInTarget);
    list(
      "Columns only in target (left alone)",
      colsOnlyInTarget.map((c) => `${c.t}.${c.c}`)
    );
    console.log(`\nDraft written to ${OUT} — nothing was changed in either database.`);
  } finally {
    await Promise.all([src.end(), tgt.end()]);
  }
}

main().catch((err) => {
  console.error("schema-diff failed:", err.message);
  process.exit(1);
});
