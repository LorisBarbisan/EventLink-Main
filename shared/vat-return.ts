/**
 * VAT return figures for a VAT-registered freelancer: per VAT quarter, the
 * VAT charged on sales (output), the VAT reclaimable on costs (input) and the
 * difference owed to or reclaimable from HMRC.
 *
 * EventLink does not submit returns. These are the figures a person types
 * into their own Making Tax Digital software, so every rule here errs towards
 * what HMRC's own guidance says and the screen says where it is an estimate.
 *
 * Schemes (https://www.gov.uk/vat-registration/calculate-vat):
 * - standard: output VAT on invoices issued in the quarter (tax point = issue
 *   date), input VAT on costs dated in the quarter.
 * - cash: VAT cash accounting. Output VAT on payments received in the
 *   quarter, input VAT on costs paid in the quarter (an expense's date is
 *   taken as the day it was paid).
 * - flat_rate: a fixed percentage of VAT-inclusive turnover is owed, and
 *   input VAT cannot be reclaimed except on a single capital purchase of
 *   £2,000 or more including VAT. Which purchases count as capital is not
 *   something the books know, so those are counted for the person to check
 *   rather than reclaimed.
 */

import { isBooksCurrency } from "./expense-totals";
import { netOfInvoice } from "./invoice-vat";

export const VAT_SCHEMES = ["standard", "cash", "flat_rate"] as const;
export type VatScheme = (typeof VAT_SCHEMES)[number];

export function isVatScheme(v: unknown): v is VatScheme {
  return VAT_SCHEMES.includes(v as VatScheme);
}

export const VAT_SCHEME_LABELS: Record<VatScheme, string> = {
  standard: "Standard (invoice) accounting",
  cash: "Cash accounting",
  flat_rate: "Flat Rate Scheme",
};

/**
 * HMRC assigns each business one of three quarter patterns ("stagger"),
 * named here by the months the quarters end in.
 */
export const VAT_STAGGERS = [1, 2, 3] as const;
export type VatStagger = (typeof VAT_STAGGERS)[number];

export function isVatStagger(v: unknown): v is VatStagger {
  return VAT_STAGGERS.includes(v as VatStagger);
}

export const VAT_STAGGER_LABELS: Record<VatStagger, string> = {
  1: "Mar, Jun, Sep, Dec",
  2: "Apr, Jul, Oct, Jan",
  3: "May, Aug, Nov, Feb",
};

/**
 * One line saying which VAT treatment the Books figures use, or null for a
 * freelancer who isn't registered (no change for them).
 */
export function vatTreatmentNote(
  profile: { vat_registered?: boolean | null; vat_scheme?: string | null } | null | undefined
): string | null {
  if (!profile?.vat_registered) return null;
  if (profile.vat_scheme === "flat_rate") {
    // Earnings are recorded net of the VAT charged, but on the Flat Rate
    // Scheme the business keeps the difference between that and the flat-rate
    // VAT it pays, and that difference is taxable income. Say so rather than
    // let the figures look complete.
    return "Flat Rate Scheme: expenses include VAT, which the scheme doesn't let you reclaim. Income excludes the VAT you charged, so the flat-rate difference you keep isn't in these figures yet.";
  }
  return "Figures exclude VAT. Your VAT is accounted for separately.";
}

/** A single capital purchase at or above this (incl. VAT) may be reclaimable on the Flat Rate Scheme. */
export const FLAT_RATE_CAPITAL_THRESHOLD_PENCE = 200_000;

/** Flat rates are set per trade between 4% and 16.5%; stored in basis points. */
export function isFlatRateBp(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 1650;
}

