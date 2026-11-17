/**
 * One raw row + a column map → what it is (earning, expense, skip) and its
 * parsed fields. Pure, so each source layout can be tested.
 */

import { parseAmountPence, parseDate } from "./import-parse-utils";
import { cleanBankText, isTotalRow, type ColumnMap } from "./import-table";

export type TargetType =
  | "earnings"
  | "expense"
  | "invoice"
  | "mileage"
  | "kit"
  | "skip"
  | "summary";

export interface ParsedRow {
  date?: string; // ISO
  description?: string;
  payee?: string; // client for earnings, supplier for expenses
  amount_pence?: number; // signed: + money in, − money out
  vat_pence?: number;
  paid?: boolean; // the row says it has been paid
  rate_raw?: string;
  notes?: string;
  reference?: string;
  category_name?: string;
}

export interface ClassifiedRow {
  parsed: ParsedRow;
  target: TargetType | null;
  confidence: number;
  issues: string[];
}

export interface ClassifyOptions {
  dateHint?: string | null;
  categoryMap?: Record<string, string> | null;
  /** From the sheet name: which way unsigned amounts go. */
  direction?: "expense" | "earnings" | null;
  /** Bank codes ("CARD", "FPS CR") are stripped from headerless descriptions. */
  headerless?: boolean;
}

const EXPENSE_KIND =
  /\b(bill|expense|purchase|spend|debit|card payment|direct debit|standing order)\b/i;
const EARNING_KIND = /\b(invoice|sales|income|receipt|credit|faster payment received)\b/i;
const PAID_YES = /^(y|yes|paid|true|✓|✔|x|done)$/i;
const SKIP_TEXT = [
  "transfer to",
  "transfer from",
  "balance brought forward",
  "opening balance",
  "closing balance",
];

export function classifyRow(
  raw: Record<string, string>,
  map: ColumnMap,
  opts: ClassifyOptions = {}
): ClassifiedRow {
  const issues: string[] = [];
  const parsed: ParsedRow = {};
  const val = (field: string) => {
    const col = map[field];
    return col && raw[col] !== undefined ? String(raw[col]).trim() : "";
  };

  // Totals and balance lines are not records
  if (isTotalRow(Object.values(raw))) {
    const label = Object.values(raw).find((v) => /total|balance/i.test(v)) ?? "Total";
    return {
      parsed: { description: label },
      target: "skip",
      confidence: 95,
      issues: ["total_row"],
    };
  }

  // Date
  const rawDate = val("date");
  if (!rawDate) issues.push("Missing date");
  else {
    const iso = parseDate(rawDate, opts.dateHint);
    if (iso) parsed.date = iso;
    else issues.push(`Could not parse date: "${rawDate}"`);
  }

  // Who and what
  let payee = val("payee");
  let desc = val("description");
  const ref = val("reference");
  if (opts.headerless) desc = cleanBankText(desc);
  payee = cleanBankText(payee);
  if (!desc && ref && !/^[A-Z]{2,5}-?\d+$/i.test(ref)) desc = ref; // Starling: the reference is the text
  if (payee && desc && !desc.toLowerCase().includes(payee.toLowerCase())) {
    parsed.description = `${payee} — ${desc}`;
  } else {
    parsed.description = desc || payee || undefined;
  }
  if (payee) parsed.payee = payee;
  if (!parsed.description) issues.push("Missing description");
  if (ref) parsed.reference = ref;
  const notes = val("notes");
  if (notes && notes !== parsed.description) parsed.notes = notes;

  // Category
  const rawCategory = val("category");
  if (rawCategory) {
    if (opts.categoryMap) {
      const mapped = opts.categoryMap[rawCategory] ?? opts.categoryMap[rawCategory.toLowerCase()];
      if (mapped) parsed.category_name = mapped;
      else issues.push(`unmapped_category:${rawCategory}`);
    } else parsed.category_name = rawCategory;
  }

  // Amount. Debit/credit decide the direction when present; gross (VAT
  // included) is what actually moved, so it wins the magnitude.
  const num = (field: string) => {
    const v = val(field);
    return v ? parseAmountPence(v) : null;
  };
  const credit = num("credit");
  const debit = num("debit");
  const gross = num("gross");
  const amount = num("amount");
  const qty = parseFloat(val("quantity").replace(/,/g, ""));
  const unit = num("unit_amount");
  let pence: number | null = null;
  let signed = false;
  if (credit) {
    pence = Math.abs(gross || credit);
    signed = true;
  } else if (debit) {
    pence = -Math.abs(gross || debit);
    signed = true;
  } else if (amount !== null) {
    pence = amount;
    signed = amount < 0;
  } else if (gross !== null) {
    pence = gross;
    signed = gross < 0;
  } else if (unit !== null && Number.isFinite(qty)) {
    pence = Math.round(qty * unit);
  }
  const rawAmountText = val("credit") || val("debit") || val("amount") || val("gross");
  if (rawAmountText) parsed.rate_raw = rawAmountText;

  if (pence === null) {
    if (rawAmountText) issues.push(`Could not parse amount: "${rawAmountText}"`);
    else issues.push("Missing amount");
  } else if (!signed && pence > 0) {
    // Unsigned positive: the row's type, then the sheet, says which way it went
    const kind = val("kind");
    if (kind && EXPENSE_KIND.test(kind) && !EARNING_KIND.test(kind)) pence = -pence;
    else if (!kind && opts.direction === "expense") pence = -pence;
  }
  if (pence !== null) parsed.amount_pence = pence;

  const vat = num("vat");
  if (vat) parsed.vat_pence = Math.abs(vat);

  const paid = val("paid");
  if (paid && PAID_YES.test(paid)) parsed.paid = true;

  // Target
  let target: TargetType | null = null;
  let confidence = 100;
  const text = (parsed.description ?? "").toLowerCase();
  if (pence === 0 || SKIP_TEXT.some((k) => text.includes(k))) {
    target = "skip";
    confidence = 90;
  } else if (pence !== null) {
    target = pence > 0 ? "earnings" : "expense";
    confidence = 80;
  }
  if (pence === 0) issues.push("Amount is zero");
  confidence = Math.max(0, confidence - issues.length * 15);
  return { parsed, target, confidence, issues };
}
