import type { Request, Response } from "express";
import { ukDate, ukToday } from "@shared/job-dates";
import { storage } from "../../storage";
import { currentTaxYear, taxYearForDate, taxQuarters } from "@shared/tax-periods";
import { buildCsv, penceToCsvDecimal, dateToCsvDate, exportFilename } from "../utils/csv";
import {
  bandsForTaxYear,
  estimateTax,
  type TaxOptions,
  type StudentLoanPlan,
  STUDENT_LOAN_PLANS,
} from "@shared/tax-estimate";
import {
  sumAllowableExpenses,
  allowableExpensePence,
  isBooksCurrency,
  reclaimsInputVat,
} from "@shared/expense-totals";
import {
  vatTreatmentNote,
  computeVatReturn,
  recentVatQuarters,
  vatQuartersOverlapping,
  vatPaidInRange,
  VAT_SCHEME_LABELS,
  isVatScheme,
  isVatStagger,
  isFlatRateBp,
  type VatScheme,
  type VatStagger,
  type VatInvoiceLike,
  type VatReturnFigures,
} from "@shared/vat-return";
import {
  createWorkbook,
  addTypedSheet,
  addSummarySheet,
  streamWorkbook,
  type ColSpec,
} from "../utils/xlsx";
import { addQuartersSheet } from "../utils/hmrc-quarters-sheet";
import { logBooksEvent } from "../services/books-usage.service";
import { netOfInvoice } from "@shared/invoice-vat";

/** "2026-04-06" → "6 April 2026". */
// timeZone "UTC" is deliberate: do not change it to Europe/London. The
// input is a UK calendar date (YYYY-MM-DD) pinned to UTC midnight, and
// formatting it in UTC prints exactly that day. Any other zone risks printing
// a different day for the same stored date.
function fmtLongDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function taxYearParams(req: Request): { from: string; to: string } {
  const ty = currentTaxYear();
  return {
    from: (req.query.from as string) ?? ty.from,
    to: (req.query.to as string) ?? ty.to,
  };
}

/**
 * Whether the freelancer reclaims input VAT (registered, not on the Flat Rate
 * Scheme). Decides whether expenses count net or gross (see
 * expense-totals.ts), so every total must ask.
 */
async function reclaimsVatFor(freelancerId: number): Promise<boolean> {
  return reclaimsInputVat(await storage.getBillingProfile(freelancerId));
}

// ── VAT ───────────────────────────────────────────────────────────────────────

type InvoiceRow = Awaited<ReturnType<typeof storage.getInvoicesByFreelancer>>[number];
type BillingRow = NonNullable<Awaited<ReturnType<typeof storage.getBillingProfile>>>;
type ExpenseRow = Awaited<ReturnType<typeof storage.listExpensesForExport>>[number];
type VatPaymentRow = Awaited<ReturnType<typeof storage.listVatPayments>>[number];

function toVatInvoices(invoices: InvoiceRow[]): VatInvoiceLike[] {
  return invoices.map((inv) => ({
    status: inv.status,
    archived: inv.archived,
    currency: inv.currency,
    issue_date: inv.issue_date,
    paid_date: inv.paid_at ? ukDate(inv.paid_at) : null,
    paid_amount_pence: inv.paid_amount_pence,
    subtotal_pence: inv.subtotal_pence,
    vat_pence: inv.vat_pence,
    total_pence: inv.total_pence,
  }));
}

/** The VAT settings on a billing profile, with anything unset or invalid defaulted. */
function vatSettings(billing: BillingRow): {
  scheme: VatScheme;
  stagger: VatStagger;
  flatRateBp: number | null;
} {
  return {
    scheme: isVatScheme(billing.vat_scheme) ? billing.vat_scheme : "standard",
    stagger: isVatStagger(billing.vat_stagger) ? billing.vat_stagger : 1,
    flatRateBp: isFlatRateBp(billing.vat_flat_rate_bp) ? billing.vat_flat_rate_bp : null,
  };
}

/**
 * VAT for a period that isn't a VAT quarter (the Books tax year): what was
 * charged, what is reclaimable, the difference, and what was paid to HMRC
 * in it. Null when the freelancer isn't VAT-registered.
 */
function periodVat(
  billing: Awaited<ReturnType<typeof storage.getBillingProfile>>,
  from: string,
  to: string,
  invoices: InvoiceRow[],
  expenses: ExpenseRow[],
  payments: VatPaymentRow[]
):
  | (VatReturnFigures & { scheme: VatScheme; flat_rate_bp: number | null; paid_pence: number })
  | null {
  if (!billing?.vat_registered) return null;
  const { scheme, flatRateBp } = vatSettings(billing);
  return {
    scheme,
    flat_rate_bp: flatRateBp,
    ...computeVatReturn({ from, to }, toVatInvoices(invoices), expenses, scheme, flatRateBp),
    paid_pence: vatPaidInRange(payments, from, to),
  };
}

// ── Summary ───────────────────────────────────────────────────────────────────

// Pence from paid invoices that have no linked earnings_entries row.
// These arise when a blank invoice was marked paid before the auto-create
// logic was added, or when the invoice was never tied to a booking.
// Counted net of VAT, as linked earnings are (netOfInvoice): output VAT
// belongs to HMRC, not to income.
async function syntheticInvoicePence(
  freelancerId: number,
  from: string,
  to: string
): Promise<number> {
  const [allInvoices, allEntries] = await Promise.all([
    storage.getInvoicesByFreelancer(freelancerId),
    storage.listEarningsEntries(freelancerId, { archived: false }),
  ]);
  const linkedInvoiceIds = new Set(allEntries.map((e) => e.invoice_id).filter(Boolean));
  return allInvoices
    .filter((inv) => {
      if (inv.status !== "paid" || inv.archived) return false;
      if (linkedInvoiceIds.has(inv.id)) return false;
      const paidDate =
        inv.paid_at instanceof Date
          ? ukDate(inv.paid_at)
          : typeof inv.paid_at === "string"
            ? (inv.paid_at as string).slice(0, 10)
            : null;
      return paidDate && paidDate >= from && paidDate <= to;
    })
    .reduce((sum, inv) => sum + netOfInvoice(inv, inv.paid_amount_pence), 0);
}

