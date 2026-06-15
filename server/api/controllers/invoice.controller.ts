import { Request, Response } from "express";
import { db } from "../config/db";
import {
  quotes,
  quote_line_items,
  invoices,
  invoice_line_items,
  recruiter_profiles,
} from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

// ── Helpers ────────────────────────────────────────────────────────────────

function calcTotals(
  lines: { quantity: number; unitPrice: number }[],
  vatRate: number,
  discount = 0
) {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) - discount;
  const vatAmount = Math.round((subtotal * vatRate) / 100);
  const total = subtotal + vatAmount;
  return { subtotal, vatAmount, total };
}

async function nextSequence(
  prefix: string,
  table: typeof quotes | typeof invoices,
  field: "quoteNumber" | "invoiceNumber",
  employerId: number
): Promise<string> {
  const existing = await db
    .select({ num: (table as any)[field] })
    .from(table as any)
    .where(eq((table as any).employerId, employerId))
    .orderBy(desc((table as any).createdAt))
    .limit(1);
  const year = new Date().getFullYear();
  if (!existing.length) return `${prefix}-${year}-001`;
  const last = existing[0].num as string;
  const parts = last.split("-");
  const lastNum = parseInt(parts[parts.length - 1] || "0", 10);
  return `${prefix}-${year}-${String(lastNum + 1).padStart(3, "0")}`;
}

// ── QUOTES ─────────────────────────────────────────────────────────────────

export async function listQuotes(req: Request, res: Response) {
  const employerId = req.user!.id;
  const rows = await db
    .select()
    .from(quotes)
    .where(eq(quotes.employerId, employerId))
    .orderBy(desc(quotes.createdAt));
  return res.json(rows);
}

export async function getQuote(req: Request, res: Response) {
  const employerId = req.user!.id;
  const id = parseInt(req.params.id);
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.employerId, employerId)));
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  const lines = await db.select().from(quote_line_items).where(eq(quote_line_items.quoteId, id));
  return res.json({ quote, lines });
}

export async function createQuote(req: Request, res: Response) {
  try {
    const employerId = req.user!.id;
    const { lines = [], discount = 0, vatRate = 20, ...rest } = req.body;
    const quoteNumber = await nextSequence("QT", quotes, "quoteNumber", employerId);
    const totals = calcTotals(lines, vatRate, discount);
    const [quote] = await db
      .insert(quotes)
      .values({ ...rest, employerId, quoteNumber, discount, vatRate, ...totals })
      .returning();
    if (lines.length) {
      await db.insert(quote_line_items).values(
        lines.map((l: any, i: number) => ({
          quoteId: quote.id,
          description: l.description,
          quantity: l.quantity ?? 1,
          unitPrice: l.unitPrice ?? 0,
          total: (l.quantity ?? 1) * (l.unitPrice ?? 0),
          sortOrder: i,
        }))
      );
    }
    return res.status(201).json(quote);
  } catch (err: any) {
    console.error("createQuote error:", err.message);
    return res.status(500).json({ error: "Failed to create quote" });
  }
}

export async function updateQuote(req: Request, res: Response) {
  try {
    const employerId = req.user!.id;
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.employerId, employerId)));
    if (!existing) return res.status(404).json({ error: "Quote not found" });

    const { lines, discount, vatRate, ...rest } = req.body;
    const vat = vatRate ?? existing.vatRate;
    const disc = discount ?? existing.discount ?? 0;

    let totals = {};
    if (lines !== undefined) {
      totals = calcTotals(lines, vat, disc);
      await db.delete(quote_line_items).where(eq(quote_line_items.quoteId, id));
      if (lines.length) {
        await db.insert(quote_line_items).values(
          lines.map((l: any, i: number) => ({
            quoteId: id,
            description: l.description,
            quantity: l.quantity ?? 1,
            unitPrice: l.unitPrice ?? 0,
            total: (l.quantity ?? 1) * (l.unitPrice ?? 0),
            sortOrder: i,
          }))
        );
      }
    }

    const [updated] = await db
      .update(quotes)
      .set({ ...rest, discount: disc, vatRate: vat, ...totals, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return res.json(updated);
  } catch (err: any) {
    console.error("updateQuote error:", err.message);
    return res.status(500).json({ error: "Failed to update quote" });
  }
}

export async function deleteQuote(req: Request, res: Response) {
  const employerId = req.user!.id;
  const id = parseInt(req.params.id);
  await db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.employerId, employerId)));
  return res.json({ success: true });
}

