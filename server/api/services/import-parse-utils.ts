/**
 * Pure helpers for the import parser: dates, amounts, CSV text and header
 * inference. No database access, so they can be unit-tested directly.
 */

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function validDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const fullYear = (yr: string) =>
  yr.length === 2 ? (parseInt(yr) > 50 ? 1900 : 2000) + parseInt(yr) : parseInt(yr);

/**
 * Normalise a date to ISO. `hint` is the format the user confirmed; numeric
 * dates are never guessed beyond it (default DD/MM/YYYY, UK). Also accepts an
 * Excel serial number, which is what an unformatted date cell holds.
 */
export function parseDate(raw: string, hint?: string | null): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO, optionally with a time part
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (isoMatch) {
    const [y, m, d] = [+isoMatch[1], +isoMatch[2], +isoMatch[3]];
    return validDay(y, m, d) ? iso(y, m, d) : null;
  }

  // Numeric with / - or . separators
  const num = s.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/);
  if (num) {
    const [, a, b, c] = num;
    let y: number, m: number, d: number;
    if (a.length === 4) {
      [y, m, d] = [+a, +b, +c]; // YYYY/MM/DD
    } else if (hint === "MM/DD/YYYY") {
      [m, d, y] = [+a, +b, fullYear(c)];
    } else {
      [d, m, y] = [+a, +b, fullYear(c)];
    }
    return validDay(y, m, d) ? iso(y, m, d) : null;
  }

  // "8 May 2026", "08-May-2026", "8 May 26"
  const long = s.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s-]+(\d{2,4})$/);
  if (long) {
    const m = MONTH_NAMES[long[2].toLowerCase().slice(0, 3)];
    const [d, y] = [+long[1], fullYear(long[3])];
    return m && validDay(y, m, d) ? iso(y, m, d) : null;
  }

  // "May 8, 2026"
  const us = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (us) {
    const m = MONTH_NAMES[us[1].toLowerCase().slice(0, 3)];
    const [d, y] = [+us[2], +us[3]];
    return m && validDay(y, m, d) ? iso(y, m, d) : null;
  }

  // Excel serial date (days since 1899-12-30), plausible range 1982–2119
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(parseFloat(s));
    if (n >= 30000 && n <= 80000) {
      return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
    }
  }

  return null;
}

/**
 * Integer pence from a money string. Handles symbols, thousands separators,
 * a trailing minus, accounting brackets "(70.00)" and "CR"/"DR" suffixes.
 */
export function parseAmountPence(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/\s*DR$/i.test(s)) {
    negative = true;
    s = s.replace(/\s*DR$/i, "");
  }
  s = s.replace(/\s*CR$/i, "");
  if (/-$/.test(s)) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/[£$€¥₹\s]|GBP|EUR|USD/gi, "").replace(/,/g, "");
  if (!/^[+-]?\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  const pence = Math.round(n * 100);
  return negative ? -Math.abs(pence) : pence;
}

/**
 * Parse CSV text into rows of cells (RFC 4180: quoted fields, doubled quotes,
 * newlines inside quotes). Detects , ; or tab from the first line and strips a
 * byte-order mark. Values are left exactly as typed — dates are interpreted
 * later with the user's chosen format, never guessed here.
 */
export function parseCsvText(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delim = [",", ";", "\t"].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

export type ColumnMap = Record<string, string | null>;

/**
 * Guess which header holds what, when no saved mapping or known source
 * matches. Whole-word matching, so "Running balance" is not "in" and
 * "Account" is not "out".
 */
export function inferColumnMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const has = (h: string, words: string[]) =>
    words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(h));

  const RULES: [string, string[]][] = [
    ["date", ["date", "posted", "transaction date", "value date", "booking date", "trans date"]],
    ["credit", ["credit", "paid in", "money in", "deposit", "in"]],
    ["debit", ["debit", "paid out", "money out", "withdrawal", "out"]],
    ["amount", ["amount", "value", "gross", "total", "net"]],
    [
      "description",
      [
        "description",
        "details",
        "narrative",
        "payee",
        "particulars",
        "transaction details",
        "memo",
      ],
    ],
    ["category", ["category", "nominal", "account code", "expense type"]],
    ["reference", ["reference", "ref", "transaction id", "invoice", "cheque no"]],
    ["notes", ["notes", "comments", "comment"]],
  ];

  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (h === "balance" || h.includes("running balance")) continue;
    for (const [field, words] of RULES) {
      if (!map[field] && has(h, words)) {
        map[field] = header;
        break;
      }
    }
  }
  return map;
}