export async function booksSummary(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { from, to } = taxYearParams(req);

    const [earnings, expensesData, mileagePence, extraPence, overdueData, billing] =
      await Promise.all([
        storage.earningsSummary(freelancerId, { basis: "cash", from, to }),
        storage.listExpensesForExport(freelancerId, from, to),
        storage.sumMileagePence(freelancerId, from, to),
        syntheticInvoicePence(freelancerId, from, to),
        storage.countOverdueEntries(freelancerId, from, to),
        storage.getBillingProfile(freelancerId),
      ]);

    const earningsPence = earnings.total_pence - earnings.deductions_pence + extraPence;
    const reclaimsVat = reclaimsInputVat(billing);

    const expenseTotals = sumAllowableExpenses(expensesData, reclaimsVat);
    const expenseAllowablePence = expenseTotals.pence;

    const expenseCount = expensesData.length;
    const mileageTripCount = (await storage.listMileageTrips(freelancerId, from, to)).length;

    const netProfitPence = earningsPence - expenseAllowablePence - mileagePence;

    // VAT is kept out of every figure above, so show it beside them instead
    const [vatInvoices, vatPayments] = billing?.vat_registered
      ? await Promise.all([
          storage.getInvoicesByFreelancer(freelancerId),
          storage.listVatPayments(freelancerId),
        ])
      : [[], []];
    const vat = periodVat(billing, from, to, vatInvoices, expensesData, vatPayments);

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
      overdue_count: overdueData.count,
      overdue_pence: overdueData.total_pence,
      // Records left out of every total because they are not in sterling
      other_currency_earnings: earnings.excluded.other_currency,
      other_currency_expenses: expenseTotals.otherCurrency,
      // Which VAT treatment the figures use, so the screen can say so
      vat_registered: billing?.vat_registered ?? false,
      vat_scheme: billing?.vat_registered ? billing.vat_scheme : null,
      vat,
    });
  } catch (err) {
    console.error("booksSummary error:", err);
    return res.status(500).json({ error: "Failed to load books summary" });
  }
}

// ── Full-year CSV export ───────────────────────────────────────────────────────

export async function booksExport(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { from, to } = taxYearParams(req);

    const [expenses, trips, reclaimsVat] = await Promise.all([
      storage.listExpensesForExport(freelancerId, from, to),
      storage.listMileageTrips(freelancerId, from, to),
      reclaimsVatFor(freelancerId),
    ]);

    // Section 1: Expenses
    const expenseRows = expenses.map((e) => {
      const allowable = allowableExpensePence(e, reclaimsVat);
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
  } catch (err) {
    console.error("booksExport error:", err);
    return res.status(500).json({ error: "Failed to export books" });
  }
}

// ── Monthly breakdown (for charts) ───────────────────────────────────────────

export async function booksMonthly(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { from, to } = taxYearParams(req);

    const [earningsGroups, expensesRaw, mileageTrips, allInvoices, allEntries, reclaimsVat] =
      await Promise.all([
        storage.earningsSummary(freelancerId, { basis: "cash", from, to, groupBy: "month" }),
        storage.listExpensesForExport(freelancerId, from, to),
        storage.listMileageTrips(freelancerId, from, to),
        storage.getInvoicesByFreelancer(freelancerId),
        storage.listEarningsEntries(freelancerId, { archived: false }),
        reclaimsVatFor(freelancerId),
      ]);

    // Build month buckets from from/to range
    const months: string[] = [];
    const cur = new Date(from + "T00:00:00Z");
    const end = new Date(to + "T00:00:00Z");
    while (cur <= end) {
      months.push(cur.toISOString().slice(0, 7));
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }

    // Earnings per month from the grouped summary
    const earningsMap: Record<string, number> = {};
    for (const g of earningsGroups.groups ?? []) {
      earningsMap[g.label] = g.total_pence;
    }

    // Add synthetic pence from paid invoices with no linked entry, by paid month
    const linkedInvoiceIds = new Set(allEntries.map((e) => e.invoice_id).filter(Boolean));
    for (const inv of allInvoices) {
      if (inv.status !== "paid" || inv.archived) continue;
      if (linkedInvoiceIds.has(inv.id)) continue;
      const paidDate =
        inv.paid_at instanceof Date
          ? ukDate(inv.paid_at)
          : typeof inv.paid_at === "string"
            ? (inv.paid_at as string).slice(0, 10)
            : null;
      if (!paidDate || paidDate < from || paidDate > to) continue;
      const m = paidDate.slice(0, 7);
      earningsMap[m] = (earningsMap[m] ?? 0) + netOfInvoice(inv, inv.paid_amount_pence);
    }

    // Expenses per month
    const expensesMap: Record<string, number> = {};
    for (const e of expensesRaw) {
      const m = e.expense_date.slice(0, 7);
      expensesMap[m] = (expensesMap[m] ?? 0) + allowableExpensePence(e, reclaimsVat);
    }

    // Mileage per month
    const mileageMap: Record<string, number> = {};
    for (const t of mileageTrips) {
      const m = t.trip_date.slice(0, 7);
      mileageMap[m] = (mileageMap[m] ?? 0) + t.amount_pence;
    }

    const rows = months.map((m) => {
      const earnings = earningsMap[m] ?? 0;
      const expenses = (expensesMap[m] ?? 0) + (mileageMap[m] ?? 0);
      return {
        month: m,
        earnings_pence: earnings,
        expenses_pence: expenses,
        profit_pence: earnings - expenses,
      };
    });

    return res.json({ from, to, months: rows });
  } catch (err) {
    console.error("booksMonthly error:", err);
    return res.status(500).json({ error: "Failed to load monthly data" });
  }
}

