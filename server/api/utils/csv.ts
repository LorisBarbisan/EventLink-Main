/**
 * RFC 4180 CSV writer with all hygiene rules required for accountant exports.
 *
 * Rules enforced:
 * - CRLF line endings
 * - Fields containing comma, double-quote or newline are wrapped in double quotes
 * - Embedded double quotes are doubled
 * - UTF-8 with BOM (so Excel on Windows does not mangle accented characters)
 * - Formula injection guard: fields whose first character is = + - @ TAB CR are prefixed '
 * - Dates must be pre-formatted as YYYY-MM-DD by the caller
 * - Money must be pre-formatted as plain decimal strings (e.g. "1234.56") by the caller
 * - Null / undefined become empty string; never the literal "null" or "NULL"
 * - Column order and headers always present
 */

const BOM = "﻿";
const CRLF = "\r\n";
// Characters that trigger spreadsheet formula injection
const INJECTION_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** Escape a single cell value per RFC 4180 + injection guard. */
export function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s === "") return "";

  // Formula injection guard
  const guarded = INJECTION_PREFIXES.has(s[0]) ? `'${s}` : s;

  // Wrap in quotes if the value contains comma, double-quote or newline
  if (
    guarded.includes(",") ||
    guarded.includes('"') ||
    guarded.includes("\n") ||
    guarded.includes("\r")
  ) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

export interface CsvOptions {
  /** Column header labels in display order. */
  headers: string[];
  /**
   * Each row is an array of cell values in the same order as headers.
   * Pass null/undefined for empty cells. Dates as YYYY-MM-DD strings.
   * Money as plain decimal strings without currency symbol.
   */
  rows: Array<Array<string | number | null | undefined>>;
  /** Base filename without extension, e.g. "eventlink-earnings-2026-04-06-to-2027-04-05" */
  filename: string;
}

/** Build a complete CSV string (with BOM). */
export function buildCsv({ headers, rows }: Pick<CsvOptions, "headers" | "rows">): string {
  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((row) =>
    row
      .map((cell, i) => {
        // Pad shorter rows with empty cells
        if (i >= row.length) return "";
        return escapeCell(cell);
      })
      .join(",")
  );
  return BOM + [headerLine, ...dataLines].join(CRLF) + CRLF;
}

/**
 * Format a pence integer as a plain decimal string suitable for CSV.
 * E.g. 123456 → "1234.56", -50 → "-0.50"
 * Never includes currency symbol or thousands separator.
 */
export function penceToCsvDecimal(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "";
  const negative = pence < 0;
  const abs = Math.abs(pence);
  const pounds = Math.floor(abs / 100);
  const pennies = abs % 100;
  const raw = `${pounds}.${String(pennies).padStart(2, "0")}`;
  return negative ? `-${raw}` : raw;
}

/**
 * Format a JS Date or ISO date string as YYYY-MM-DD.
 * Returns empty string for null/undefined.
 */
export function dateToCsvDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const s = typeof d === "string" ? d : d.toISOString();
  return s.slice(0, 10); // YYYY-MM-DD
}

/** Content-Disposition filename for a dated export. */
export function exportFilename(base: string, from: string, to: string): string {
  return `${base}-${from}-to-${to}.csv`;
}