// ── Documents: Word, plain text ───────────────────────────────────────────────

/**
 * Whether plain text is laid out as a table (CSV, tab- or semicolon-separated):
 * at least two lines, and most lines split into the same number (2+) of cells.
 */
export function looksDelimited(text: string): boolean {
  const table = parseCsvText(text);
  if (table.length < 2) return false;
  const width = table[0].length;
  if (width < 2) return false;
  const same = table.filter((r) => r.length === width).length;
  return same / table.length >= 0.8;
}

const AMOUNT_TOKEN = /^\(?-?[£$€]?-?[\d,]*\.?\d+\)?(?:\s?(?:CR|DR))?-?$/i;
const DATE_PREFIX =
  /^(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\s-][A-Za-z]{3,9}[\s-]\d{2,4})\s+/;

/**
 * Transaction rows from free text (a statement pasted into a document, or a
 * PDF without AI extraction): any line that starts with a date and ends with
 * an amount. Columns may be separated by single spaces.
 */
export function rowsFromText(
  text: string
): { Date: string; Description: string; Amount: string }[] {
  const rows: { Date: string; Description: string; Amount: string }[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    // Leading stray characters (bullets, binary left over from a .doc) are dropped.
    const line = rawLine
      .replace(/\t/g, "  ")
      .replace(/^[^0-9A-Za-z]+/, "")
      .trim();
    const m = line.match(DATE_PREFIX);
    if (!m) continue;
    const rest = line.slice(m[0].length).trim();
    // Columns separated by 2+ spaces: description first, amount last
    const parts = rest.split(/\s{2,}/).filter(Boolean);
    let description: string;
    let amount: string;
    if (parts.length >= 2 && AMOUNT_TOKEN.test(parts[parts.length - 1])) {
      description = parts[0];
      amount = parts[parts.length - 1];
    } else {
      const tokens = rest.split(/\s+/);
      const last = tokens[tokens.length - 1] ?? "";
      if (tokens.length < 2 || !AMOUNT_TOKEN.test(last)) continue;
      amount = last;
      description = tokens.slice(0, -1).join(" ");
      // Drop a trailing running balance written as a second amount
      const prev = tokens[tokens.length - 2] ?? "";
      if (tokens.length > 2 && AMOUNT_TOKEN.test(prev) && /[.,]\d{2}$/.test(prev)) {
        amount = prev;
        description = tokens.slice(0, -2).join(" ");
      }
    }
    if (!description) continue;
    rows.push({ Date: m[1], Description: description, Amount: amount });
  }
  return rows;
}

const decodeEntities = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** The largest table in an HTML document (as mammoth produces from .docx). */
export function largestHtmlTable(html: string): string[][] {
  let best: string[][] = [];
  for (const table of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows = (table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [])
      .map((tr) => (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(decodeEntities))
      .filter((r) => r.some((c) => c !== ""));
    if (rows.length > best.length) best = rows;
  }
  return best;
}

/**
 * Best-effort text from a legacy Word .doc (binary). Word 97–2003 stores body
 * text as runs of UTF-16LE or 8-bit characters; this keeps readable runs and
 * drops the binary between them. Tables come out as lines of text.
 */
export function legacyDocText(buffer: Buffer): string {
  const runs: string[] = [];
  // UTF-16LE runs
  let cur = "";
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    const code = buffer[i] | (buffer[i + 1] << 8);
    const ok =
      (code >= 0x20 && code < 0x7f) ||
      code === 0x0d ||
      code === 0x09 ||
      (code >= 0xa0 && code < 0x2000) ||
      code === 0x20ac;
    if (ok) cur += code === 0x0d ? "\n" : code === 0x09 ? "  " : String.fromCharCode(code);
    else {
      if (cur.replace(/\s/g, "").length >= 6) runs.push(cur);
      cur = "";
    }
  }
  if (cur.replace(/\s/g, "").length >= 6) runs.push(cur);
  let text = runs.join("\n");
  // 8-bit fallback when the document stored its text compressed
  if (text.replace(/\s/g, "").length < 20) {
    text = (buffer.toString("latin1").match(/[\x20-\x7e\xa0-\xff\t\r\n]{6,}/g) ?? [])
      .join("\n")
      .replace(/\r/g, "\n")
      .replace(/\t/g, "  ");
  }
  return text;
}