// ── Expense category breakdown (for donut chart) ──────────────────────────────

export async function booksExpenseCategories(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { from, to } = taxYearParams(req);

    const [expensesRaw, reclaimsVat] = await Promise.all([
      storage.listExpensesForExport(freelancerId, from, to),
      reclaimsVatFor(freelancerId),
    ]);

    const catMap: Record<string, number> = {};
    for (const e of expensesRaw) {
      const cat = e.category_name ?? "Other";
      catMap[cat] = (catMap[cat] ?? 0) + allowableExpensePence(e, reclaimsVat);
    }

    const categories = Object.entries(catMap)
      .map(([name, pence]) => ({ name, pence }))
      .sort((a, b) => b.pence - a.pence);

    return res.json(categories);
  } catch (err) {
    console.error("booksExpenseCategories error:", err);
    return res.status(500).json({ error: "Failed to load expense categories" });
  }
}

// ── Tax estimate ──────────────────────────────────────────────────────────────

export async function taxEstimate(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { from, to } = taxYearParams(req);

    const otherIncomePence = req.query.other_income_pence
      ? Math.max(0, parseInt(req.query.other_income_pence as string, 10) || 0)
      : 0;
    const scotland = req.query.scotland === "1";

    const [earnings, expensesData, mileagePence, extraPence, billing] = await Promise.all([
      storage.earningsSummary(freelancerId, { basis: "cash", from, to }),
      storage.listExpensesForExport(freelancerId, from, to),
      storage.sumMileagePence(freelancerId, from, to),
      syntheticInvoicePence(freelancerId, from, to),
      storage.getBillingProfile(freelancerId),
    ]);

    // Same income as the Books summary (paid invoices with no earnings entry
    // included), so the estimate's profit is the profit shown above it
    const earningsPence = earnings.total_pence - earnings.deductions_pence + extraPence;
    const reclaimsVat = reclaimsInputVat(billing);
    const expenseAllowablePence = sumAllowableExpenses(expensesData, reclaimsVat).pence;

    const netProfitPence = earningsPence - expenseAllowablePence - mileagePence;

    // Determine which tax year bands to use — prefer DB row, fall back to hardcoded
    const ty = taxYearForDate(from);
    const dbRate = await storage.getTaxRate(ty.label);
    // A stored row overrides the built-in year field by field, so a row saved
    // before a field existed (Scottish limits, student loan thresholds) still
    // gets the built-in value instead of undefined.
    const bands = dbRate
      ? ({
          ...bandsForTaxYear(ty.label),
          ...(dbRate.bands as object),
          taxYear: ty.label,
        } as import("@shared/tax-estimate").TaxBands)
      : bandsForTaxYear(ty.label);
    const pensionGrossPence = req.query.pension_gross_pence
      ? Math.max(0, parseInt(req.query.pension_gross_pence as string, 10) || 0)
      : 0;
    const rawPlans = req.query.student_loan_plans;
    const studentLoanPlans: StudentLoanPlan[] = (
      Array.isArray(rawPlans) ? rawPlans : rawPlans ? [rawPlans] : []
    )
      .filter((p): p is string => typeof p === "string")
      .filter((p): p is StudentLoanPlan =>
        Object.prototype.hasOwnProperty.call(STUDENT_LOAN_PLANS, p)
      );
    const rawWfhTier = req.query.wfh_tier as string | undefined;
    const wfhTier =
      rawWfhTier === "low" || rawWfhTier === "mid" || rawWfhTier === "high"
        ? rawWfhTier
        : undefined;
    const giftAidNetPence = req.query.gift_aid_net_pence
      ? Math.max(0, parseInt(req.query.gift_aid_net_pence as string, 10) || 0)
      : 0;
    const lossesCarriedForwardPence = req.query.losses_carried_forward_pence
      ? Math.max(0, parseInt(req.query.losses_carried_forward_pence as string, 10) || 0)
      : 0;
    const childBenefitAnnualPence = req.query.child_benefit_annual_pence
      ? Math.max(0, parseInt(req.query.child_benefit_annual_pence as string, 10) || 0)
      : 0;
    const rawMA = req.query.marriage_allowance as string | undefined;
    const marriageAllowance = rawMA === "giving" || rawMA === "receiving" ? rawMA : undefined;

    const options: TaxOptions = {
      otherIncomePence,
      scotland,
      studentLoanPlans,
      pensionGrossPence,
      wfhTier,
      giftAidNetPence,
      lossesCarriedForwardPence,
      childBenefitAnnualPence,
      marriageAllowance,
    };
    const estimate = estimateTax(netProfitPence, bands, options);

    return res.json({
      ...estimate,
      vatRegistered: billing?.vat_registered ?? false,
      vatScheme: billing?.vat_registered ? billing.vat_scheme : null,
      grossEarningsPence: earningsPence,
    });
  } catch (err) {
    console.error("taxEstimate error:", err);
    return res.status(500).json({ error: "Failed to compute tax estimate" });
  }
}

// ── Quarterly breakdown ───────────────────────────────────────────────────────

