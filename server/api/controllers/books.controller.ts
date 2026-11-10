import type { Request, Response } from "express";
import { storage } from "../../storage";
import { currentTaxYear, taxYearForDate } from "@shared/tax-periods";
import { buildCsv, penceToCsvDecimal, dateToCsvDate, exportFilename } from "../utils/csv";
import { bandsForTaxYear, estimateTax } from "@shared/tax-estimate";
import { createWorkbook, addTypedSheet, streamWorkbook, type ColSpec } from "../utils/xlsx";

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

// ── Monthly breakdown (for charts) ───────────────────────────────────────────

export async function booksMonthly(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const { from, to } = taxYearParams(req);

  const [earningsGroups, expensesRaw, mileageTrips] = await Promise.all([
    storage.earningsSummary(freelancerId, { basis: "cash", from, to, groupBy: "month" }),
    storage.listExpensesForExport(freelancerId, from, to),
    storage.listMileageTrips(freelancerId, from, to),
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
}

// ── Expense category breakdown (for donut chart) ──────────────────────────────

export async function booksExpenseCategories(req: Request, res: Response) {
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

// ── Multi-sheet XLSX export ───────────────────────────────────────────────────

const DISCLAIMER =
  "Figures are estimates produced from the records you entered, for your own use and your accountant's. EventLink does not provide accountancy or tax advice and does not submit anything to HMRC.";

export async function booksExportWorkbook(req: Request, res: Response) {
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

  // Cash-basis filter on earnings
  const filteredEntries = entries.filter((e) => {
    const d = e.paid_date;
    return d && d >= from && d <= to;
  });

  // Filter invoices to period
  const filteredInvoices = invoices.filter(
    (inv) => inv.issue_date && inv.issue_date >= from && inv.issue_date <= to
  );

  const wb = createWorkbook();
  wb.views = [
    { x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: "visible" },
  ];

  // ── Sheet 1: Summary ─────────────────────────────────────────────────────────
  const summaryWs = wb.addWorksheet("Summary", { properties: { tabColor: { argb: "FFD8690E" } } });
  const totalEarningsPence = filteredEntries.reduce(
    (s, e) => s + e.gross_amount_pence - (e.deductions_pence ?? 0),
    0
  );
  const totalExpensesPence = expenses.reduce((s, e) => {
    const total = e.net_amount_pence + e.vat_amount_pence;
    return s + Math.round((total * e.business_use_percent) / 100);
  }, 0);
  const totalMileagePence = trips.reduce((s, t) => s + t.amount_pence, 0);
  const summaryData: [string, string][] = [
    ["Period", `${from} to ${to}`],
    ["Basis", "Cash"],
    ["Generated", new Date().toISOString().slice(0, 10)],
    ["", ""],
    ["Earnings (net)", `£${(totalEarningsPence / 100).toFixed(2)}`],
    ["Expenses (allowable)", `£${(totalExpensesPence / 100).toFixed(2)}`],
    ["Mileage", `£${(totalMileagePence / 100).toFixed(2)}`],
    [
      "Net profit (estimate)",
      `£${((totalEarningsPence - totalExpensesPence - totalMileagePence) / 100).toFixed(2)}`,
    ],
    ["", ""],
    ["Earnings entries", String(filteredEntries.length)],
    ["Expense records", String(expenses.length)],
    ["Mileage trips", String(trips.length)],
    ["Invoices", String(filteredInvoices.length)],
    ["Kit items", String(kit.length)],
    ["", ""],
    ["Disclaimer", DISCLAIMER],
  ];
  for (const [label, value] of summaryData) {
    const row = summaryWs.addRow([label, value]);
    if (label === "Disclaimer") {
      row.getCell(1).font = { bold: true };
      row.getCell(2).alignment = { wrapText: true };
    } else if (label === "" && value === "") {
      // spacer
    } else if (
      ["Earnings (net)", "Expenses (allowable)", "Mileage", "Net profit (estimate)"].includes(label)
    ) {
      row.getCell(1).font = { bold: true };
    }
  }
  summaryWs.getColumn(1).width = 26;
  summaryWs.getColumn(2).width = 72;
  summaryWs.getRow(16).height = 40;

  // ── Sheet 2: Earnings ─────────────────────────────────────────────────────────
  const earningsCols: ColSpec[] = [
    { header: "Date", type: "date" },
    { header: "Client", type: "text" },
    { header: "Role", type: "text" },
    { header: "Description", type: "text" },
    { header: "Unit", type: "text" },
    { header: "Quantity", type: "number" },
    { header: "Gross", type: "money", total: true },
    { header: "Deductions", type: "money", total: true },
    { header: "Net", type: "money", total: true },
    { header: "Status", type: "text" },
    { header: "Paid date", type: "date" },
    { header: "Notes", type: "text" },
  ];
  const earningsRows = filteredEntries.map((e) => [
    e.work_date ? new Date(e.work_date + "T00:00:00Z") : null,
    e.client_id ? (clientMap.get(e.client_id) ?? "") : "",
    e.role_id ? (roleMap.get(e.role_id) ?? "") : "",
    e.description,
    e.unit,
    parseFloat(e.quantity as unknown as string) || 1,
    e.gross_amount_pence / 100,
    (e.deductions_pence ?? 0) / 100,
    (e.gross_amount_pence - (e.deductions_pence ?? 0)) / 100,
    e.status,
    e.paid_date ? new Date(e.paid_date + "T00:00:00Z") : null,
    e.notes ?? "",
  ]);
  addTypedSheet(wb, "Earnings", earningsCols, earningsRows);

  // ── Sheet 3: Expenses ─────────────────────────────────────────────────────────
  const expensesCols: ColSpec[] = [
    { header: "Date", type: "date" },
    { header: "Supplier", type: "text" },
    { header: "Description", type: "text" },
    { header: "Category", type: "text" },
    { header: "Net", type: "money", total: true },
    { header: "VAT", type: "money", total: true },
    { header: "Total", type: "money", total: true },
    { header: "Business use %", type: "number" },
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
}
