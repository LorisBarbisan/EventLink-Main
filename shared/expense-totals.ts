/**
 * One rule for what an expense contributes to the books, used by every total:
 * the summary, tax estimate, quarters, monthly chart, categories and workbook.
 *
 * - Disallowed expenses contribute nothing.
 * - Only sterling expenses are counted. A €100 cost is not £100, and the
 *   books hold no exchange rate, so other currencies are left out and counted
 *   separately so the screen can say so. (Earnings already work this way.)
 * - The allowable part is the gross paid × business-use percentage.
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
export function allowableExpensePence(e: ExpenseLike): number {
  if (e.allowable === false) return 0;
  if (!isBooksCurrency(e.currency)) return 0;
  return Math.round(((e.net_amount_pence + e.vat_amount_pence) * e.business_use_percent) / 100);
}

/** Total allowable pence, and how many expenses were left out for currency. */
export function sumAllowableExpenses(list: ExpenseLike[]): {
  pence: number;
  otherCurrency: number;
} {
  let pence = 0;
  let otherCurrency = 0;
  for (const e of list) {
    if (e.allowable !== false && !isBooksCurrency(e.currency)) otherCurrency++;
    pence += allowableExpensePence(e);
  }
  return { pence, otherCurrency };
}