export async function booksQuarterly(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { from } = taxYearParams(req);
    const ty = taxYearForDate(from);
    const quarters = taxQuarters(ty.year);
    const reclaimsVat = await reclaimsVatFor(freelancerId);

    const rows = await Promise.all(
      quarters.map(async (q) => {
        const [earnings, expensesData, mileagePence] = await Promise.all([
          storage.earningsSummary(freelancerId, { basis: "cash", from: q.from, to: q.to }),
          storage.listExpensesForExport(freelancerId, q.from, q.to),
          storage.sumMileagePence(freelancerId, q.from, q.to),
        ]);
        const earningsPence = earnings.total_pence - earnings.deductions_pence;
        const expenseAllowablePence = sumAllowableExpenses(expensesData, reclaimsVat).pence;
        return {
          quarter: q.quarter,
          label: q.label,
          from: q.from,
          to: q.to,
          earnings_pence: earningsPence,
          expenses_pence: expenseAllowablePence + mileagePence,
          profit_pence: earningsPence - expenseAllowablePence - mileagePence,
        };
      })
    );

    return res.json({ tax_year: ty.label, quarters: rows });
  } catch (err) {
    console.error("booksQuarterly error:", err);
    return res.status(500).json({ error: "Failed to load quarterly breakdown" });
  }
}

// ── Multi-sheet XLSX export ───────────────────────────────────────────────────

const DISCLAIMER =
  "Figures are estimates produced from the records you entered, for your own use and your accountant's. EventLink does not provide accountancy or tax advice and does not submit anything to HMRC.";

export async function syncOverdue(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const count = await storage.syncOverdueEntries(freelancerId);
    return res.json({ updated: count });
  } catch (err) {
    console.error("syncOverdue error", err);
    return res.status(500).json({ error: "Failed to sync overdue entries" });
  }
}

