/**
 * GET /api/exports/earnings.csv  — earnings entries (cash-basis or accruals)
 * GET /api/exports/kit.csv       — kit register
 * GET /api/exports/invoices.csv  — invoices (replaces the ExcelJS xlsx endpoint for CSV consumers)
 *
 * Query params common to earnings:
 *   from=YYYY-MM-DD  to=YYYY-MM-DD  basis=cash|accruals
 *
 * All responses are RFC-4180 CSV with UTF-8 BOM so Excel on Windows works.
 *
 * Column sets are compatible with both Xero and FreeAgent bulk-import formats.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { authenticateJWT, requirePro } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { storage } from "../../storage";
import { buildCsv, penceToCsvDecimal, dateToCsvDate, exportFilename } from "../utils/csv";
import { currentTaxYear } from "@shared/tax-periods";

const router = Router();
const auth = [authenticateJWT, requirePro, requireRole("freelancer")];

// ── Helper: send CSV response ─────────────────────────────────────────────────

function sendCsv(res: Response, filename: string, csv: string) {
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  });
  res.send(csv);
}

// ── GET /api/exports/earnings.csv ─────────────────────────────────────────────
//
// Xero-compatible: ContactName, Description, Quantity, UnitAmount, AccountCode,
//                  TaxType, TrackingName1, TrackingOption1
// FreeAgent-compatible: Date, Description, Net Amount, Tax Amount, Currency
// Internal columns: id, source, booking_id, invoice_id, status, needs_review,
//                   paid_date, paid_amount, deductions, expenses_rebilled
//
// We emit ALL columns so accountants can filter as needed.

router.get("/earnings.csv", auth, async (req: Request, res: Response) => {
  try {
    const freelancerId = req.user!.id;
    const basis = (req.query.basis as "cash" | "accruals") ?? "cash";
    const ty = currentTaxYear();
    const from = (req.query.from as string) ?? ty.from;
    const to = (req.query.to as string) ?? ty.to;

    const entries = await storage.listEarningsEntries(freelancerId, { archived: false });

    // Filter by date range using the appropriate date column
    const dateCol = (e: (typeof entries)[0]) =>
      basis === "cash" ? e.paid_date : (e.invoiced_date ?? e.work_date);

    const filtered = entries.filter((e) => {
      const d = dateCol(e);
      if (!d) return false;
      return d >= from && d <= to;
    });

    // Fetch client/role names in bulk
    const [clients, roles] = await Promise.all([
      storage.listEarningsClients(freelancerId),
      storage.listEarningsRoles(freelancerId),
    ]);
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const roleMap = new Map(roles.map((r) => [r.id, r.label]));

    const headers = [
      // Xero / FreeAgent primary import fields
      "Date",
      "Description",
      "Currency",
      "Gross Amount",
      "Expenses Rebilled",
      "Deductions",
      "Net (Gross - Deductions)",
      "Paid Date",
      "Paid Amount",
      "Status",
      // Context / tracking
      "Client",
      "Role",
      "Venue",
      "Work End Date",
      "Unit",
      "Quantity",
      "Unit Rate",
      "Source",
      "Booking ID",
      "Invoice ID",
      "Needs Review",
      "Notes",
      "Entry ID",
    ];

    const rows = filtered.map((e) => {
      const gross = penceToCsvDecimal(e.gross_amount_pence);
      const expenses = penceToCsvDecimal(e.expenses_rebilled_pence);
      const deductions = penceToCsvDecimal(e.deductions_pence);
      const net = penceToCsvDecimal(e.gross_amount_pence - (e.deductions_pence ?? 0));
      return [
        dateToCsvDate(e.work_date),
        e.description,
        e.currency,
        gross,
        expenses,
        deductions,
        net,
        dateToCsvDate(e.paid_date),
        penceToCsvDecimal(e.paid_amount_pence),
        e.status,
        e.client_id ? (clientMap.get(e.client_id) ?? "") : "",
        e.role_id ? (roleMap.get(e.role_id) ?? "") : "",
        e.venue ?? "",
        dateToCsvDate(e.work_end_date),
        e.unit,
        e.quantity,
        penceToCsvDecimal(e.unit_amount_pence),
        e.source,
        e.booking_id ?? "",
        e.invoice_id ?? "",
        e.needs_review ? "yes" : "no",
        e.notes ?? "",
        e.id,
      ];
    });

    const filename = exportFilename(`eventlink-earnings-${basis}`, from, to);
    sendCsv(res, filename, buildCsv({ headers, rows }));
  } catch (err) {
    console.error("earnings CSV export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

// ── GET /api/exports/kit.csv ──────────────────────────────────────────────────
//
// Designed for insurance schedules and accountant capital-allowances workings.
// Columns also align with FreeAgent asset register expectations.

router.get("/kit.csv", auth, async (req: Request, res: Response) => {
  try {
    const freelancerId = req.user!.id;
    const includeDisposed = req.query.includeDisposed === "true";
    const items = await storage.listKitItems(freelancerId, includeDisposed);

    const headers = [
      "Name",
      "Category",
      "Manufacturer",
      "Model",
      "Serial Number",
      "Quantity",
      "Status",
      "Currency",
      "Purchase Price",
      "Purchase Date",
      "Supplier",
      "Funding Method",
      "Business Use %",
      "Replacement Value",
      "Condition Notes",
      "Disposal Date",
      "Disposal Proceeds",
      "Disposal Notes",
      "Item ID",
    ];

    const rows = items.map((item) => [
      item.name,
      item.category,
      item.manufacturer ?? "",
      item.model ?? "",
      item.serial_number ?? "",
      item.quantity,
      item.status,
      item.currency,
      penceToCsvDecimal(item.purchase_price_pence),
      dateToCsvDate(item.purchase_date),
      item.supplier ?? "",
      item.funding_method,
      item.business_use_percent,
      penceToCsvDecimal(item.replacement_value_pence),
      item.condition_notes ?? "",
      dateToCsvDate(item.disposal_date),
      penceToCsvDecimal(item.disposal_proceeds_pence),
      item.disposal_notes ?? "",
      item.id,
    ]);

    const today = new Date().toISOString().slice(0, 10);
    sendCsv(res, `eventlink-kit-${today}.csv`, buildCsv({ headers, rows }));
  } catch (err) {
    console.error("kit CSV export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

// ── GET /api/exports/invoices.csv ─────────────────────────────────────────────
//
// Xero:       *ContactName, *InvoiceNumber, *InvoiceDate, *DueDate, *Description,
//             *Quantity, *UnitAmount, *AccountCode, *TaxType, Currency
// FreeAgent:  Date, Reference, Total, Tax Amount, Currency, Status
// We include all relevant fields; importers pick their columns.

router.get("/invoices.csv", auth, async (req: Request, res: Response) => {
  try {
    const freelancerId = req.user!.id;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    let invoices = await storage.getInvoicesByFreelancer(freelancerId);

    if (from) invoices = invoices.filter((inv) => inv.issue_date && inv.issue_date >= from);
    if (to) invoices = invoices.filter((inv) => inv.issue_date && inv.issue_date <= to);

    const headers = [
      // Xero import columns
      "ContactName",
      "InvoiceNumber",
      "InvoiceDate",
      "DueDate",
      "Description",
      "Currency",
      "Quantity",
      "UnitAmount",
      "AccountCode",
      "TaxType",
      // FreeAgent / general
      "Subtotal",
      "VAT",
      "Total",
      "PaidDate",
      "Status",
      "Invoice ID",
    ];

    const rows = invoices.flatMap((inv) => {
      const toDetails = (inv.to_details as Record<string, unknown>) ?? {};
      const contactName =
        (toDetails.company_name as string) ?? (toDetails.contact_name as string) ?? "";
      const lineItems: Array<Record<string, unknown>> = Array.isArray(inv.line_items)
        ? (inv.line_items as Array<Record<string, unknown>>)
        : [];

      if (lineItems.length === 0) {
        // No line items — emit a single summary row
        return [
          [
            contactName,
            inv.invoice_number ?? "",
            dateToCsvDate(inv.issue_date),
            dateToCsvDate(inv.due_date),
            "",
            inv.currency,
            1,
            penceToCsvDecimal(inv.total_pence),
            "200",
            "NONE",
            penceToCsvDecimal(inv.subtotal_pence),
            penceToCsvDecimal(inv.vat_pence),
            penceToCsvDecimal(inv.total_pence),
            dateToCsvDate(inv.paid_at ? String(inv.paid_at) : null),
            inv.status,
            inv.id,
          ],
        ];
      }

      // One CSV row per line item (Xero's preferred format)
      return lineItems.map((line, i) => [
        contactName,
        inv.invoice_number ?? "",
        dateToCsvDate(inv.issue_date),
        dateToCsvDate(inv.due_date),
        (line.description as string) ?? "",
        inv.currency,
        (line.quantity as number) ?? 1,
        penceToCsvDecimal(typeof line.unit_price_pence === "number" ? line.unit_price_pence : null),
        "200",
        "NONE",
        // Summary columns only on first row to avoid duplication
        i === 0 ? penceToCsvDecimal(inv.subtotal_pence) : "",
        i === 0 ? penceToCsvDecimal(inv.vat_pence) : "",
        i === 0 ? penceToCsvDecimal(inv.total_pence) : "",
        i === 0 ? dateToCsvDate(inv.paid_at ? String(inv.paid_at) : null) : "",
        i === 0 ? inv.status : "",
        i === 0 ? inv.id : "",
      ]);
    });

    const today = new Date().toISOString().slice(0, 10);
    const filename =
      from && to
        ? exportFilename("eventlink-invoices", from, to)
        : `eventlink-invoices-${today}.csv`;
    sendCsv(res, filename, buildCsv({ headers, rows }));
  } catch (err) {
    console.error("invoices CSV export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

export default router;
