/**
 * One rule for what an expense contributes to the books, used by every total:
 * the summary, tax estimate, quarters, monthly chart, categories and workbook.
 *
 * - Disallowed expenses contribute nothing.
 * - Only sterling expenses are counted. A €100 cost is not £100, and the
 *   books hold no exchange rate, so other currencies are left out and counted
 *   separately so the screen can say so. (Earnings already work this way.)
 * - The allowable part is the amount × business-use percentage, where the
 *   amount depends on the freelancer's VAT registration:
 *     - not VAT-registered: the gross paid (net + VAT). They cannot reclaim the
 *       VAT, so all of it is a cost.
 *     - VAT-registered: the net only. The VAT comes back from HMRC, so counting
 *       it would understate profit by exactly what was reclaimed. This matches
 *       earnings, which are recorded net of output VAT (see netOfInvoice), so
 *       both sides exclude VAT as HMRC requires (SA103F notes).
 *   Do not change this back to "always gross": that under-reserves tax for
 *   every registered freelancer. vatRegistered is required, not defaulted, so
 *   every caller has to decide.
 */

export const BOOKS_CURRENCY = "GBP";

export interface ExpenseLike {
  net_amount_pence: number;
  vat_amount_pence: number;
  business_use_percent: number;
  allowable?: boolean | null;
  currency?: string | null;
}

export function isBooksCurrency(currency: string | null | undefined): boolean {
  return ((currency ?? "").trim() || BOOKS_CURRENCY).toUpperCase() === BOOKS_CURRENCY;
}

/** Pence this expense contributes to the books' totals (0 if not counted). */
export function allowableExpensePence(e: ExpenseLike, vatRegistered: boolean): number {
  if (e.allowable === false) return 0;
  if (!isBooksCurrency(e.currency)) return 0;
  const base = vatRegistered ? e.net_amount_pence : e.net_amount_pence + e.vat_amount_pence;
  return Math.round((base * e.business_use_percent) / 100);
}

/** Total allowable pence, and how many expenses were left out for currency. */
export function sumAllowableExpenses(
  list: ExpenseLike[],
  vatRegistered: boolean
): {
  pence: number;
  otherCurrency: number;
} {
  let pence = 0;
  let otherCurrency = 0;
  for (const e of list) {
    if (e.allowable !== false && !isBooksCurrency(e.currency)) otherCurrency++;
    pence += allowableExpensePence(e, vatRegistered);
  }
  return { pence, otherCurrency };
}