export async function booksExportWorkbook(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { from, to } = taxYearParams(req);

    const [entries, clients, roles, expenses, trips, invoices, kit, business, owner, vatPayments] =
      await Promise.all([
        storage.listEarningsEntries(freelancerId, { archived: false }),
        storage.listEarningsClients(freelancerId),
        storage.listEarningsRoles(freelancerId),
        storage.listExpensesForExport(freelancerId, from, to),
        storage.listMileageTrips(freelancerId, from, to),
        storage.getInvoicesByFreelancer(freelancerId),
        storage.listKitItems(freelancerId, true),
        storage.getBillingProfile(freelancerId),
        storage.getUser(freelancerId),
        storage.listVatPayments(freelancerId),
      ]);

    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const roleMap = new Map(roles.map((r) => [r.id, r.label]));

    // Paid invoices with no linked earnings entry — synthesize a cash-basis entry
    // so they always appear in the Earnings sheet (handles invoices paid before the
    // auto-create logic was added, or blank invoices never tied to a booking).
    const linkedInvoiceIds = new Set(entries.map((e) => e.invoice_id).filter(Boolean));
    const syntheticEntries = invoices
      .filter((inv) => {
        if (inv.status !== "paid" || inv.archived) return false;
        if (linkedInvoiceIds.has(inv.id)) return false;
        const paidDate =
          inv.paid_at instanceof Date
            ? ukDate(inv.paid_at)
            : typeof inv.paid_at === "string"
              ? (inv.paid_at as string).slice(0, 10)
              : null;
        return paidDate && paidDate >= from && paidDate <= to;
      })
      .map((inv) => {
        const toDetails = inv.to_details as Record<string, unknown> | null;
        const clientName =
          (toDetails?.company as string | undefined) ||
          (toDetails?.name as string | undefined) ||
          "Unknown";
        const paidDate =
          inv.paid_at instanceof Date
            ? ukDate(inv.paid_at)
            : (inv.paid_at as unknown as string).slice(0, 10);
        const workDate = inv.issue_date ?? paidDate;
        // Net of VAT, as linked earnings are: output VAT is not income
        const netPaid = netOfInvoice(inv, inv.paid_amount_pence);
        return {
          id: -inv.id,
          freelancer_id: freelancerId,
          invoice_id: inv.id,
          booking_id: inv.booking_id ?? null,
          client_id: null,
          _syntheticClientName: clientName,
          role_id: null,
          description: inv.invoice_number,
          work_date: workDate,
          work_end_date: null,
          quantity: "1",
          unit: "job" as const,
          unit_amount_pence: netPaid,
          gross_amount_pence: netPaid,
          deductions_pence: 0,
          currency: inv.currency ?? "GBP",
          status: "paid" as const,
          paid_date: paidDate,
          paid_amount_pence: netPaid,
          invoiced_date: inv.issue_date ?? null,
          notes: null,
          needs_review: false,
          archived: false,
          work_status: null,
          call_time: null,
          venue_address: null,
          created_at: inv.created_at,
          updated_at: inv.updated_at,
        };
      });

    // All entries that touch the period — by work date OR paid date.
    // Cash-basis entries (status=paid, paid_date in range) are the tax figure.
    // Committed entries (expected/invoiced, work_date in range) are the pipeline.
    const filteredEntries = [...entries, ...syntheticEntries].filter((e) => {
      const workInRange = e.work_date && e.work_date >= from && e.work_date <= to;
      const paidInRange = e.paid_date && e.paid_date >= from && e.paid_date <= to;
      return workInRange || paidInRange;
    });
    const cashAllCurrencies = filteredEntries.filter(
      (e) => e.status === "paid" && e.paid_date && e.paid_date >= from && e.paid_date <= to
    );
    // Totals are sterling only, as on screen: no exchange rate is held, so a
    // €3,000 job is listed on the Earnings sheet but not added to any total.
    const cashEntries = cashAllCurrencies.filter((e) => isBooksCurrency(e.currency));
    const otherCurrencyEarnings = cashAllCurrencies.length - cashEntries.length;
    // Filter invoices to period
    const filteredInvoices = invoices.filter(
      (inv) => inv.issue_date && inv.issue_date >= from && inv.issue_date <= to
    );

    const wb = createWorkbook();
    wb.views = [
      {
        x: 0,
        y: 0,
        width: 10000,
        height: 20000,
        firstSheet: 0,
        activeTab: 0,
        visibility: "visible",
      },
    ];

    // ── Sheet 1: Summary ─────────────────────────────────────────────────────────
    const netPence = (arr: typeof filteredEntries) =>
      arr.reduce((s, e) => s + e.gross_amount_pence - (e.deductions_pence ?? 0), 0);
    const receivedPence = netPence(cashEntries);
    const reclaimsVat = reclaimsInputVat(business);
    const allowablePence = (e: (typeof expenses)[number]) => allowableExpensePence(e, reclaimsVat);
    const expenseTotals = sumAllowableExpenses(expenses, reclaimsVat);
    const totalExpensesPence = expenseTotals.pence;
    const totalMileagePence = trips.reduce((s, t) => s + t.amount_pence, 0);
    const vat = periodVat(business, from, to, invoices, expenses, vatPayments);
    const generated = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    // Whose books these are, so an accountant opening the file needn't ask
    const personName = [owner?.first_name, owner?.last_name].filter(Boolean).join(" ");
    const tradingName = business?.trading_name || personName || "";
    const address = [
      business?.address_line1,
      business?.address_line2,
      business?.city,
      business?.postcode,
      business?.country,
    ]
      .filter(Boolean)
      .join(", ");
    const whose: Array<{ label: string; value: string; text: true }> = [];
    if (tradingName) whose.push({ label: "Name", value: tradingName, text: true });
    if (personName && personName !== tradingName)
      whose.push({ label: "Proprietor", value: personName, text: true });
    if (address) whose.push({ label: "Address", value: address, text: true });
    if (business?.utr) whose.push({ label: "UTR", value: business.utr, text: true });
    if (business?.company_number)
      whose.push({ label: "Company number", value: business.company_number, text: true });
    if (business?.vat_registered && business.vat_number)
      whose.push({ label: "VAT number", value: business.vat_number, text: true });
    whose.push({ label: "Tax year", value: taxYearForDate(from).label, text: true });

    addSummarySheet(
      wb,
      "Summary",
      {
        title: tradingName ? `Books summary — ${tradingName}` : "Books summary",
        subtitle: `${fmtLongDate(from)} to ${fmtLongDate(to)}`,
        meta: `Generated ${generated}. Cash basis.${vatTreatmentNote(business) ? ` ${vatTreatmentNote(business)}` : ""}`,
      },
      [
        { heading: "Whose books", lines: whose },
        {
          heading: "Income",
          lines: [
            { label: "Received in period (cash basis)", value: receivedPence / 100, bold: true },
          ],
        },
        {
          heading: "Expenses",
          lines: [
            { label: "Expenses (allowable)", value: totalExpensesPence / 100 },
            { label: "Mileage", value: totalMileagePence / 100 },
            {
              label: "Total expenses",
              value: (totalExpensesPence + totalMileagePence) / 100,
              bold: true,
            },
          ],
        },
        {
          heading: "Result",
          lines: [
            {
              label: "Net profit (estimate)",
              value: (receivedPence - totalExpensesPence - totalMileagePence) / 100,
              bold: true,
            },
          ],
        },
        ...(vat
          ? [
              {
                heading: "VAT (not in the figures above)",
                lines: [
                  { label: "Scheme", value: VAT_SCHEME_LABELS[vat.scheme], text: true as const },
                  ...(vat.scheme === "flat_rate"
                    ? [
                        {
                          label: "Turnover incl. VAT (flat rate applied to)",
                          value: (vat.flat_rate_turnover_pence ?? 0) / 100,
                        },
                        {
                          label: `Flat-rate VAT${vat.flat_rate_bp ? ` at ${vat.flat_rate_bp / 100}%` : " (rate not set)"}`,
                          value: vat.output_pence / 100,
                        },
                      ]
                    : [
                        { label: "VAT on sales", value: vat.output_pence / 100 },
                        { label: "VAT reclaimable on expenses", value: vat.input_pence / 100 },
                      ]),
                  {
                    label: vat.net_pence >= 0 ? "Net VAT owed to HMRC" : "Net VAT repayment due",
                    value: Math.abs(vat.net_pence) / 100,
                    bold: true,
                  },
                  {
                    label: "Paid to HMRC in period (net of repayments)",
                    value: vat.paid_pence / 100,
                  },
                ],
              },
            ]
          : []),
        {
          heading: "Records",
          lines: [
            { label: "Earnings entries", value: String(filteredEntries.length), text: true },
            { label: "Expense records", value: String(expenses.length), text: true },
            { label: "Mileage trips", value: String(trips.length), text: true },
            { label: "Invoices", value: String(filteredInvoices.length), text: true },
            { label: "Kit items", value: String(kit.length), text: true },
            ...(otherCurrencyEarnings + expenseTotals.otherCurrency > 0
              ? [
                  {
                    label: "Not in totals: other currencies",
                    value: `${otherCurrencyEarnings} earnings, ${expenseTotals.otherCurrency} expenses`,
                    text: true,
                  },
                ]
              : []),
          ],
        },
      ],
      DISCLAIMER
    );

    // ── Sheet 2: HMRC quarters ───────────────────────────────────────────────────
    // Same records as the Summary, so for a full tax year the quarters total to it.
    const quartersYear = taxYearForDate(from);
    const fullYear = from === quartersYear.from && to === quartersYear.to;
    addQuartersSheet(
      wb,
      quartersYear,
      cashEntries.map((e) => ({
        date: e.paid_date as string,
        amount_pence: e.gross_amount_pence - (e.deductions_pence ?? 0),
      })),
      [
        ...expenses
          .filter((e) => e.expense_date)
          .map((e) => ({ date: e.expense_date as string, amount_pence: allowablePence(e) })),
        ...trips
          .filter((t) => t.trip_date)
          .map((t) => ({ date: t.trip_date as string, amount_pence: t.amount_pence })),
      ],
      {
        note: fullYear
          ? undefined
          : `This export covers ${fmtLongDate(from)} to ${fmtLongDate(to)}, so records outside that range are not counted.`,
      }
    );

    // ── VAT quarters (VAT-registered only) ─────────────────────────────────────────
    // Whole VAT quarters, so the first and last usually reach outside the tax
    // year. Each matches the VAT return card in Books.
    if (business?.vat_registered) {
      const { scheme, stagger, flatRateBp } = vatSettings(business);
      const quarters = vatQuartersOverlapping(stagger, from, to);
      if (quarters.length > 0) {
        const qFrom = quarters[0].from;
        const qTo = quarters[quarters.length - 1].to;
        const quarterExpenses =
          qFrom === from && qTo === to
            ? expenses
            : await storage.listExpensesForExport(freelancerId, qFrom, qTo);
        const vatInvoices = toVatInvoices(invoices);
        const paymentByEnd = new Map(vatPayments.map((p) => [p.period_end, p]));
        const today = ukToday();
        const flat = scheme === "flat_rate";
        const vatCols: ColSpec[] = [
          { header: "Quarter", type: "text" },
          { header: "From", type: "date" },
          { header: "To", type: "date" },
          { header: "Return due", type: "date" },
          ...(flat ? [{ header: "Turnover incl. VAT", type: "money" as const, total: true }] : []),
          {
            header: flat ? "Flat-rate VAT (Box 1)" : "VAT on sales (Box 1)",
            type: "money",
            total: true,
          },
          { header: "VAT reclaimed (Box 4)", type: "money", total: true },
          { header: "Net VAT (Box 5)", type: "money", total: true },
          { header: "Paid to HMRC", type: "money", total: true },
          { header: "Paid date", type: "date" },
          { header: "Status", type: "text" },
        ];
        const d = (iso: string | null | undefined) => (iso ? new Date(iso + "T00:00:00Z") : null);
        const vatRows = quarters.map((q) => {
          const fig = computeVatReturn(q, vatInvoices, quarterExpenses, scheme, flatRateBp);
          const p = paymentByEnd.get(q.to);
          const status =
            today < q.from
              ? "Not started"
              : today <= q.to
                ? "In progress"
                : p
                  ? Number(p.amount_pence) < 0
                    ? "Repaid"
                    : "Paid"
                  : today > q.due
                    ? "Overdue — no payment recorded"
                    : "Return due";
          return [
            q.label,
            d(q.from),
            d(q.to),
            d(q.due),
            ...(flat ? [(fig.flat_rate_turnover_pence ?? 0) / 100] : []),
            fig.output_pence / 100,
            fig.input_pence / 100,
            fig.net_pence / 100,
            p ? Number(p.amount_pence) / 100 : null,
            d(p?.paid_date),
            status,
          ];
        });
        addTypedSheet(wb, "VAT", vatCols, vatRows, {
          title: `VAT — ${VAT_SCHEME_LABELS[scheme]}${flat && flatRateBp ? ` at ${flatRateBp / 100}%` : ""}`,
          subtitle:
            "Whole VAT quarters, so the first and last may reach outside the tax year. Net VAT: positive is owed to HMRC, negative is a repayment. Figures to copy into your MTD software; nothing here is sent to HMRC.",
          totalLabel: "Total",
          tabColor: "FF2563EB",
        });
      }
    }

    // ── Sheet 3: Earnings ─────────────────────────────────────────────────────────
    // currencyFrom index: col 6 (0-based) = Currency column → used for Gross/Deductions/Net formatting
    const earningsCols: ColSpec[] = [
      { header: "Date", type: "date" },
      { header: "Client", type: "text" },
      { header: "Role", type: "text" },
      { header: "Description", type: "text" },
      { header: "Unit", type: "text" },
      { header: "Quantity", type: "number" },
      { header: "Currency", type: "text" },
      // No total:true — we append two labelled totals rows below instead
      { header: "Gross", type: "money", currencyFrom: 6 },
      { header: "Deductions", type: "money", currencyFrom: 6 },
      { header: "Net", type: "money", currencyFrom: 6 },
      { header: "Status", type: "text" },
      { header: "Cash basis", type: "text" },
      { header: "Paid date", type: "date" },
      { header: "Notes", type: "text" },
    ];
    // Col indices (0-based): Currency=6, Gross=7, Deductions=8, Net=9

    const STATUS_LABEL: Record<string, string> = {
      expected: "Expected",
      invoiced: "Invoiced",
      paid: "Paid",
      written_off: "Written off",
    };

    const earningsRows = filteredEntries.map((e) => {
      const qty = parseFloat(e.quantity as unknown as string);
      const isCash =
        e.status === "paid" && !!e.paid_date && e.paid_date >= from && e.paid_date <= to;
      return [
        e.work_date ? new Date(e.work_date + "T00:00:00Z") : null,
        e.client_id
          ? (clientMap.get(e.client_id) ?? "")
          : (((e as Record<string, unknown>)._syntheticClientName as string) ?? ""),
        e.role_id ? (roleMap.get(e.role_id) ?? "") : "",
        e.description,
        e.unit,
        Number.isFinite(qty) ? qty : null,
        e.currency ?? "GBP",
        e.gross_amount_pence / 100,
        (e.deductions_pence ?? 0) / 100,
        (e.gross_amount_pence - (e.deductions_pence ?? 0)) / 100,
        STATUS_LABEL[e.status] ?? e.status,
        isCash ? "Yes" : "No",
        e.paid_date ? new Date(e.paid_date + "T00:00:00Z") : null,
        e.notes ?? "",
      ];
    });

    const earningsWs = addTypedSheet(wb, "Earnings", earningsCols, earningsRows);

    // Two labelled totals rows (GBP primary; mixed-currency sheets omit cross-currency sum)
    const gbpOnly = filteredEntries.every((e) => (e.currency ?? "GBP") === "GBP");
    const totalsLabel =
      earningsRows.length > 0 ? (gbpOnly ? undefined : " (GBP only — mixed currencies)") : null;
    if (earningsRows.length > 0 && totalsLabel !== null) {
      earningsWs.addRow([]); // separator
      const addTotalsRow = (
        label: string,
        net: number,
        gross: number,
        deductions: number,
        _currency = "GBP"
      ) => {
        // Styled to match addTypedSheet's totals row: soft orange, bold navy, orange rule.
        const fmt = "£#,##0.00;[Red]-£#,##0.00";
        const r = earningsWs.addRow([
          label,
          null,
          null,
          null,
          null,
          null,
          null,
          gross,
          deductions,
          net,
          null,
          null,
          null,
          null,
        ]);
        r.height = 22;
        r.eachCell({ includeEmpty: true }, (cell, i) => {
          if (i > earningsCols.length) return;
          cell.font = { bold: true, size: 10, color: { argb: "FF1E3A5F" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4E8" } };
          cell.border = { top: { style: "medium", color: { argb: "FFD8690E" } } };
          if (i >= 8 && i <= 10) {
            cell.numFmt = fmt;
            cell.alignment = { horizontal: "right", indent: 1, vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", indent: 1, vertical: "middle" };
          }
        });
        return r;
      };
      const gbpCash = cashEntries.filter((e) => (e.currency ?? "GBP") === "GBP");
      addTotalsRow(
        `Received in period (cash basis)${gbpOnly ? "" : " — GBP"}`,
        netPence(gbpCash) / 100,
        gbpCash.reduce((s, e) => s + e.gross_amount_pence, 0) / 100,
        gbpCash.reduce((s, e) => s + (e.deductions_pence ?? 0), 0) / 100
      );
    }

    // ── Sheet 4: Expenses ─────────────────────────────────────────────────────────
    const expensesCols: ColSpec[] = [
      { header: "Date", type: "date" },
      { header: "Supplier", type: "text" },
      { header: "Description", type: "text" },
      { header: "Category", type: "text" },
      { header: "Net", type: "money", total: true },
      { header: "VAT", type: "money", total: true },
      { header: "Total", type: "money", total: true },
      { header: "Business use (0–100)", type: "number" },
      // VAT-registered (not flat rate): the business share of the VAT, which
      // is reclaimed on the VAT return and so is not in Allowable
      ...(reclaimsVat ? [{ header: "VAT reclaimable", type: "money" as const, total: true }] : []),
      { header: "Allowable", type: "money", total: true },
      { header: "Billable", type: "text" },
      { header: "Rebilled", type: "text" },
      { header: "Payment method", type: "text" },
      { header: "Notes", type: "text" },
    ];
    const expensesRows = expenses.map((e) => {
      const total = e.net_amount_pence + e.vat_amount_pence;
      const allowable = allowablePence(e);
      return [
        e.expense_date ? new Date(e.expense_date + "T00:00:00Z") : null,
        e.supplier ?? "",
        e.description,
        e.category_name ?? "",
        e.net_amount_pence / 100,
        e.vat_amount_pence / 100,
        total / 100,
        e.business_use_percent,
        ...(reclaimsVat
          ? [
              e.allowable === false
                ? 0
                : Math.round((e.vat_amount_pence * e.business_use_percent) / 100) / 100,
            ]
          : []),
        allowable / 100,
        e.billable_to_client ? "Yes" : "No",
        e.rebilled ? "Yes" : "No",
        e.payment_method ?? "",
        e.notes ?? "",
      ];
    });
    addTypedSheet(wb, "Expenses", expensesCols, expensesRows, { totalLabel: "Total" });

    // ── Sheet 5: Mileage ──────────────────────────────────────────────────────────
    const mileageCols: ColSpec[] = [
      { header: "Date", type: "date" },
      { header: "From", type: "text" },
      { header: "To", type: "text" },
      { header: "Purpose", type: "text" },
      { header: "Miles", type: "number" },
      { header: "Rate (p/mile)", type: "money" },
      { header: "Amount", type: "money", total: true },
      { header: "Notes", type: "text" },
    ];
    const mileageRows = trips.map((t) => [
      t.trip_date ? new Date(t.trip_date + "T00:00:00Z") : null,
      t.from_place ?? "",
      t.to_place ?? "",
      t.purpose ?? "",
      t.miles ?? null,
      t.rate_pence != null ? t.rate_pence / 100 : null,
      t.amount_pence / 100,
      t.notes ?? "",
    ]);
    addTypedSheet(wb, "Mileage", mileageCols, mileageRows, { totalLabel: "Total" });

    // ── Sheet 6: Invoices ─────────────────────────────────────────────────────────
    const invoicesCols: ColSpec[] = [
      { header: "Number", type: "text" },
      { header: "Client", type: "text" },
      { header: "Issue date", type: "date" },
      { header: "Due date", type: "date" },
      { header: "Subtotal", type: "money", total: true },
      { header: "VAT", type: "money", total: true },
      { header: "Total", type: "money", total: true },
      { header: "Paid date", type: "date" },
      { header: "Status", type: "text" },
    ];
    const invoicesRows = filteredInvoices.map((inv) => {
      const toDetails = (inv.to_details as Record<string, unknown>) ?? {};
      // Invoices store the client as company/name; company_name/contact_name are older keys
      const client =
        (toDetails.company as string) ||
        (toDetails.company_name as string) ||
        (toDetails.name as string) ||
        (toDetails.contact_name as string) ||
        "";
      return [
        inv.invoice_number ?? "",
        client,
        inv.issue_date ? new Date(inv.issue_date + "T00:00:00Z") : null,
        inv.due_date ? new Date(inv.due_date + "T00:00:00Z") : null,
        inv.subtotal_pence / 100,
        inv.vat_pence / 100,
        inv.total_pence / 100,
        inv.paid_at ? new Date(inv.paid_at as unknown as string) : null,
        inv.status,
      ];
    });
    addTypedSheet(wb, "Invoices", invoicesCols, invoicesRows, { totalLabel: "Total" });

    // ── Sheet 7: Kit ──────────────────────────────────────────────────────────────
    const kitCols: ColSpec[] = [
      { header: "Item", type: "text" },
      { header: "Category", type: "text" },
      { header: "Purchase date", type: "date" },
      { header: "Purchase price", type: "money" },
      // The expense date when the purchase is linked to an expense; blank means the
      // purchase may not be in the accounts. Kit money is never added to a total.
      { header: "Recorded as expense", type: "date" },
      { header: "Serial", type: "text" },
      { header: "Status", type: "text" },
      { header: "Notes", type: "text" },
    ];
    const linkedExpenseDates = new Map<number, string>();
    await Promise.all(
      kit
        .filter((item) => item.expense_id != null)
        .map(async (item) => {
          const exp = await storage.getExpense(item.expense_id!);
          if (exp && !exp.archived) linkedExpenseDates.set(item.id, exp.expense_date);
        })
    );
    const kitRows = kit.map((item) => [
      item.name,
      item.category,
      item.purchase_date ? new Date(item.purchase_date + "T00:00:00Z") : null,
      item.purchase_price_pence != null ? item.purchase_price_pence / 100 : null,
      linkedExpenseDates.get(item.id) ?? null,
      item.serial_number ?? "",
      item.status,
      item.condition_notes ?? "",
    ]);
    // The kit register is not period-bound: a purchase is an expense in the year it
    // was paid for, but the item persists until sold. Hence no "for this period".
    addTypedSheet(wb, "Kit", kitCols, kitRows, { emptyLabel: "No kit recorded." });

    // ── Stream response ───────────────────────────────────────────────────────────
    const filename = `eventlink-books-${from}-to-${to}.xlsx`;
    await streamWorkbook(wb, res, filename);
    void logBooksEvent(freelancerId, "workbook.downloaded");
  } catch (err) {
    console.error("booksExportWorkbook error:", err);
    if (!res.headersSent) return res.status(500).json({ error: "Failed to generate workbook" });
  }
}

// ── VAT return ────────────────────────────────────────────────────────────────

const VAT_QUARTERS_SHOWN = 5; // the current quarter and the four before it

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Per VAT quarter: output VAT, input VAT, the difference, and what the
 * freelancer recorded paying. Figures to copy into their own MTD software;
 * nothing is submitted to HMRC.
 */
export async function vatReturn(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const billing = await storage.getBillingProfile(freelancerId);
    if (!billing?.vat_registered) return res.json({ vat_registered: false });

    const { scheme, stagger, flatRateBp } = vatSettings(billing);
    const today = ukToday();
    const quarters = recentVatQuarters(stagger, today, VAT_QUARTERS_SHOWN);
    const oldest = quarters[quarters.length - 1];

    const [invoices, expenses, payments] = await Promise.all([
      storage.getInvoicesByFreelancer(freelancerId),
      storage.listExpensesForExport(freelancerId, oldest.from, quarters[0].to),
      storage.listVatPayments(freelancerId),
    ]);

    const vatInvoices = toVatInvoices(invoices);
    const paymentByEnd = new Map(payments.map((p) => [p.period_end, p]));

    return res.json({
      vat_registered: true,
      vat_scheme: scheme,
      vat_stagger: stagger,
      vat_flat_rate_bp: flatRateBp,
      quarters: quarters.map((q) => {
        const p = paymentByEnd.get(q.to);
        return {
          ...q,
          ...computeVatReturn(q, vatInvoices, expenses, scheme, flatRateBp),
          in_progress: today <= q.to,
          payment: p
            ? {
                id: p.id,
                amount_pence: p.amount_pence,
                paid_date: p.paid_date,
                notes: p.notes,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    console.error("vatReturn error:", err);
    return res.status(500).json({ error: "Failed to load VAT return" });
  }
}

/** Record (or correct) what was paid to or received from HMRC for one quarter. */
export async function saveVatPayment(req: Request, res: Response) {
  try {
    const { period_start, period_end, amount_pence, paid_date, notes } = req.body ?? {};
    if (
      ![period_start, period_end, paid_date].every((d) => typeof d === "string" && DATE_RE.test(d))
    )
      return res
        .status(400)
        .json({ error: "period_start, period_end and paid_date must be YYYY-MM-DD" });
    if (period_start > period_end)
      return res.status(400).json({ error: "period_start must be before period_end" });
    const amount = Number(amount_pence);
    if (!Number.isSafeInteger(amount))
      return res.status(400).json({ error: "amount_pence must be a whole number of pence" });
    const saved = await storage.upsertVatPayment(req.user!.id, {
      period_start,
      period_end,
      amount_pence: amount,
      paid_date,
      notes: typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 500) : null,
    });
    return res.json(saved);
  } catch (err) {
    console.error("saveVatPayment error:", err);
    return res.status(500).json({ error: "Failed to save VAT payment" });
  }
}

export async function deleteVatPayment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
    const ok = await storage.deleteVatPayment(req.user!.id, id);
    return ok ? res.status(204).end() : res.status(404).json({ error: "Not found" });
  } catch (err) {
    console.error("deleteVatPayment error:", err);
    return res.status(500).json({ error: "Failed to delete VAT payment" });
  }
}
