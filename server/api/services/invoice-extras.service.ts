import { storage } from "../../storage";
import { invoiceVatRate, type VatProfile } from "@shared/invoice-vat";

export interface InvoiceExtraLine {
  description: string;
  quantity: number;
  unit: string;
  unit_price_pence: number;
  confident: boolean;
  rate_type?: string;
}

export interface InvoiceExtras {
  lines: InvoiceExtraLine[];
  /** Expenses folded into the invoice, to mark rebilled once it exists. */
  rebilledExpenseIds: number[];
}

/**
 * The billable extras to fold into an invoice created from a booking:
 *  - every expense attached to the booking that is flagged billable-to-client
 *    and not yet rebilled, and
 *  - the job's overtime: the freelancer's confirmed hours, else what the
 *    logged days give (billableOvertime), at the job's overtime rate.
 *
 * Expenses are billed at what the freelancer actually paid: the net amount when
 * they charge VAT on the invoice (so their own VAT lands on top, as a recharge),
 * or the gross (net + the VAT they were charged) when they don't, so a non-VAT
 * freelancer recovers the full cost. Only expenses in the invoice's own currency
 * are included — cross-currency conversion is out of scope — and the ids of the
 * ones included come back so the caller can mark them rebilled.
 *
 * Overtime is a net rate × hours, so the invoice's own VAT (if any) applies on
 * top, the same as the base rate line.
 */
export async function buildInvoiceExtras(params: {
  freelancerId: number;
  bookingId: number;
  currency: string;
  billingProfile: VatProfile;
}): Promise<InvoiceExtras> {
  const { freelancerId, bookingId, currency, billingProfile } = params;
  const lines: InvoiceExtraLine[] = [];
  const rebilledExpenseIds: number[] = [];

  const addsVat = invoiceVatRate(billingProfile) !== null;

  // ── Billable expenses attached to the booking ──────────────────────────────
  const expenses = await storage.listBillableExpensesForBooking(freelancerId, bookingId);
  for (const e of expenses) {
    if (e.currency !== currency) continue; // can't convert currencies here
    const gross = e.net_amount_pence + e.vat_amount_pence;
    const unitPence = addsVat ? e.net_amount_pence : gross;
    if (unitPence <= 0) continue;
    lines.push({
      description: e.supplier ? `${e.description} (${e.supplier})` : e.description,
      quantity: 1,
      unit: "item",
      unit_price_pence: unitPence,
      confident: true,
    });
    rebilledExpenseIds.push(e.id);
  }

  // ── Overtime: the same figure the job card and time panel show ───────────
  const entry = await storage.getEarningsEntryByBooking(bookingId);
  if (entry && entry.overtime_rate_pence != null) {
    const ot = (await storage.overtimeForEntries(freelancerId, [entry])).get(entry.id);
    if (ot && ot.hours !== null && ot.hours > 0 && ot.pence !== null && ot.pence > 0) {
      lines.push({
        description: "Overtime",
        quantity: ot.hours,
        unit: "hour",
        unit_price_pence: entry.overtime_rate_pence,
        confident: true,
        rate_type: "ot",
      });
    }
  }

  return { lines, rebilledExpenseIds };
}
