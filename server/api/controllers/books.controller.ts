import type { Request, Response } from "express";
import { storage } from "../../storage";
import { currentTaxYear, taxYearForDate } from "@shared/tax-periods";
import { buildCsv, penceToCsvDecimal, dateToCsvDate, exportFilename } from "../utils/csv";
import { bandsForTaxYear, estimateTax } from "@shared/tax-estimate";

function taxYearParams(req: Request): { from: string; to: string } {
  const ty = currentTaxYear();
  return {
    from: (req.query.from as string) ?? ty.from,
    to: (req.query.to as string) ?? ty.to,
  };
}

// ── Summary ───────────────────────────────────────────────────────────────────

export async function booksSummary(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const { from, to } = taxYearParams(req);

  const [earnings, expensesData, mileagePence] = await Promise.all([
    storage.earningsSummary(freelancerId, { basis: "cash", from, to }),
    storage.listExpensesForExport(freelancerId, from, to),
    storage.sumMileagePence(freelancerId, from, to),
  ]);

  const earningsPence = earnings.total_pence - earnings.deductions_pence;

  const expenseAllowablePence = expensesData.reduce((sum, e) => {
    const total = e.net_amount_pence + e.vat_amount_pence;
    return sum + Math.round((total * e.business_use_percent) / 100);
  }, 0);

  const expenseCount = expensesData.length;
  const mileageTripCount = (await storage.listMileageTrips(freelancerId, from, to)).length;

  const netProfitPence = earningsPence - expenseAllowablePence - mileagePence;

  return res.json({
    from,
    to,
    earnings_pence: earningsPence,
    expense_allowable_pence: expenseAllowablePence,
    mileage_pence: mileagePence,
    net_profit_pence: netProfitPence,
    entry_count: earnings.entry_count,
    expense_count: expenseCount,
    mileage_trip_count: mileageTripCount,
  });
}

// ── Full-year CSV export ───────────────────────────────────────────────────────

export async function booksExport(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const { from, to } = taxYearParams(req);

  const [expenses, trips] = await Promise.all([
    storage.listExpensesForExport(freelancerId, from, to),
    storage.listMileageTrips(freelancerId, from, to),
  ]);

  // Section 1: Expenses
  const expenseRows = expenses.map((e) => {
    const total = e.net_amount_pence + e.vat_amount_pence;
    const allowable = Math.round((total * e.business_use_percent) / 100);
    return [
      "expense",
      dateToCsvDate(e.expense_date),
      e.supplier ?? "",
      e.description,
      e.category_name ?? "",
      penceToCsvDecimal(e.net_amount_pence),
      penceToCsvDecimal(e.vat_amount_pence),
      String(e.business_use_percent),
      penceToCsvDecimal(allowable),
      e.currency,
      e.payment_method ?? "",
      e.notes ?? "",
    ];
  });

  // Section 2: Mileage
  const mileageRows = trips.map((t) => [
    "mileage",
    dateToCsvDate(t.trip_date),
    `${t.from_place} → ${t.to_place}`,
    t.purpose,
    "",
    "",
    "",
    "",
    penceToCsvDecimal(t.amount_pence),
    "GBP",
    "",
    t.notes ?? "",
  ]);

  const csv = buildCsv({
    headers: [
      "type",
      "date",
      "supplier_or_route",
      "description_or_purpose",
      "category",
      "net_gbp",
      "vat_gbp",
      "business_use_pct",
      "allowable_gbp",
      "currency",
      "payment_method",
      "notes",
    ],
    rows: [...expenseRows, ...mileageRows],
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${exportFilename("books", from, to)}"`
  );
  return res.send(csv);
}

// ── Tax estimate ──────────────────────────────────────────────────────────────

export async function taxEstimate(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const { from, to } = taxYearParams(req);

  const [earnings, expensesData, mileagePence] = await Promise.all([
    storage.earningsSummary(freelancerId, { basis: "cash", from, to }),
    storage.listExpensesForExport(freelancerId, from, to),
    storage.sumMileagePence(freelancerId, from, to),
  ]);

  const earningsPence = earnings.total_pence - earnings.deductions_pence;
  const expenseAllowablePence = expensesData.reduce((sum, e) => {
    const total = e.net_amount_pence + e.vat_amount_pence;
    return sum + Math.round((total * e.business_use_percent) / 100);
  }, 0);

  const netProfitPence = earningsPence - expenseAllowablePence - mileagePence;

  // Determine which tax year bands to use from the `from` date
  const ty = taxYearForDate(from);
  const bands = bandsForTaxYear(ty.label);
  const estimate = estimateTax(netProfitPence, bands);

  return res.json(estimate);
}
