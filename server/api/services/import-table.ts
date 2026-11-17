/**
 * Turning a table of cells (from a sheet, CSV, Word table or text) into rows
 * the importer understands. Pure functions, no database, so each layout seen
 * in real files can be tested directly.
 *
 *   findHeaderRow     title rows above the header ("Transaction Detail by …")
 *   inferColumnMap    which column holds what, by meaning not exact name
 *   inferHeaderlessMap  a file with no header, by what the cells contain
 *   isTotalRow        TOTAL / SUBTOTAL / balance lines that are not records
 *   pnlReportRows     a Profit and Loss report → category totals
 *   isContactList     a list of customers or suppliers, not transactions
 *   invoiceFromText   a single invoice (Word or PDF) → one earning
 *   cleanBankText     "FPS CR Stage One Producti" → "Stage One Producti"
 */

import { parseAmountPence, parseDate } from "./import-parse-utils";

export type ColumnMap = Record<string, string | null>;

// ── Headers ───────────────────────────────────────────────────────────────────

/** "InvoiceDate" → "invoice date", "Amount (GBP)" → "amount gbp", "Paid?" → "paid". */
export function normHeader(h: string): string {
  return h
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const hasWord = (h: string, words: string[]) =>
  words.some((w) => new RegExp(`(^| )${w}( |$)`).test(h));

const HEADER_WORDS = [
  "date",
  "description",
  "details",
  "amount",
  "debit",
  "credit",
  "paid in",
  "paid out",
  "money in",
  "money out",
  "name",
  "payee",
  "reference",
  "ref",
  "memo",
  "category",
  "account",
  "total",
  "gross",
  "net",
  "vat",
  "client",
  "customer",
  "supplier",
  "job",
  "work",
  "what",
  "who",
  "rate",
  "invoice",
  "notes",
  "type",
  "balance",
  "quantity",
  "days",
];

/**
 * The row holding the column headers. Accounting reports put a company name,
 * report title and date range above it; diaries put a title and a note. The
 * header is the first row with at least two cells that read as column names,
 * one of them a date or an amount word.
 */
export function findHeaderRow(table: string[][]): number {
  const limit = Math.min(table.length, 20);
  for (let i = 0; i < limit; i++) {
    const cells = table[i].map(normHeader).filter(Boolean);
    if (cells.length < 2) continue;
    const named = cells.filter((c) => hasWord(c, HEADER_WORDS) && c.length <= 40);
    const anchor = cells.some((c) =>
      hasWord(c, ["date", "amount", "debit", "credit", "total", "gross", "paid in", "money in"])
    );
    if (named.length >= 2 && anchor) return i;
  }
  return 0;
}

const FIELD_RULES: [string, string[]][] = [
  ["date", ["date", "dated on", "posted", "transaction date", "value date", "invoice date"]],
  ["credit", ["credit", "paid in", "money in", "deposit", "in", "receipts"]],
  ["debit", ["debit", "paid out", "money out", "withdrawal", "out", "payments"]],
  ["unit_amount", ["unit amount", "unit price", "rate", "day rate"]],
  ["gross", ["gross", "amount inc vat", "inc vat", "total inc vat"]],
  ["amount", ["amount", "value", "total", "net"]],
  ["vat", ["vat", "tax"]],
  ["quantity", ["quantity", "qty", "days", "hours", "units"]],
  [
    "payee",
    [
      "name",
      "payee",
      "counter party",
      "counterparty",
      "merchant",
      "client",
      "customer",
      "supplier",
      "contact name",
      "contact",
      "who",
      "who for",
      "client supplier",
    ],
  ],
  [
    "description",
    [
      "description",
      "memo description",
      "details",
      "narrative",
      "particulars",
      "transaction description",
      "memo",
      "job",
      "work",
      "what",
      "item",
    ],
  ],
  ["category", ["category", "spending category", "nominal", "account code name", "expense type"]],
  [
    "reference",
    ["reference", "ref", "num", "invoice", "invoice number", "transaction id", "cheque no"],
  ],
  ["notes", ["notes", "comments", "comment", "notes and tags"]],
  ["paid", ["paid", "paid status", "status"]],
  ["kind", ["source", "transaction type", "type"]],
];

const IGNORED_HEADERS = [
  "balance",
  "running balance",
  "local amount",
  "local currency",
  "due date",
  "time",
  "emoji",
  "address",
  "receipt",
  "email",
  "phone",
  "split",
  "account code",
  "tax type",
  "currency",
];

/**
 * Which column holds what. Matching is on whole words of the normalised
 * header, first rule wins per column and first column wins per field. An
 * "Account" column counts as the category only when it varies (QuickBooks:
 * Sales, Travel and parking…), not when it names the bank account.
 */
export function inferColumnMap(headers: string[], rows: Record<string, string>[] = []): ColumnMap {
  const map: ColumnMap = {};
  for (const header of headers) {
    const h = normHeader(header);
    if (!h) continue;
    if (IGNORED_HEADERS.some((x) => h === x || h.startsWith(`${x} `))) continue;
    if (h.includes("balance")) continue;
    if (h === "due date") continue;
    for (const [field, words] of FIELD_RULES) {
      // A date column must say "date"; "Due date" is not when the work happened.
      if (map[field]) continue;
      if (hasWord(h, words)) {
        map[field] = header;
        break;
      }
    }
  }
  if (!map["category"]) {
    const account = headers.find((h) => normHeader(h) === "account");
    if (account) {
      const values = new Set(rows.map((r) => (r[account] ?? "").trim()).filter(Boolean));
      if (values.size > 1) map["category"] = account;
    }
  }
  return map;
}

// ── Headerless files ──────────────────────────────────────────────────────────

const looksDate = (s: string) => parseDate(s) !== null;
const looksAmount = (s: string) => s.trim() !== "" && parseAmountPence(s) !== null && /\d/.test(s);

/**
 * A file with no header row: decide by content which column is the date,
 * which the description and which the amount(s). Two amount columns where
 * each row fills only one are money out and money in.
 */
export function inferHeaderlessMap(rows: Record<string, string>[]): ColumnMap {
  const cols = Object.keys(rows[0] ?? {});
  const sample = rows.slice(0, 50);
  const score = (col: string, test: (s: string) => boolean) => {
    const filled = sample.map((r) => r[col] ?? "").filter((v) => v.trim() !== "");
    return filled.length ? filled.filter(test).length / filled.length : 0;
  };
  const map: ColumnMap = {};
  const dateCol = cols.find((c) => score(c, looksDate) >= 0.8);
  if (dateCol) map.date = dateCol;
  const amountCols = cols.filter((c) => c !== dateCol && score(c, looksAmount) >= 0.8);
  if (amountCols.length >= 2) {
    const [a, b] = amountCols;
    const exclusive = sample.every((r) => !((r[a] ?? "").trim() && (r[b] ?? "").trim()));
    if (exclusive) {
      map.debit = a;
      map.credit = b;
    } else map.amount = amountCols[0];
  } else if (amountCols.length === 1) map.amount = amountCols[0];
  const textCols = cols.filter((c) => c !== dateCol && !amountCols.includes(c));
  const desc = textCols
    .map((c) => ({ c, len: sample.reduce((s, r) => s + (r[c] ?? "").length, 0) }))
    .sort((x, y) => y.len - x.len)[0];
  if (desc && desc.len > 0) map.description = desc.c;
  return map;
}

// ── Rows that are not records ─────────────────────────────────────────────────

const TOTAL_RE =
  /^(sub ?total|grand total|total|totals|balance brought forward|balance carried forward|opening balance|closing balance|net profit|net loss)\b/i;

/** A totals or balance line, wherever in the row its label sits. */
export function isTotalRow(cells: string[]): boolean {
  return cells.some((c) => TOTAL_RE.test(c.trim()));
}

// ── Profit and Loss report ────────────────────────────────────────────────────

export interface PnlLine {
  section: "income" | "expenses" | "other";
  label: string;
  amount_pence: number;
}

/**
 * A P&L report (QuickBooks, Xero, FreeAgent): a title naming it, then
 * category labels with one amount each, grouped under Income / Expenses
 * headings, with Total lines to skip. Returns null when the table is not one.
 */
export function pnlReportRows(
  table: string[][]
): { period: string | null; lines: PnlLine[] } | null {
  const head = table
    .slice(0, 6)
    .map((r) => r.join(" "))
    .join(" ");
  if (!/profit\s*(and|&)\s*loss|income statement/i.test(head)) return null;
  const period =
    table
      .slice(0, 6)
      .flat()
      .find((c) => /\d{4}\s*[-–]\s*\d{1,2}|\d{4}\s+to\s+|[-–].*\d{4}/.test(c) && /\d{4}/.test(c)) ??
    null;
  let section: PnlLine["section"] = "other";
  const lines: PnlLine[] = [];
  for (const row of table) {
    const cells = row.map((c) => c.trim());
    const label = cells.find((c) => c && parseAmountPence(c) === null) ?? "";
    const amounts = cells.filter((c) => c && parseAmountPence(c) !== null && /\d/.test(c));
    if (/^(income|revenue|turnover|sales income|trading income)$/i.test(label) && !amounts.length)
      section = "income";
    else if (
      /^(expenses|costs|overheads|cost of sales|operating expenses)$/i.test(label) &&
      !amounts.length
    )
      section = "expenses";
    if (!label || !amounts.length || isTotalRow(cells)) continue;
    if (/^(gross profit|net profit|profit|loss)$/i.test(label)) continue;
    const pence = parseAmountPence(amounts[amounts.length - 1])!;
    if (pence === 0) continue;
    lines.push({ section, label, amount_pence: Math.abs(pence) });
  }
  return { period, lines };
}

// ── Contact lists ─────────────────────────────────────────────────────────────

/** Customers or suppliers with contact details but no dates or amounts. */
export function isContactList(headers: string[]): boolean {
  const h = headers.map(normHeader);
  const contact = h.some((x) => hasWord(x, ["email", "phone", "address", "billing address"]));
  const money = h.some((x) =>
    hasWord(x, ["amount", "debit", "credit", "total", "gross", "net", "paid in", "paid out"])
  );
  const date = h.some((x) => hasWord(x, ["date"]));
  return contact && !money && !date;
}

// ── A single invoice document ─────────────────────────────────────────────────

export interface InvoiceRow {
  Date: string;
  Description: string;
  Amount: string;
  Reference: string;
  Payee: string;
}

const field = (text: string, labels: string[]) => {
  for (const l of labels) {
    const m = text.match(new RegExp(`${l}\\s*[:\\-]?\\s*([^\\n]+)`, "i"));
    if (m && m[1].trim()) return m[1].trim();
  }
  return "";
};

/**
 * One invoice (as a Word document or PDF): invoice number, date, who it is
 * billed to, line descriptions and the total. Returns null when the text is
 * not an invoice, or has no number or total.
 */
export function invoiceFromText(text: string): InvoiceRow | null {
  if (!/\binvoice\b/i.test(text)) return null;
  const number = field(text, ["invoice number", "invoice no\\.?", "invoice #"]).split(
    /\s{2,}|\t/
  )[0];
  const dateRaw = field(text, ["invoice date", "date of issue", "issue date", "tax point"]).split(
    /\s{2,}|\t/
  )[0];
  const billTo = field(text, ["bill to", "billed to", "invoice to", "to"]).split(/\s{2,}|\t/)[0];
  const totalMatch =
    text.match(
      /(?:total due|amount due|balance due|invoice total|total)\s*[:-]?\s*(£?\s?-?[\d,]+\.\d{2})/i
    ) ?? null;
  if (!number || !totalMatch) return null;

  // Line items: lines between the "Description" heading and the total.
  const start = text.search(/\bdescription\b/i);
  const end = text.search(/(?:total due|amount due|balance due|invoice total|sub ?total|total)\b/i);
  const items =
    start >= 0 && end > start
      ? text
          .slice(start, end)
          .split(/\n/)
          .slice(1)
          .map((l) =>
            l
              .replace(/£?\s?[\d,]+\.\d{2}/g, "")
              .replace(/\s+\d+(\.\d+)?\s*$/, "") // a trailing day or hour count
              .replace(/\s{2,}/g, " ")
              .trim()
          )
          .filter((l) => l.length > 2 && !/^(days|rate|amount|qty|quantity|hours)\b/i.test(l))
      : [];
  return {
    Date: dateRaw,
    Description: items.slice(0, 3).join("; ") || `Invoice ${number}`,
    Amount: totalMatch[1].replace(/\s/g, ""),
    Reference: number,
    Payee: billTo,
  };
}

// ── Bank statement text ───────────────────────────────────────────────────────

const BANK_CODES =
  /^(FPS\s+CR|FPS\s+DR|FPS|FASTER\s+PAYMENT|CARD\s+PAYMENT|CARD|DEB|DD|SO|STO|BGC|BACS|TFR|CHQ|VIS|POS|CR|DR|BP|ATM|CPT|DPC)\s+/i;

/** Drop the transaction-type code a bank puts before the payee. */
export function cleanBankText(s: string): string {
  return s.replace(BANK_CODES, "").trim();
}

// ── Sheet names ───────────────────────────────────────────────────────────────

/** A sheet named for expenses (or income) says which way its positive amounts go. */
export function sheetDirection(name: string): "expense" | "earnings" | null {
  const n = name.toLowerCase();
  if (/expense|cost|spend|purchase|bills?\b|receipts/.test(n)) return "expense";
  if (/income|gig|sales|earning|invoice|work|jobs?\b/.test(n)) return "earnings";
  return null;
}
