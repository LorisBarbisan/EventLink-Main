import type { Request, Response } from "express";
import { storage } from "../../storage";
import { currentTaxYear, taxYearForDate } from "@shared/tax-periods";
import { buildCsv, penceToCsvDecimal, dateToCsvDate, exportFilename } from "../utils/csv";
import { bandsForTaxYear, estimateTax, type TaxOptions } from "@shared/tax-estimate";
import { createWorkbook, addTypedSheet, streamWorkbook, type ColSpec } from "../utils/xlsx";

function taxYearParams(req: Request): { from: string; to: string } {
  const ty = currentTaxYear();
  return {
    from: (req.query.from as string) ?? ty.from,
    to: (req.query.to as string) ?? ty.to,
  };
}

// ── Summary ───────────────────────────────────────────────────────────────────

// Pence from paid invoices that have no linked earnings_entries row.
// These arise when a blank invoice was marked paid before the auto-create
// logic was added, or when the invoice was never tied to a booking.
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
          ? inv.paid_at.toISOString().slice(0, 10)
          : typeof inv.paid_at === "string"
            ? (inv.paid_at as string).slice(0, 10)
            : null;
      return paidDate && paidDate >= from && paidDate <= to;
    })
    .reduce((sum, inv) => sum + (inv.paid_amount_pence ?? inv.total_pence), 0);
}

