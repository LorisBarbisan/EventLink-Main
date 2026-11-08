import { createHash } from "crypto";
import { and, eq, or, isNull, desc } from "drizzle-orm";
import { db } from "../config/db";
import { import_mappings } from "@shared/schema";

// ── Signature ──────────────────────────────────────────────────────────────────
// Order-independent: sort headers before hashing so the same columns in a
// different order produce the same signature. BOM-stripped + whitespace-collapsed
// so minor CSV export variations don't create phantom mismatches.

export function computeSignature(headers: string[]): string {
  const normalised = headers
    .map((h) => {
      // Strip BOM (U+FEFF) if present — common in CSV exports from Excel
      const s = h.charCodeAt(0) === 0xfeff ? h.slice(1) : h;
      return s.replace(/\s+/g, " ").trim().toLowerCase();
    })
    .filter((h) => h.length > 0)
    .sort();

  return createHash("sha256").update(normalised.join("\x1f")).digest("hex");
}

// ── Lookup ─────────────────────────────────────────────────────────────────────
// Returns the best mapping for this freelancer + signature:
//   1. The freelancer's own saved mapping (most recent)
//   2. A system mapping (is_system = true)
//   3. null — no match, user must map manually

export async function lookupMapping(
  freelancerId: number,
  signature: string
): Promise<typeof import_mappings.$inferSelect | null> {
  const rows = await db
    .select()
    .from(import_mappings)
    .where(
      and(
        eq(import_mappings.signature, signature),
        or(
          eq(import_mappings.freelancer_id, freelancerId),
          isNull(import_mappings.freelancer_id) // system mappings have null freelancer_id
        )
      )
    )
    .orderBy(desc(import_mappings.created_at));

  if (rows.length === 0) return null;

  // Prefer the user's own mapping over a system one
  const own = rows.find((r) => r.freelancer_id === freelancerId);
  return own ?? rows[0];
}

// ── Save ───────────────────────────────────────────────────────────────────────
// Upserts a user-owned mapping for this signature. If one already exists for
// this freelancer + signature, it's replaced (a re-import with adjusted mapping
// should overwrite the previous suggestion).

export async function saveMapping(params: {
  freelancerId: number;
  signature: string;
  source: string;
  columnMap: Record<string, string | null>;
  categoryMap?: Record<string, string> | null;
}): Promise<typeof import_mappings.$inferSelect> {
  // Delete any existing mapping for this freelancer + signature first so we
  // don't accumulate stale rows (there's no unique index we can conflict on
  // because freelancer_id is nullable and PostgreSQL nulls don't match in
  // ON CONFLICT DO UPDATE).
  await db
    .delete(import_mappings)
    .where(
      and(
        eq(import_mappings.freelancer_id, params.freelancerId),
        eq(import_mappings.signature, params.signature)
      )
    );

  const [saved] = await db
    .insert(import_mappings)
    .values({
      freelancer_id: params.freelancerId,
      signature: params.signature,
      source: params.source,
      column_map: params.columnMap,
      category_map: params.categoryMap ?? null,
      is_system: false,
    })
    .returning();

  return saved;
}
