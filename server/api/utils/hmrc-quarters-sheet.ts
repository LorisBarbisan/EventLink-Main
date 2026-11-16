/**
 * HMRC quarters sheet for the year-end workbook.
 *
 * Both "this quarter" and "to date": MTD quarterly updates are cumulative —
 * each restates the year so far — so the "to date" columns are the ones that
 * will appear on an HMRC screen, while the per-quarter columns are what the
 * freelancer wants for planning.
 *
 * Quarter boundaries come from shared/tax-periods.ts. All four quarters are
 * always shown, including empty future ones, so an empty Q4 reads as empty
 * rather than missing.
 */

import type ExcelJS from "exceljs";
import { taxQuarters, type TaxYear } from "../../../shared/tax-periods";
import { addTypedSheet, type ColSpec } from "./xlsx";

export interface DatedAmount {
  /** ISO yyyy-mm-dd. Cash basis: paid date for income, expense/trip date for costs. */
  date: string;
  amount_pence: number;
}

const QUARTER_COLS: ColSpec[] = [
  { header: "Quarter", type: "text" },
  { header: "Period", type: "text" },
  { header: "Income", type: "money" },
  { header: "Expenses", type: "money" },
  { header: "Net", type: "money" },
  { header: "Income to date", type: "money" },
  { header: "Expenses to date", type: "money" },
  { header: "Net to date", type: "money" },
  { header: "Status", type: "text" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-06", "2027-01-05" → "6 Oct - 5 Jan 2027" */
export function quarterPeriodLabel(from: string, to: string): string {
  const part = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]}`;
  };
  return `${part(from)} - ${part(to)} ${to.slice(0, 4)}`;
}

export interface QuarterRow {
  label: string;
  period: string;
  income: number;
  expenses: number;
  incomeToDate: number;
  expensesToDate: number;
  status: "Complete" | "In progress" | "Not started";
}

/** Pure calculation, separated from the sheet so it can be tested. Amounts in pence. */
export function quarterRows(
  taxYear: TaxYear,
  income: DatedAmount[],
  expenses: DatedAmount[],
  today: string
): QuarterRow[] {
  const sum = (items: DatedAmount[], from: string, to: string) =>
    items.reduce((s, i) => (i.date >= from && i.date <= to ? s + i.amount_pence : s), 0);

  let incomeToDate = 0;
  let expensesToDate = 0;
  return taxQuarters(taxYear.year).map((q) => {
    const inc = sum(income, q.from, q.to);
    const exp = sum(expenses, q.from, q.to);
    incomeToDate += inc;
    expensesToDate += exp;
    return {
      label: `Q${q.quarter}`,
      period: quarterPeriodLabel(q.from, q.to),
      income: inc,
      expenses: exp,
      incomeToDate,
      expensesToDate,
      status: q.to < today ? "Complete" : q.from <= today ? "In progress" : "Not started",
    };
  });
}

export function addQuartersSheet(
  wb: ExcelJS.Workbook,
  taxYear: TaxYear,
  income: DatedAmount[],
  expenses: DatedAmount[],
  opts: { today?: string; note?: string } = {}
): ExcelJS.Worksheet {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const rows = quarterRows(taxYear, income, expenses, today).map((q) => [
    q.label,
    q.period,
    q.income / 100,
    q.expenses / 100,
    (q.income - q.expenses) / 100,
    q.incomeToDate / 100,
    q.expensesToDate / 100,
    (q.incomeToDate - q.expensesToDate) / 100,
    q.status,
  ]);

  return addTypedSheet(wb, "HMRC quarters", QUARTER_COLS, rows, {
    title: "Making Tax Digital — quarterly figures",
    subtitle:
      `Tax year ${taxYear.label}, cash basis: income counts in the quarter it was paid, so ` +
      `unpaid work does not appear. Quarterly updates to HMRC report the year to date. ` +
      `EventLink does not submit anything to HMRC.` +
      (opts.note ? ` ${opts.note}` : ""),
    tabColor: "FF1E3A5F", // navy: a reference sheet, not a records sheet
  });
}