export async function booksSummary(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { from, to } = taxYearParams(req);

    const [earnings, expensesData, mileagePence, extraPence] = await Promise.all([
      storage.earningsSummary(freelancerId, { basis: "cash", from, to }),
      storage.listExpensesForExport(freelancerId, from, to),
      storage.sumMileagePence(freelancerId, from, to),
      syntheticInvoicePence(freelancerId, from, to),
    ]);

    const earningsPence = earnings.total_pence - earnings.deductions_pence + extraPence;

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

    const [earningsGroups, expensesRaw, mileageTrips, allInvoices, allEntries] = await Promise.all([
      storage.earningsSummary(freelancerId, { basis: "cash", from, to, groupBy: "month" }),
      storage.listExpensesForExport(freelancerId, from, to),
      storage.listMileageTrips(freelancerId, from, to),
      storage.getInvoicesByFreelancer(freelancerId),
      storage.listEarningsEntries(freelancerId, { archived: false }),
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
          ? inv.paid_at.toISOString().slice(0, 10)
          : typeof inv.paid_at === "string"
            ? (inv.paid_at as string).slice(0, 10)
            : null;
      if (!paidDate || paidDate < from || paidDate > to) continue;
      const m = paidDate.slice(0, 7);
      earningsMap[m] = (earningsMap[m] ?? 0) + (inv.paid_amount_pence ?? inv.total_pence);
    }

    // Expenses per month
    const expensesMap: Record<string, number> = {};
    for (const e of expensesRaw) {
      const m = e.expense_date.slice(0, 7);
      const total = e.net_amount_pence + e.vat_amount_pence;
      const allowable = Math.round((total * e.business_use_percent) / 100);
      expensesMap[m] = (expensesMap[m] ?? 0) + allowable;
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

    const expensesRaw = await storage.listExpensesForExport(freelancerId, from, to);

    const catMap: Record<string, number> = {};
    for (const e of expensesRaw) {
      const cat = e.category_name ?? "Other";
      const total = e.net_amount_pence + e.vat_amount_pence;
      const allowable = Math.round((total * e.business_use_percent) / 100);
      catMap[cat] = (catMap[cat] ?? 0) + allowable;
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

    const [earnings, expensesData, mileagePence, billing] = await Promise.all([
      storage.earningsSummary(freelancerId, { basis: "cash", from, to }),
      storage.listExpensesForExport(freelancerId, from, to),
      storage.sumMileagePence(freelancerId, from, to),
      storage.getBillingProfile(freelancerId),
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
    const options: TaxOptions = { otherIncomePence, scotland };
    const estimate = estimateTax(netProfitPence, bands, options);

    return res.json({
      ...estimate,
      vatRegistered: billing?.vat_registered ?? false,
      grossEarningsPence: earningsPence,
    });
  } catch (err) {
    console.error("taxEstimate error:", err);
    return res.status(500).json({ error: "Failed to compute tax estimate" });
  }
}

// ── Multi-sheet XLSX export ───────────────────────────────────────────────────

const DISCLAIMER =
  "Figures are estimates produced from the records you entered, for your own use and your accountant's. EventLink does not provide accountancy or tax advice and does not submit anything to HMRC.";

export async function booksExportWorkbook(req: Request, res: Response) {
  try {
    const freelancerId = req.user!.id;
    const { from, to } = taxYearParams(req);

    const [entries, clients, roles, expenses, trips, invoices, kit] = await Promise.all([
      storage.listEarningsEntries(freelancerId, { archived: false }),
      storage.listEarningsClients(freelancerId),
      storage.listEarningsRoles(freelancerId),
      storage.listExpensesForExport(freelancerId, from, to),
      storage.listMileageTrips(freelancerId, from, to),
      storage.getInvoicesByFreelancer(freelancerId),
      storage.listKitItems(freelancerId, true),
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
            ? inv.paid_at.toISOString().slice(0, 10)
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
            ? inv.paid_at.toISOString().slice(0, 10)
            : (inv.paid_at as unknown as string).slice(0, 10);
        const workDate = inv.issue_date ?? paidDate;
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
          unit_amount_pence: inv.total_pence,
          gross_amount_pence: inv.total_pence,
          deductions_pence: 0,
          currency: inv.currency ?? "GBP",
          status: "paid" as const,
          paid_date: paidDate,
          paid_amount_pence: inv.paid_amount_pence ?? inv.total_pence,
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
    const cashEntries = filteredEntries.filter(
      (e) => e.status === "paid" && e.paid_date && e.paid_date >= from && e.paid_date <= to
    );
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
    const summaryWs = wb.addWorksheet("Summary", {
      properties: { tabColor: { argb: "FFD8690E" } },
    });
    const netPence = (arr: typeof filteredEntries) =>
      arr.reduce((s, e) => s + e.gross_amount_pence - (e.deductions_pence ?? 0), 0);
    const receivedPence = netPence(cashEntries);
    const totalExpensesPence = expenses.reduce((s, e) => {
      const total = e.net_amount_pence + e.vat_amount_pence;
      return s + Math.round((total * e.business_use_percent) / 100);
    }, 0);
    const totalMileagePence = trips.reduce((s, t) => s + t.amount_pence, 0);
    // Summary rows: [label, value, valueType]
    type SummaryRow = [
      string,
      string | number | Date,
      "text" | "money" | "date" | "count" | "spacer",
    ];
    const summaryRows: SummaryRow[] = [
      ["Period", `${from} to ${to}`, "text"],
      ["Generated", new Date(new Date().toDateString() + " UTC"), "date"],
      ["", "", "spacer"],
      ["Received in period (cash basis)", receivedPence / 100, "money"],
      ["", "", "spacer"],
      ["Expenses (allowable)", totalExpensesPence / 100, "money"],
      ["Mileage", totalMileagePence / 100, "money"],
      [
        "Net profit — cash basis (estimate)",
        (receivedPence - totalExpensesPence - totalMileagePence) / 100,
        "money",
      ],
      ["", "", "spacer"],
      ["Earnings entries", filteredEntries.length, "count"],
      ["Expense records", expenses.length, "count"],
      ["Mileage trips", trips.length, "count"],
      ["Invoices", filteredInvoices.length, "count"],
      ["Kit items", kit.length, "count"],
      ["", "", "spacer"],
      ["Disclaimer", DISCLAIMER, "text"],
    ];
    for (const [label, value, vtype] of summaryRows) {
      const row = summaryWs.addRow([label, value]);
      if (vtype === "spacer") continue;
      if (label === "Disclaimer") {
        row.getCell(1).font = { bold: true };
        row.getCell(2).alignment = { wrapText: true };
      } else if (vtype === "money") {
        row.getCell(1).font = { bold: true };
        row.getCell(2).numFmt = "£#,##0.00";
        row.getCell(2).alignment = { horizontal: "right" };
      } else if (vtype === "date") {
        row.getCell(2).numFmt = "dd/mm/yyyy";
      }
    }
    summaryWs.getColumn(1).width = 38;
    summaryWs.getColumn(2).width = 24;
    // Disclaimer row is last — set a tall row height for wrapped text
    summaryWs.getRow(summaryRows.length).height = 40;

    // ── Sheet 2: Earnings ─────────────────────────────────────────────────────────
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
        const fmt = `£#,##0.00`;
        const r = earningsWs.addRow([
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          gross,
          deductions,
          net,
          label,
          null,
          null,
          null,
        ]);
        r.getCell(8).numFmt = fmt;
        r.getCell(9).numFmt = fmt;
        r.getCell(10).numFmt = fmt;
        r.getCell(8).alignment = { horizontal: "right" };
        r.getCell(9).alignment = { horizontal: "right" };
        r.getCell(10).alignment = { horizontal: "right" };
        r.getCell(11).font = { italic: true, color: { argb: "FF6B7280" } };
        r.font = { bold: true };
        r.getCell(8).border = { top: { style: "thin", color: { argb: "FFB85C0A" } } };
        r.getCell(9).border = { top: { style: "thin", color: { argb: "FFB85C0A" } } };
        r.getCell(10).border = { top: { style: "thin", color: { argb: "FFB85C0A" } } };
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

    // ── Sheet 3: Expenses ─────────────────────────────────────────────────────────
    const expensesCols: ColSpec[] = [
      { header: "Date", type: "date" },
      { header: "Supplier", type: "text" },
      { header: "Description", type: "text" },
      { header: "Category", type: "text" },
      { header: "Net", type: "money", total: true },
      { header: "VAT", type: "money", total: true },
      { header: "Total", type: "money", total: true },
      { header: "Business use (0–100)", type: "number" },
      { header: "Allowable", type: "money", total: true },
      { header: "Billable", type: "text" },
      { header: "Rebilled", type: "text" },
      { header: "Payment method", type: "text" },
      { header: "Notes", type: "text" },
    ];
    const expensesRows = expenses.map((e) => {
      const total = e.net_amount_pence + e.vat_amount_pence;
      const allowable = Math.round((total * e.business_use_percent) / 100);
      return [
        e.expense_date ? new Date(e.expense_date + "T00:00:00Z") : null,
        e.supplier ?? "",
        e.description,
        e.category_name ?? "",
        e.net_amount_pence / 100,
        e.vat_amount_pence / 100,
        total / 100,
        e.business_use_percent,
        allowable / 100,
        e.billable_to_client ? "Yes" : "No",
        e.rebilled ? "Yes" : "No",
        e.payment_method ?? "",
        e.notes ?? "",
      ];
    });
    addTypedSheet(wb, "Expenses", expensesCols, expensesRows);

    // ── Sheet 4: Mileage ──────────────────────────────────────────────────────────
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
    addTypedSheet(wb, "Mileage", mileageCols, mileageRows);

    // ── Sheet 5: Invoices ─────────────────────────────────────────────────────────
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
      const client = (toDetails.company_name as string) ?? (toDetails.contact_name as string) ?? "";
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
    addTypedSheet(wb, "Invoices", invoicesCols, invoicesRows);

    // ── Sheet 6: Kit ──────────────────────────────────────────────────────────────
    const kitCols: ColSpec[] = [
      { header: "Item", type: "text" },
      { header: "Category", type: "text" },
      { header: "Purchase date", type: "date" },
      { header: "Purchase price", type: "money" },
      { header: "Serial", type: "text" },
      { header: "Status", type: "text" },
      { header: "Notes", type: "text" },
    ];
    const kitRows = kit.map((item) => [
      item.name,
      item.category,
      item.purchase_date ? new Date(item.purchase_date + "T00:00:00Z") : null,
      item.purchase_price_pence != null ? item.purchase_price_pence / 100 : null,
      item.serial_number ?? "",
      item.status,
      item.condition_notes ?? "",
    ]);
    addTypedSheet(wb, "Kit", kitCols, kitRows);

    // ── Stream response ───────────────────────────────────────────────────────────
    const filename = `eventlink-books-${from}-to-${to}.xlsx`;
    await streamWorkbook(wb, res, filename);
  } catch (err) {
    console.error("booksExportWorkbook error:", err);
    if (!res.headersSent) return res.status(500).json({ error: "Failed to generate workbook" });
  }
}
