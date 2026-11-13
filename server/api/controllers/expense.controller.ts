import type { Request, Response } from "express";
import { storage } from "../../storage";
import { buildCsv, penceToCsvDecimal, dateToCsvDate, exportFilename } from "../utils/csv";
import { currentTaxYear } from "@shared/tax-periods";

// ── Expense categories ────────────────────────────────────────────────────────

export async function listCategories(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const cats = await storage.listExpenseCategories(freelancerId);
  return res.json(cats);
}

export async function createCategory(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const normalised = name.trim().toLowerCase();
  try {
    const cat = await storage.createExpenseCategory({
      freelancer_id: freelancerId,
      name: name.trim(),
      normalised_name: normalised,
      is_system: false,
    });
    return res.status(201).json(cat);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Category already exists" });
    throw err;
  }
}

export async function updateCategory(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { name, archived } = req.body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) {
    data.name = name.trim();
    data.normalised_name = name.trim().toLowerCase();
  }
  if (archived !== undefined) data.archived = Boolean(archived);

  const cat = await storage.updateExpenseCategory(id, freelancerId, data);
  if (!cat) return res.status(404).json({ error: "Not found" });
  return res.json(cat);
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function listExpenses(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const { from, to, category_id, booking_id, earnings_entry_id, billable_to_client, page } =
    req.query;

  const result = await storage.listExpenses(freelancerId, {
    from: from as string | undefined,
    to: to as string | undefined,
    category_id: category_id ? parseInt(category_id as string) : undefined,
    booking_id: booking_id ? parseInt(booking_id as string) : undefined,
    earnings_entry_id: earnings_entry_id ? parseInt(earnings_entry_id as string) : undefined,
    billable_to_client:
      billable_to_client !== undefined ? billable_to_client === "true" : undefined,
    page: page ? parseInt(page as string) : 1,
  });

  return res.json(result);
}

export async function getExpense(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const expense = await storage.getExpense(id);
  if (!expense) return res.status(404).json({ error: "Not found" });
  if (expense.freelancer_id !== freelancerId) return res.status(403).json({ error: "Forbidden" });
  return res.json(expense);
}

export async function createExpense(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const {
    category_id,
    booking_id,
    earnings_entry_id,
    supplier,
    description,
    expense_date,
    net_amount_pence,
    vat_amount_pence,
    currency,
    payment_method,
    business_use_percent,
    billable_to_client,
    notes,
  } = req.body;

  if (!description?.trim()) return res.status(400).json({ error: "description is required" });
  if (!expense_date) return res.status(400).json({ error: "expense_date is required" });
  if (net_amount_pence === undefined || net_amount_pence === null)
    return res.status(400).json({ error: "net_amount_pence is required" });

  const expense = await storage.createExpense({
    freelancer_id: freelancerId,
    category_id: category_id ?? null,
    booking_id: booking_id ?? null,
    earnings_entry_id: earnings_entry_id ?? null,
    supplier: supplier?.trim() || null,
    description: description.trim(),
    expense_date,
    net_amount_pence: Number(net_amount_pence),
    vat_amount_pence: Number(vat_amount_pence ?? 0),
    currency: currency ?? "GBP",
    payment_method: payment_method ?? null,
    business_use_percent: Number(business_use_percent ?? 100),
    billable_to_client: Boolean(billable_to_client),
    allowable: req.body.allowable === false || req.body.allowable === "false" ? false : true,
    notes: notes?.trim() || null,
  });

  return res.status(201).json(expense);
}

export async function updateExpense(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const {
    category_id,
    booking_id,
    earnings_entry_id,
    supplier,
    description,
    expense_date,
    net_amount_pence,
    vat_amount_pence,
    currency,
    payment_method,
    business_use_percent,
    billable_to_client,
    rebilled,
    notes,
  } = req.body;

  const data: Record<string, unknown> = {};
  if (category_id !== undefined) data.category_id = category_id;
  if (booking_id !== undefined) data.booking_id = booking_id;
  if (earnings_entry_id !== undefined) data.earnings_entry_id = earnings_entry_id;
  if (supplier !== undefined) data.supplier = supplier?.trim() || null;
  if (description !== undefined) data.description = description.trim();
  if (expense_date !== undefined) data.expense_date = expense_date;
  if (net_amount_pence !== undefined) data.net_amount_pence = Number(net_amount_pence);
  if (vat_amount_pence !== undefined) data.vat_amount_pence = Number(vat_amount_pence);
  if (currency !== undefined) data.currency = currency;
  if (payment_method !== undefined) data.payment_method = payment_method;
  if (business_use_percent !== undefined) data.business_use_percent = Number(business_use_percent);
  if (billable_to_client !== undefined) data.billable_to_client = Boolean(billable_to_client);
  if (rebilled !== undefined) data.rebilled = Boolean(rebilled);
  if (req.body.allowable !== undefined)
    data.allowable = req.body.allowable !== false && req.body.allowable !== "false";
  if (notes !== undefined) data.notes = notes?.trim() || null;

  const expense = await storage.updateExpense(id, freelancerId, data);
  if (!expense) return res.status(404).json({ error: "Not found" });
  return res.json(expense);
}

export async function archiveExpense(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  await storage.archiveExpense(id, freelancerId);
  return res.status(204).send();
}

export async function exportExpenses(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const ty = currentTaxYear();
  const from = (req.query.from as string) || ty.from;
  const to = (req.query.to as string) || ty.to;

  const rows = await storage.listExpensesForExport(freelancerId, from, to);

  const csv = buildCsv({
    headers: [
      "Date",
      "Supplier",
      "Description",
      "Category",
      "Net (£)",
      "VAT (£)",
      "Total (£)",
      "Business Use %",
      "Allowable (£)",
      "Billable",
      "Rebilled",
      "Payment Method",
      "Notes",
    ],
    rows: rows.map((e) => {
      const total = e.net_amount_pence + e.vat_amount_pence;
      const allowable = Math.round((total * e.business_use_percent) / 100);
      return [
        dateToCsvDate(e.expense_date),
        e.supplier ?? "",
        e.description,
        e.category_name ?? "",
        penceToCsvDecimal(e.net_amount_pence),
        penceToCsvDecimal(e.vat_amount_pence),
        penceToCsvDecimal(total),
        e.business_use_percent,
        penceToCsvDecimal(allowable),
        e.billable_to_client ? "Yes" : "No",
        e.rebilled ? "Yes" : "No",
        e.payment_method ?? "",
        e.notes ?? "",
      ];
    }),
  });

  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${exportFilename("expenses", from, to)}"`,
    "Cache-Control": "no-store",
  });
  return res.send(csv);
}
