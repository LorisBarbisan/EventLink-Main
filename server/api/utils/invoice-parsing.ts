import type { Job } from "@shared/schema";

export interface ParsedPence {
  pence: number | null;
  confident: boolean;
  raw: string | null;
}

export interface ParsedQuantity {
  quantity: number;
  unit: "day" | "hour" | "job";
  confident: boolean;
}

/**
 * Parse a free-text rate string to integer pence.
 * Returns { pence: null, confident: false } for anything ambiguous.
 * Never throws.
 */
export function parseRateToPence(raw: string | null): ParsedPence {
  if (!raw) return { pence: null, confident: false, raw };

  const cleaned = raw.trim();

  // Strip currency symbols and common prefixes (£, $, €, GBP, USD, EUR)
  const withoutCurrency = cleaned.replace(/^[£$€]|^(GBP|USD|EUR|GBP\s)/i, "").trim();

  // Only match a clean numeric value at the start, possibly with comma separators
  // e.g. "350", "1,200", "350.50" — but NOT "350/day + travel"
  const match = withoutCurrency.match(
    /^(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)(\s*$|(?:\s*\/\s*(?:day|hr|hour|week|month))?\s*$)/i
  );

  if (!match) {
    // Has noise (e.g. "+ travel", "neg", "TBC", "DOE") — return raw, not confident
    return { pence: null, confident: false, raw: cleaned };
  }

  const numericStr = match[1].replace(/,/g, "");
  const num = parseFloat(numericStr);
  if (!isFinite(num) || num < 0 || num > 1_000_000) {
    return { pence: null, confident: false, raw: cleaned };
  }

  return { pence: Math.round(num * 100), confident: true, raw: cleaned };
}

/**
 * Parse a free-text date string to a Date, or null.
 * Accepts ISO 8601 (YYYY-MM-DD), UK date (DD/MM/YYYY, DD-MM-YYYY), and common English formats.
 * Never throws.
 */
export function parseJobDate(raw: string | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO 8601
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // UK: DD/MM/YYYY or DD-MM-YYYY
  const uk = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (uk) {
    const d = new Date(`${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback: native parse (handles "15 January 2025", "Jan 15, 2025", etc.)
  const native = new Date(s);
  if (!isNaN(native.getTime())) return native;

  return null;
}

/**
 * Derive quantity and unit from a job's duration fields.
 * Priority: duration_type > hours > days > start/end time.
 * Returns confident=false when the field is missing or ambiguous.
 * Never throws.
 */
export function deriveQuantity(job: Job): ParsedQuantity {
  if (job.duration_type === "days" && job.days && job.days > 0) {
    return { quantity: job.days, unit: "day", confident: true };
  }

  if (job.duration_type === "hours" && job.hours && job.hours > 0) {
    return { quantity: job.hours, unit: "hour", confident: true };
  }

  if (job.duration_type === "time" && job.start_time && job.end_time) {
    const hours = parseTimeDiff(job.start_time, job.end_time);
    if (hours !== null && hours > 0) {
      return { quantity: hours, unit: "hour", confident: true };
    }
  }

  // Fallbacks without duration_type
  if (job.days && job.days > 0) {
    return { quantity: job.days, unit: "day", confident: false };
  }
  if (job.hours && job.hours > 0) {
    return { quantity: job.hours, unit: "hour", confident: false };
  }

  // Default: 1 job, not confident
  return { quantity: 1, unit: "job", confident: false };
}

function parseTimeDiff(start: string, end: string): number | null {
  const toMinutes = (t: string): number | null => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1]) * 60 + parseInt(m[2]);
  };
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null) return null;
  const diff = e - s;
  return diff > 0 ? diff / 60 : null; // negative = overnight, not handled
}
