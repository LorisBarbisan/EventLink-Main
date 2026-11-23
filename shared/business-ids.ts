/**
 * Format checks for the identifiers on a freelancer's business details.
 * They go on every invoice and on the workbook sent to an accountant, so a
 * mistyped one travels.
 *
 * Each `normalise*` returns the stored form, or null when blank. Each
 * `*Error` returns a message for a value that can't be right, or null when
 * it is fine or blank. These are shape checks only: they can't tell whether
 * HMRC or Companies House actually issued the number.
 */

const squash = (v: string) => v.replace(/[\s-]/g, "").toUpperCase();

/** UTR: 10 digits. HMRC sometimes prints a K after it, which isn't part of it. */
export function normaliseUtr(v: string | null | undefined): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  return squash(v).replace(/K$/, "");
}

export function utrError(v: string | null | undefined): string | null {
  const n = normaliseUtr(v);
  if (n === null) return null;
  return /^\d{10}$/.test(n) ? null : "A UTR is 10 digits.";
}

/**
 * VAT number: GB (or XI for Northern Ireland) then 9 digits, 12 for a
 * branch, or GD/HA and 3 digits for government departments and health
 * authorities. A number typed without its prefix is taken as GB.
 */
export function normaliseVatNumber(v: string | null | undefined): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const n = squash(v);
  return /^\d+$/.test(n) ? `GB${n}` : n;
}

export function vatNumberError(v: string | null | undefined): string | null {
  const n = normaliseVatNumber(v);
  if (n === null) return null;
  return /^(GB|XI)(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/.test(n)
    ? null
    : "A UK VAT number is GB followed by 9 digits, like GB123456789.";
}

/**
 * Company number: 8 characters, either 8 digits or a prefix such as SC, NI
 * or OC and the digits after it. A number typed without its leading zeros
 * is padded, as Companies House prints it.
 */
export function normaliseCompanyNumber(v: string | null | undefined): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const n = squash(v);
  return /^\d{1,7}$/.test(n) ? n.padStart(8, "0") : n;
}

export function companyNumberError(v: string | null | undefined): string | null {
  const n = normaliseCompanyNumber(v);
  if (n === null) return null;
  return n.length === 8 && /^[A-Z]{0,2}\d+$/.test(n)
    ? null
    : "A company number is 8 characters, like 01234567 or SC123456.";
}

export interface BusinessIds {
  utr?: string | null;
  company_number?: string | null;
  vat_number?: string | null;
}

/** Messages for whichever of the three is wrong; empty when all are fine. */
export function businessIdErrors(ids: BusinessIds): Partial<Record<keyof BusinessIds, string>> {
  const out: Partial<Record<keyof BusinessIds, string>> = {};
  const u = utrError(ids.utr);
  const c = companyNumberError(ids.company_number);
  const v = vatNumberError(ids.vat_number);
  if (u) out.utr = u;
  if (c) out.company_number = c;
  if (v) out.vat_number = v;
  return out;
}
