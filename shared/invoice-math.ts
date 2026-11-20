/**
 * Invoice arithmetic, in whole pence. One rule, used by the editor, the
 * server and the PDF:
 *
 *   line total  = quantity × unit price, rounded to the penny (half away from 0)
 *   subtotal    = the sum of the line totals — never re-rounded, so the lines
 *                 printed on the invoice always add up to it
 *   VAT         = rate × subtotal, rounded once on the total (HMRC permits
 *                 VAT to be worked out on the invoice total)
 *   total       = subtotal + VAT
 */
import { invoiceTotals, roundPence, type VatProfile } from "./invoice-vat";

export { roundPence };

export interface InvoiceLineInput {
  quantity: number | string;
  unit_price_pence: number | string;
}

export function lineTotalPence(quantity: number | string, unitPricePence: number | string): number {
  const q = Number(quantity);
  const u = Number(unitPricePence);
  if (!Number.isFinite(q) || !Number.isFinite(u)) return 0;
  return roundPence(q * u);
}

/** The lines, each carrying the total_pence it will be printed with. */
export function withLineTotals<T extends InvoiceLineInput>(
  lines: T[]
): Array<T & { total_pence: number }> {
  return lines.map((l) => ({ ...l, total_pence: lineTotalPence(l.quantity, l.unit_price_pence) }));
}

export function invoiceAmounts<T extends InvoiceLineInput>(
  lines: T[],
  profile: VatProfile | null | undefined
): {
  lines: Array<T & { total_pence: number }>;
  subtotal_pence: number;
  vat_pence: number;
  total_pence: number;
} {
  const priced = withLineTotals(lines);
  const subtotal = priced.reduce((s, l) => s + l.total_pence, 0);
  const t = invoiceTotals(subtotal, profile);
  return {
    lines: priced,
    subtotal_pence: subtotal,
    vat_pence: t.vat_pence,
    total_pence: t.total_pence,
  };
}
