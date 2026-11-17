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
