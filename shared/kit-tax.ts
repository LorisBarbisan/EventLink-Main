/**
 * When a kit item should be offered as an expense, or its sale as income.
 *
 * Kit never feeds the tax totals directly — that would double-count anything
 * the freelancer also entered as an expense. Instead a kit item is linked to
 * the expense (purchase) or earnings entry (sale) that records the money.
 *
 * Under cash basis most equipment is deducted in full in the year it is paid
 * for, and selling deducted kit is a taxable receipt. Vehicles are the
 * exception: cars go through capital allowances, never a straight deduction,
 * so they are never offered either way.
 */

export interface KitTaxFields {
  category: string;
  funding_method: string;
  purchase_date: string | null;
  purchase_price_pence: number | null;
  expense_id: number | null;
  expense_prompt_dismissed: boolean;
  status: string;
  disposal_date: string | null;
  disposal_proceeds_pence: number | null;
  disposal_entry_id: number | null;
}

/**
 * - "offer": ask whether to record the purchase as an expense
 * - "vehicle": would qualify, but vehicles go through capital allowances
 * - "linked": already recorded as an expense
 * - "none": nothing to offer (no price or date, not bought, or answered no)
 */
export type KitExpenseOffer = "offer" | "vehicle" | "linked" | "none";

export function kitExpenseOffer(item: KitTaxFields): KitExpenseOffer {
  if (item.expense_id != null) return "linked";
  if (item.funding_method !== "purchased") return "none";
  if (!item.purchase_date || !item.purchase_price_pence || item.purchase_price_pence <= 0) {
    return "none";
  }
  if (item.category === "vehicle") return "vehicle";
  if (item.expense_prompt_dismissed) return "none";
  return "offer";
}

export type KitDisposalOffer = "offer" | "vehicle" | "linked" | "none";

export function kitDisposalOffer(item: KitTaxFields): KitDisposalOffer {
  if (item.disposal_entry_id != null) return "linked";
  if (item.status !== "sold" && item.status !== "disposed") return "none";
  if (!item.disposal_date || !item.disposal_proceeds_pence || item.disposal_proceeds_pence <= 0) {
    return "none";
  }
  if (item.category === "vehicle") return "vehicle";
  return "offer";
}
