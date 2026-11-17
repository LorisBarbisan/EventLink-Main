/**
 * Normalisation applied to every write of an earnings entry or expense, in
 * storage, so no caller (route, booking flow, import) can get it wrong.
 *
 * - Archiving stamps archived_at. Without it a row is hidden but never shows
 *   in Recently removed, can't be restored, and is never swept.
 * - Un-archiving clears archived_at.
 * - Currency is trimmed and upper-cased: " gbp " would otherwise fail the
 *   sterling check and silently drop out of every total.
 */

export function normaliseCurrency(currency: unknown): string | undefined {
  if (typeof currency !== "string") return undefined;
  const c = currency.trim().toUpperCase();
  return c || undefined;
}

export function normaliseRecordWrite<
  T extends { archived?: boolean | null; archived_at?: Date | null; currency?: string | null },
>(data: T): T {
  const out = { ...data };
  if (out.archived === true && out.archived_at === undefined) out.archived_at = new Date();
  if (out.archived === false && out.archived_at === undefined) out.archived_at = null;
  if ("currency" in out) {
    const c = normaliseCurrency(out.currency);
    if (c) out.currency = c;
    else delete out.currency; // blank: leave the column default (GBP) alone
  }
  return out;
}
