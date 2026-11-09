// Seeds is_system = true import_mappings for the common accounting sources.
// Called once at server startup — idempotent (upserts by signature).
// These let the common case work without the user touching column mapping.

import { createHash } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../config/db";
import { import_mappings } from "@shared/schema";

function sig(headers: string[]): string {
  const normalised = headers
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((h) => h.length > 0)
    .sort();
  return createHash("sha256").update(normalised.join("\x1f")).digest("hex");
}

interface SystemMapping {
  source: string;
  headers: string[];
  columnMap: Record<string, string>;
  categoryMap?: Record<string, string>;
}

const SYSTEM_MAPPINGS: SystemMapping[] = [
  // ── QuickBooks Online (UK) — Expenses export ─────────────────────────────
  {
    source: "quickbooks",
    headers: [
      "Transaction Date",
      "Transaction Type",
      "Num",
      "Vendor",
      "Payee",
      "Memo",
      "Account",
      "Class",
      "Amount",
    ],
    columnMap: {
      date: "Transaction Date",
      description: "Memo",
      amount: "Amount",
      reference: "Num",
    },
    categoryMap: {
      "office supplies": "tools_consumables",
      "travel expense": "travel_parking",
      "meals and entertainment": "subsistence",
      "tools and equipment": "tools_consumables",
      "phone/internet": "tools_consumables",
      "professional fees": "other",
      advertising: "other",
      utilities: "other",
    },
  },
  // ── Xero — Account Transactions export ───────────────────────────────────
  {
    source: "xero",
    headers: ["Date", "Description", "Reference", "Debit", "Credit", "Balance"],
    columnMap: {
      date: "Date",
      description: "Description",
      credit: "Credit",
      debit: "Debit",
      reference: "Reference",
    },
  },
  // ── Xero — Bank Statement ─────────────────────────────────────────────────
  {
    source: "xero",
    headers: ["Transaction Date", "Reference", "Description", "Reconciled", "Amount"],
    columnMap: {
      date: "Transaction Date",
      description: "Description",
      amount: "Amount",
      reference: "Reference",
    },
  },
  // ── FreeAgent — Bank Account Transactions (CSV export) ───────────────────
  {
    source: "freeagent",
    headers: ["Dated On", "Description", "Amount"],
    columnMap: {
      date: "Dated On",
      description: "Description",
      amount: "Amount",
    },
  },
  // ── Generic UK bank — common Lloyds / Halifax pattern ────────────────────
  {
    source: "bank_csv",
    headers: [
      "Transaction Date",
      "Transaction Type",
      "Sort Code",
      "Account Number",
      "Transaction Description",
      "Debit Amount",
      "Credit Amount",
      "Balance",
    ],
    columnMap: {
      date: "Transaction Date",
      description: "Transaction Description",
      credit: "Credit Amount",
      debit: "Debit Amount",
    },
  },
];

export async function seedSystemMappings(): Promise<void> {
  for (const m of SYSTEM_MAPPINGS) {
    const signature = sig(m.headers);
    // Check if already exists
    const [existing] = await db
      .select({ id: import_mappings.id })
      .from(import_mappings)
      .where(
        and(
          eq(import_mappings.signature, signature),
          eq(import_mappings.is_system, true),
          isNull(import_mappings.freelancer_id)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(import_mappings).values({
        freelancer_id: null,
        signature,
        source: m.source,
        column_map: m.columnMap,
        category_map: m.categoryMap ?? null,
        is_system: true,
      });
    }
  }
}