export interface VatQuarter {
  /** First day, YYYY-MM-DD */
  from: string;
  /** Last day, YYYY-MM-DD */
  to: string;
  /** e.g. "Jan–Mar 2027" */
  label: string;
  /** Return and payment due: one calendar month and seven days after `to`. */
  due: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar arithmetic only: no clock or time zone is involved. */
function iso(y: number, m0: number, d: number): string {
  // Date.UTC normalises overflowing months and days (month 12 → next January)
  const t = new Date(Date.UTC(y, m0, d));
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${t.getUTCFullYear()}-${mm}-${dd}`;
}

/** The VAT quarter ending in month index `endM0` (0–11) of `endY`. */
function quarterEnding(endY: number, endM0: number): VatQuarter {
  const from = iso(endY, endM0 - 2, 1);
  const to = iso(endY, endM0 + 1, 0); // day 0 = last day of endM0
  const startM0 = (endM0 + 10) % 12;
  const startY = endM0 < 2 ? endY - 1 : endY;
  const label =
    startY === endY
      ? `${MONTHS[startM0]}–${MONTHS[endM0]} ${endY}`
      : `${MONTHS[startM0]} ${startY}–${MONTHS[endM0]} ${endY}`;
  // One month and seven days after the period ends: the 7th of the second
  // month after the last month (31 March → 7 May).
  const due = iso(endY, endM0 + 2, 7);
  return { from, to, label, due };
}

/**
 * The VAT quarter containing `dateIso` and the `count - 1` before it, newest
 * first. Stagger 1 ends quarters in Mar/Jun/Sep/Dec, 2 in Apr/Jul/Oct/Jan,
 * 3 in May/Aug/Nov/Feb.
 */
export function recentVatQuarters(
  stagger: VatStagger,
  dateIso: string,
  count: number
): VatQuarter[] {
  const y = Number(dateIso.slice(0, 4));
  const m0 = Number(dateIso.slice(5, 7)) - 1;
  // Quarter-end months for this stagger, 0-based: stagger 1 → 2,5,8,11
  const firstEnd = stagger + 1;
  // Months until the end of the quarter containing m0
  const ahead = (((firstEnd - m0) % 3) + 3) % 3;
  let endY = y;
  let endM0 = m0 + ahead;
  if (endM0 > 11) {
    endM0 -= 12;
    endY += 1;
  }
  const out: VatQuarter[] = [];
  for (let i = 0; i < count; i++) {
    out.push(quarterEnding(endY, endM0));
    endM0 -= 3;
    if (endM0 < 0) {
      endM0 += 12;
      endY -= 1;
    }
  }
  return out;
}

/**
 * Every VAT quarter that overlaps `from`–`to` (YYYY-MM-DD), oldest first.
 * A tax year (6 April to 5 April) never lines up with VAT quarters, so the
 * first and last quarters usually reach outside it.
 */
export function vatQuartersOverlapping(
  stagger: VatStagger,
  from: string,
  to: string
): VatQuarter[] {
  if (to < from) return [];
  const months =
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(to.slice(5, 7)) -
    Number(from.slice(5, 7));
  return recentVatQuarters(stagger, to, Math.floor(months / 3) + 2)
    .filter((q) => q.to >= from)
    .reverse();
}

/**
 * What was paid to HMRC on payments dated `from`–`to`, net of any
 * repayments (stored as negative amounts).
 */
export function vatPaidInRange(
  payments: Array<{ paid_date: string | null; amount_pence: number }>,
  from: string,
  to: string
): number {
  return payments
    .filter((p) => !!p.paid_date && p.paid_date >= from && p.paid_date <= to)
    .reduce((sum, p) => sum + Number(p.amount_pence), 0);
}

export interface VatInvoiceLike {
  status: string;
  archived?: boolean | null;
  currency?: string | null;
  issue_date: string | null;
  /** UK calendar date the invoice was paid, YYYY-MM-DD */
  paid_date: string | null;
  paid_amount_pence: number | null;
  subtotal_pence: number;
  vat_pence: number;
  total_pence: number;
}

export interface VatExpenseLike {
  expense_date: string;
  net_amount_pence: number;
  vat_amount_pence: number;
  business_use_percent: number;
  allowable?: boolean | null;
  currency?: string | null;
}

export interface VatReturnFigures {
  /** VAT on sales: charged (standard/cash) or the flat-rate amount owed */
  output_pence: number;
  /** VAT reclaimable on costs; always 0 on the Flat Rate Scheme */
  input_pence: number;
  /** output − input: positive is owed to HMRC, negative is a repayment due */
  net_pence: number;
  /** Flat Rate Scheme only: VAT-inclusive turnover the rate was applied to */
  flat_rate_turnover_pence: number | null;
  /** Invoices counted towards output VAT */
  invoice_count: number;
  /** Expenses counted towards input VAT (those carrying any VAT) */
  expense_count: number;
  /** Flat Rate Scheme only: purchases of £2,000+ incl. VAT that may be reclaimable capital items */
  capital_candidates: number;
  /** Invoices or expenses left out because they are not in sterling */
  other_currency: number;
}

/** Issued invoices: drafts were never sent and cancelled ones were withdrawn. */
function isIssued(inv: VatInvoiceLike): boolean {
  return !inv.archived && inv.status !== "draft" && inv.status !== "cancelled";
}

const inPeriod = (d: string | null, q: { from: string; to: string }) =>
  !!d && d >= q.from && d <= q.to;

export function computeVatReturn(
  period: { from: string; to: string },
  invoices: VatInvoiceLike[],
  expenses: VatExpenseLike[],
  scheme: VatScheme,
  flatRateBp: number | null
): VatReturnFigures {
  let output = 0;
  let input = 0;
  let turnover = 0;
  let invoiceCount = 0;
  let expenseCount = 0;
  let capital = 0;
  let otherCurrency = 0;

  for (const inv of invoices) {
    if (!isIssued(inv)) continue;
    if (scheme === "cash") {
      if (inv.status !== "paid" || !inPeriod(inv.paid_date, period)) continue;
    } else if (!inPeriod(inv.issue_date, period)) {
      continue;
    }
    if (!isBooksCurrency(inv.currency)) {
      otherCurrency++;
      continue;
    }
    invoiceCount++;
    if (scheme === "cash") {
      // The VAT share of what was actually received
      const received = inv.paid_amount_pence ?? inv.total_pence;
      output += received - netOfInvoice(inv, received);
    } else if (scheme === "flat_rate") {
      turnover += inv.total_pence;
    } else {
      output += inv.vat_pence;
    }
  }

  for (const e of expenses) {
    if (e.allowable === false || !inPeriod(e.expense_date, period)) continue;
    if (!isBooksCurrency(e.currency)) {
      otherCurrency++;
      continue;
    }
    if (scheme === "flat_rate") {
      if (e.net_amount_pence + e.vat_amount_pence >= FLAT_RATE_CAPITAL_THRESHOLD_PENCE) capital++;
      continue;
    }
    if (e.vat_amount_pence <= 0) continue;
    expenseCount++;
    // Only the business share of the VAT is reclaimable
    input += Math.round((e.vat_amount_pence * e.business_use_percent) / 100);
  }

  if (scheme === "flat_rate") {
    output = flatRateBp ? Math.round((turnover * flatRateBp) / 10_000) : 0;
  }

  return {
    output_pence: output,
    input_pence: input,
    net_pence: output - input,
    flat_rate_turnover_pence: scheme === "flat_rate" ? turnover : null,
    invoice_count: invoiceCount,
    expense_count: expenseCount,
    capital_candidates: capital,
    other_currency: otherCurrency,
  };
}
