/**
 * VAT on invoices. Set once in invoice settings: a VAT-registered freelancer
 * picks a rate and it applies to every invoice. Amounts are net; VAT is added
 * on top. Earnings record the net amount — VAT is collected for HMRC, not
 * income.
 */
export const VAT_RATES = [20, 5, 0] as const;
export type VatRate = (typeof VAT_RATES)[number];

export function isVatRate(n: unknown): n is VatRate {
  return VAT_RATES.includes(n as VatRate);
}

export interface VatProfile {
  vat_registered: boolean;
  vat_rate_pct?: number | null;
}

/** The rate charged, or null when not VAT registered. */
export function invoiceVatRate(profile: VatProfile | null | undefined): VatRate | null {
  if (!profile?.vat_registered) return null;
  return isVatRate(profile.vat_rate_pct) ? profile.vat_rate_pct : 20;
}

export function invoiceTotals(
  subtotalPence: number,
  profile: VatProfile | null | undefined
): { vat_pence: number; total_pence: number; rate: VatRate | null } {
  const rate = invoiceVatRate(profile);
  const vat = rate ? Math.round((subtotalPence * rate) / 100) : 0;
  return { vat_pence: vat, total_pence: subtotalPence + vat, rate };
}

/**
 * The net share of an amount received against an invoice. A full payment
 * gives the subtotal; a part payment is split pro rata.
 */
export function netOfInvoice(
  invoice: { subtotal_pence: number; total_pence: number },
  receivedPence: number | null | undefined
): number {
  if (receivedPence == null) return invoice.subtotal_pence;
  if (!invoice.total_pence || invoice.total_pence === invoice.subtotal_pence) return receivedPence;
  return Math.round((receivedPence * invoice.subtotal_pence) / invoice.total_pence);
}

/** UK sort code as 12-34-56, whatever separators were typed. */
export function formatSortCode(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  const digits = s.replace(/\D/g, "");
  if (digits.length === 6) return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  return s.replace(/^[-\s]+|[-\s]+$/g, "");
}
