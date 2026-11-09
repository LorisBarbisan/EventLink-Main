// ── Source / sheet detection ───────────────────────────────────────────────────
// Step 1: Sheet-name detection for Excel (strongest signal).
// Step 2: Header-row fingerprint matching for CSV and unrecognised XLSX.
// Step 3: Headerless detection — a file whose first row is all data, not labels.
//
// Returns a DetectionResult that the parse worker uses to pick the right sheet,
// apply the right column map, and decide whether to show headers or column letters.

export type KnownSource =
  | "quickbooks"
  | "xero"
  | "freeagent"
  | "bank_csv"
  | "spreadsheet"
  | "unknown";

export interface DetectionResult {
  source: KnownSource;
  sheetName?: string; // which sheet to read (XLSX only)
  headerRow?: number; // 1-based row containing headers (default 1)
  headerless: boolean; // true → no header row; use column letters
  columnMap: Record<string, string>; // canonical → header (or "A"/"B"/"C" if headerless)
  detectedBy: "sheet_name" | "header_signature" | "inference";
}

// ── Known sheet-name sets ─────────────────────────────────────────────────────
// Sheet names are case-insensitive; we prefer the transaction sheet over others.

const FREEAGENT_SHEETS = new Map<string, string>([
  ["bank account transactions", "bank_account_transactions"],
  ["bank account entries", "bank_account_entries"],
]);

// ── Known header fingerprints ──────────────────────────────────────────────────
// Each entry is a set of lowercase header substrings that reliably identify a
// source. We test for superset containment rather than exact match so minor
// column additions don't break detection.

interface HeaderFingerprint {
  source: KnownSource;
  // Every key in requiredHeaders must appear (case-insensitive substring) in
  // the actual normalised header list for this fingerprint to match.
  required: string[];
  columnMap: Record<string, string>; // canonical → actual header name pattern
  headerRow?: number; // report exports have company name on row 1
}

const HEADER_FINGERPRINTS: HeaderFingerprint[] = [
  // QuickBooks Online (UK) — General Ledger / Transaction Detail report
  {
    source: "quickbooks",
    required: ["transaction type", "date", "num", "posting"],
    columnMap: {
      date: "Date",
      description: "Memo/Description",
      amount: "Amount",
      reference: "Num",
    },
    headerRow: 4, // QB reports put metadata on rows 1–3
  },
  // QuickBooks — Expenses export
  {
    source: "quickbooks",
    required: ["transaction date", "vendor", "payee", "amount"],
    columnMap: {
      date: "Transaction Date",
      description: "Memo",
      amount: "Amount",
      reference: "Num",
    },
  },
  // Xero — Bank Statement export
  {
    source: "xero",
    required: ["transaction date", "reference", "description", "reconciled"],
    columnMap: {
      date: "Transaction Date",
      description: "Description",
      amount: "Amount",
      reference: "Reference",
    },
  },
  // Xero — Account Transactions
  {
    source: "xero",
    required: ["date", "description", "reference", "debit", "credit", "balance"],
    columnMap: {
      date: "Date",
      description: "Description",
      credit: "Credit",
      debit: "Debit",
      reference: "Reference",
    },
  },
  // FreeAgent — CSV export (when not an XLSX with named sheets)
  {
    source: "freeagent",
    required: ["dated on", "description", "amount"],
    columnMap: {
      date: "Dated On",
      description: "Description",
      amount: "Amount",
    },
  },
  // Generic UK bank CSV (Lloyds, Barclays, Halifax, NatWest patterns)
  {
    source: "bank_csv",
    required: ["transaction date", "transaction type", "sort code", "account number"],
    columnMap: {
      date: "Transaction Date",
      description: "Transaction Description",
      amount: "Credit Amount",
      debit: "Debit Amount",
    },
  },
  {
    source: "bank_csv",
    required: ["date", "type", "description", "paid out", "paid in", "balance"],
    columnMap: {
      date: "Date",
      description: "Description",
      credit: "Paid In",
      debit: "Paid Out",
    },
  },
];

// ── Headerless detection ───────────────────────────────────────────────────────
// If the first row looks like data (a cell parses as a date, another as a
// number) and no cell looks like a column label, treat the file as headerless.

function looksLikeDate(s: string): boolean {
  return /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(s.trim());
}

function looksLikeNumber(s: string): boolean {
  return /^-?[\d,]+\.?\d*$/.test(s.replace(/[£$€]/g, "").trim());
}

function looksLikeLabel(s: string): boolean {
  const lower = s.trim().toLowerCase();
  const labelWords = ["date", "amount", "description", "balance", "ref", "type", "details"];
  return labelWords.some((w) => lower.includes(w));
}

export function detectHeaderless(firstRow: string[]): boolean {
  if (firstRow.length === 0) return false;
  const hasDate = firstRow.some(looksLikeDate);
  const hasNumber = firstRow.some(looksLikeNumber);
  const hasLabel = firstRow.some(looksLikeLabel);
  return hasDate && hasNumber && !hasLabel;
}

// ── Sheet-name detection ───────────────────────────────────────────────────────

export function detectBySheetNames(sheetNames: string[]): {
  source: KnownSource;
  sheetName: string;
} | null {
  for (const name of sheetNames) {
    const key = name.trim().toLowerCase();
    if (FREEAGENT_SHEETS.has(key)) {
      return { source: "freeagent", sheetName: name };
    }
  }
  return null;
}

// ── Header fingerprint matching ────────────────────────────────────────────────

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

export function detectByHeaders(headers: string[]): HeaderFingerprint | null {
  const normHeaders = headers.map(normaliseHeader);
  for (const fp of HEADER_FINGERPRINTS) {
    const allRequired = fp.required.every((req) => normHeaders.some((h) => h.includes(req)));
    if (allRequired) return fp;
  }
  return null;
}

// ── Column map for headerless files ───────────────────────────────────────────
// Three-column bank CSV: date, description, amount.
// Falls back gracefully for more columns.

export function headerlessColumnMap(columnCount: number): Record<string, string> {
  const letters = Array.from({ length: columnCount }, (_, i) => String.fromCharCode(65 + i));
  // Heuristic assignment for a 3-col bank statement
  if (columnCount >= 3) {
    return { date: letters[0], description: letters[1], amount: letters[2] };
  }
  if (columnCount === 2) {
    return { date: letters[0], amount: letters[1] };
  }
  return {};
}
