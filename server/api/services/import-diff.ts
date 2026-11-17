/**
 * Whether an imported record has changed from what its file said. Mirrors the
 * values writeRecord (import-commit.service.ts) writes at commit; keep in step.
 */

export type Parsed = Record<string, unknown>;
const parsedText = (p: Parsed, k: string, fallback: string) =>
  p[k] != null ? String(p[k]) : fallback;

/** The file's notes, plus its reference (such as an invoice number) when it has one. */
export function notesWithRef(p: Parsed): string | null {
  const notes = typeof p.notes === "string" ? p.notes.trim() : "";
  const ref = typeof p.reference === "string" ? p.reference.trim() : "";
  if (ref && !notes.includes(ref)) return notes ? `${notes} (ref ${ref})` : `Ref ${ref}`;
  return notes || null;
}

/** Has an imported earning changed from what the file said? */
export function earningDiffersFromImport(
  e: {
    description: string;
    work_date: string;
    gross_amount_pence: number;
    notes: string | null;
    status: string;
    paid_date: string | null;
    client_id: number | null;
    booking_id: number | null;
    invoice_id: number | null;
  },
  p: Parsed
): boolean {
  const paidInFile = p.paid === true && p.date != null;
  const clientInFile = typeof p.payee === "string" && p.payee.trim() !== "";
  return (
    e.description !== parsedText(p, "description", "Imported earnings entry") ||
    (p.date != null && e.work_date !== String(p.date)) ||
    e.gross_amount_pence !== (typeof p.amount_pence === "number" ? p.amount_pence : 0) ||
    (e.notes ?? null) !== notesWithRef(p) ||
    e.status !== (paidInFile ? "paid" : "expected") ||
    (e.paid_date ?? null) !== (paidInFile ? String(p.date) : null) ||
    (e.client_id != null && !clientInFile) ||
    e.booking_id != null ||
    e.invoice_id != null
  );
}

/** Has an imported expense changed from what the file said? */
export function expenseDiffersFromImport(
  x: {
    description: string;
    expense_date: string;
    net_amount_pence: number;
    vat_amount_pence: number;
    notes: string | null;
    business_use_percent: number;
    booking_id: number | null;
    earnings_entry_id: number | null;
  },
  p: Parsed,
  hasReceipt: boolean
): boolean {
  const gross = typeof p.amount_pence === "number" ? Math.abs(p.amount_pence) : 0;
  const vat = typeof p.vat_pence === "number" ? Math.min(Math.abs(p.vat_pence), gross) : 0;
  return (
    x.description !== parsedText(p, "description", "Imported expense") ||
    (p.date != null && x.expense_date !== String(p.date)) ||
    x.net_amount_pence !== gross - vat ||
    x.vat_amount_pence !== vat ||
    (x.notes ?? null) !== notesWithRef(p) ||
    x.business_use_percent !== 100 ||
    x.booking_id != null ||
    x.earnings_entry_id != null ||
    hasReceipt
  );
}