export async function sendQuote(req: Request, res: Response) {
  const employerId = req.user!.id;
  const id = parseInt(req.params.id);
  const [updated] = await db
    .update(quotes)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(and(eq(quotes.id, id), eq(quotes.employerId, employerId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Quote not found" });
  return res.json(updated);
}

// Public acceptance endpoint — no auth required, uses quote ID
export async function acceptQuote(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const { name, ip } = req.body;
    const realIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? "";
    const [updated] = await db
      .update(quotes)
      .set({ status: "accepted", acceptedAt: new Date(), acceptedByName: name ?? null, acceptedByIp: ip ?? realIp, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Quote not found" });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to accept quote" });
  }
}

// Convert accepted quote to invoice
export async function quoteToInvoice(req: Request, res: Response) {
  try {
    const employerId = req.user!.id;
    const id = parseInt(req.params.id);
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.employerId, employerId)));
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const lines = await db.select().from(quote_line_items).where(eq(quote_line_items.quoteId, id));
    const invoiceNumber = await nextSequence("INV", invoices, "invoiceNumber", employerId);
    const today = new Date().toISOString().split("T")[0];
    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [invoice] = await db
      .insert(invoices)
      .values({
        employerId,
        quoteId: id,
        bookingId: quote.bookingId,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        clientCompany: quote.clientCompany,
        clientAddress: quote.clientAddress,
        invoiceNumber,
        eventName: quote.eventName,
        eventDate: quote.eventDate,
        issueDate: today,
        dueDate: due,
        currency: quote.currency,
        subtotal: quote.subtotal,
        vatRate: quote.vatRate,
        vatAmount: quote.vatAmount,
        total: quote.total,
        notes: quote.notes,
        terms: quote.terms,
      })
      .returning();

    if (lines.length) {
      await db.insert(invoice_line_items).values(
        lines.map((l) => ({
          invoiceId: invoice.id,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.total,
          sortOrder: l.sortOrder,
        }))
      );
    }

    return res.status(201).json(invoice);
  } catch (err: any) {
    console.error("quoteToInvoice error:", err.message);
    return res.status(500).json({ error: "Failed to convert quote to invoice" });
  }
}

// ── INVOICES ───────────────────────────────────────────────────────────────

export async function listInvoices(req: Request, res: Response) {
  const employerId = req.user!.id;
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.employerId, employerId))
    .orderBy(desc(invoices.createdAt));
  return res.json(rows);
}

export async function getInvoice(req: Request, res: Response) {
  const employerId = req.user!.id;
  const id = parseInt(req.params.id);
  const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.employerId, employerId)));
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  const lines = await db.select().from(invoice_line_items).where(eq(invoice_line_items.invoiceId, id));
  // Fetch employer profile for invoice header
  const [profile] = await db.select().from(recruiter_profiles).where(eq(recruiter_profiles.user_id, employerId));
  return res.json({ invoice, lines, profile });
}

export async function createInvoice(req: Request, res: Response) {
  try {
    const employerId = req.user!.id;
    const { lines = [], discount = 0, vatRate = 20, ...rest } = req.body;
    const invoiceNumber = await nextSequence("INV", invoices, "invoiceNumber", employerId);
    const totals = calcTotals(lines, vatRate, discount);
    const [invoice] = await db
      .insert(invoices)
      .values({ ...rest, employerId, invoiceNumber, vatRate, ...totals })
      .returning();
    if (lines.length) {
      await db.insert(invoice_line_items).values(
        lines.map((l: any, i: number) => ({
          invoiceId: invoice.id,
          description: l.description,
          quantity: l.quantity ?? 1,
          unitPrice: l.unitPrice ?? 0,
          total: (l.quantity ?? 1) * (l.unitPrice ?? 0),
          sortOrder: i,
        }))
      );
    }
    return res.status(201).json(invoice);
  } catch (err: any) {
    console.error("createInvoice error:", err.message);
    return res.status(500).json({ error: "Failed to create invoice" });
  }
}

export async function updateInvoice(req: Request, res: Response) {
  try {
    const employerId = req.user!.id;
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.employerId, employerId)));
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const { lines, vatRate, ...rest } = req.body;
    const vat = vatRate ?? existing.vatRate;

    let totals = {};
    if (lines !== undefined) {
      totals = calcTotals(lines, vat);
      await db.delete(invoice_line_items).where(eq(invoice_line_items.invoiceId, id));
      if (lines.length) {
        await db.insert(invoice_line_items).values(
          lines.map((l: any, i: number) => ({
            invoiceId: id,
            description: l.description,
            quantity: l.quantity ?? 1,
            unitPrice: l.unitPrice ?? 0,
            total: (l.quantity ?? 1) * (l.unitPrice ?? 0),
            sortOrder: i,
          }))
        );
      }
    }

    const [updated] = await db
      .update(invoices)
      .set({ ...rest, vatRate: vat, ...totals, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return res.json(updated);
  } catch (err: any) {
    console.error("updateInvoice error:", err.message);
    return res.status(500).json({ error: "Failed to update invoice" });
  }
}

export async function markInvoicePaid(req: Request, res: Response) {
  const employerId = req.user!.id;
  const id = parseInt(req.params.id);
  const [updated] = await db
    .update(invoices)
    .set({ status: "paid", paidAt: new Date(), amountPaid: req.body.amountPaid ?? undefined, updatedAt: new Date() })
    .where(and(eq(invoices.id, id), eq(invoices.employerId, employerId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Invoice not found" });
  return res.json(updated);
}

export async function deleteInvoice(req: Request, res: Response) {
  const employerId = req.user!.id;
  const id = parseInt(req.params.id);
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.employerId, employerId)));
  return res.json({ success: true });
}

export async function sendInvoice(req: Request, res: Response) {
  const employerId = req.user!.id;
  const id = parseInt(req.params.id);
  const [updated] = await db
    .update(invoices)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(and(eq(invoices.id, id), eq(invoices.employerId, employerId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Invoice not found" });
  return res.json(updated);
}
