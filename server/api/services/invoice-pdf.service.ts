import PDFDocument from "pdfkit";
import type { Invoice, FreelancerBillingProfile } from "@shared/schema";
import { ObjectStorageService } from "../utils/object-storage";

export interface InvoiceRenderData {
  invoice: Invoice;
  billingProfile: FreelancerBillingProfile;
}

const BRAND = "#1B2A4A";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

/**
 * Render a single-page A4 invoice PDF and return its Buffer.
 * Never throws on missing optional fields — renders blanks instead.
 */
export async function renderInvoicePDF(data: InvoiceRenderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { invoice, billingProfile } = data;
    const from = (invoice.from_details as any) ?? {};
    const to = (invoice.to_details as any) ?? {};
    const lineItems: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];

    const W = doc.page.width - 100; // usable width (margins 50 each side)
    let y = 50;

    // ── Header band ────────────────────────────────────────────────────────────
    doc.rect(50, y, W, 60).fill(BRAND);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#FFFFFF")
      .text("INVOICE", 65, y + 18);

    doc
      .fontSize(10)
      .fillColor("#FFFFFF")
      .text(`#${invoice.invoice_number}`, doc.page.width - 180, y + 10, {
        width: 130,
        align: "right",
      });

    if (invoice.issue_date) {
      doc.text(`Date: ${fmtDate(invoice.issue_date)}`, doc.page.width - 180, y + 24, {
        width: 130,
        align: "right",
      });
    }
    if (invoice.due_date) {
      doc.text(`Due: ${fmtDate(invoice.due_date)}`, doc.page.width - 180, y + 38, {
        width: 130,
        align: "right",
      });
    }

    y += 75;

    // ── From / To columns ──────────────────────────────────────────────────────
    const colW = W / 2 - 10;

    doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND).text("FROM", 50, y);
    y += 12;
    doc.font("Helvetica").fontSize(9).fillColor("#111827");
    const fromLines = buildAddressLines(from, billingProfile);
    for (const line of fromLines) {
      doc.text(line, 50, y, { width: colW });
      y += 12;
    }

    // Reset y to two-col start for To column
    const toY = y - 12 * fromLines.length - 12;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(BRAND)
      .text("BILL TO", 50 + colW + 20, toY);
    let toLineY = toY + 12;
    doc.font("Helvetica").fontSize(9).fillColor("#111827");
    const toLines = buildToLines(to);
    for (const line of toLines) {
      doc.text(line, 50 + colW + 20, toLineY, { width: colW });
      toLineY += 12;
    }

    y = Math.max(y, toLineY) + 16;

    // ── Divider ───────────────────────────────────────────────────────────────
    doc
      .moveTo(50, y)
      .lineTo(50 + W, y)
      .strokeColor(LINE)
      .lineWidth(1)
      .stroke();
    y += 12;

    // ── Line items table ──────────────────────────────────────────────────────
    const colDesc = 0;
    const colQty = W * 0.55;
    const colUnit = W * 0.68;
    const colTotal = W * 0.82;

    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
    doc.text("DESCRIPTION", 50 + colDesc, y, { width: colQty - 5 });
    doc.text("QTY", 50 + colQty, y, { width: 40 });
    doc.text("UNIT PRICE", 50 + colUnit, y, { width: 60 });
    doc.text("AMOUNT", 50 + colTotal, y, { width: W - colTotal, align: "right" });
    y += 14;

    doc
      .moveTo(50, y)
      .lineTo(50 + W, y)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    y += 6;

    const currency = invoice.currency ?? "GBP";
    doc.font("Helvetica").fontSize(9).fillColor("#111827");
    for (const item of lineItems) {
      const desc = String(item.description ?? "");
      const qty = Number(item.quantity ?? 1);
      const unitPence = Number(item.unit_price_pence ?? 0);
      const totalPence = Number(item.total_pence ?? qty * unitPence);
      const confident = item.confident !== false;

      const descHeight = doc.heightOfString(desc, { width: colQty - 10 });
      doc.text(desc, 50 + colDesc, y, { width: colQty - 10 });
      if (!confident) {
        doc
          .font("Helvetica-Oblique")
          .fontSize(7)
          .fillColor("#EF4444")
          .text("⚠ estimated — please verify", 50 + colDesc, y + descHeight, {
            width: colQty - 10,
          });
        doc.font("Helvetica").fontSize(9).fillColor("#111827");
      }
      doc.text(String(qty), 50 + colQty, y, { width: 40 });
      doc.text(formatMoney(unitPence, currency), 50 + colUnit, y, { width: 60 });
      doc.text(formatMoney(totalPence, currency), 50 + colTotal, y, {
        width: W - colTotal,
        align: "right",
      });
      y += Math.max(descHeight + (confident ? 0 : 12), 16) + 4;
    }

    y += 4;
    doc
      .moveTo(50, y)
      .lineTo(50 + W, y)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    y += 10;

    // ── Totals ─────────────────────────────────────────────────────────────────
    const labelX = 50 + W * 0.65;
    const valueX = 50 + W * 0.82;
    const valueW = W - W * 0.82;

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text("Subtotal", labelX, y)
      .text(formatMoney(invoice.subtotal_pence, currency), valueX, y, {
        width: valueW,
        align: "right",
      });
    y += 14;

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(BRAND)
      .text("Total", labelX, y)
      .text(formatMoney(invoice.total_pence, currency), valueX, y, {
        width: valueW,
        align: "right",
      });
    y += 20;

    // ── Notes ──────────────────────────────────────────────────────────────────
    if (invoice.notes) {
      doc
        .moveTo(50, y)
        .lineTo(50 + W, y)
        .strokeColor(LINE)
        .lineWidth(0.5)
        .stroke();
      y += 10;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("NOTES", 50, y);
      y += 12;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#374151")
        .text(invoice.notes, 50, y, { width: W });
      y += doc.heightOfString(invoice.notes, { width: W }) + 10;
    }

    // ── Footer: bank details + terms ──────────────────────────────────────────
    const footerY = doc.page.height - 130;
    doc
      .moveTo(50, footerY)
      .lineTo(50 + W, footerY)
      .strokeColor(LINE)
      .lineWidth(1)
      .stroke();

    let fy = footerY + 10;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND).text("PAYMENT DETAILS", 50, fy);
    fy += 12;
    doc.font("Helvetica").fontSize(8).fillColor("#374151");

    if (billingProfile.bank_account_name) {
      doc.text(`Account name: ${billingProfile.bank_account_name}`, 50, fy);
      fy += 11;
    }
    if (billingProfile.bank_sort_code) {
      // Masked: show last 4 only (XX-XX-NNNN)
      const masked = `XX-XX-${billingProfile.bank_sort_code.replace(/\D/g, "").slice(-2)}`;
      doc.text(`Sort code: ${masked}`, 50, fy);
      fy += 11;
    }
    if (billingProfile.bank_account_number) {
      const masked = `XXXX${billingProfile.bank_account_number.slice(-4)}`;
      doc.text(`Account: ${masked}`, 50, fy);
      fy += 11;
    }
    if (billingProfile.bank_iban) {
      const iban = billingProfile.bank_iban;
      const masked = `${iban.slice(0, 4)}****${iban.slice(-4)}`;
      doc.text(`IBAN: ${masked}`, 50, fy);
      fy += 11;
    }

    const termsNote =
      billingProfile.invoice_footer_note ||
      `Payment due within ${billingProfile.payment_terms_days} days of invoice date.`;
    doc
      .font("Helvetica-Oblique")
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(termsNote, 50, fy, { width: W });

    doc.end();
  });
}

/**
 * Upload a rendered PDF to R2 and return its storage key.
 */
export async function storeInvoicePDF(
  freelancerId: number,
  invoiceId: number,
  pdfBuffer: Buffer
): Promise<string> {
  const key = `invoices/${freelancerId}/${invoiceId}.pdf`;
  await ObjectStorageService.uploadBuffer(key, "application/pdf", pdfBuffer);
  return key;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMoney(pence: number | null | undefined, currency: string): string {
  if (pence == null) return "-";
  const amount = pence / 100;
  const symbol =
    currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const s = typeof d === "string" ? d : d.toISOString().slice(0, 10);
  const [y, m, day] = s.slice(0, 10).split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function buildAddressLines(from: any, profile: FreelancerBillingProfile): string[] {
  const lines: string[] = [];
  const name = from.name ?? profile.trading_name;
  if (name) lines.push(name);
  if (profile.address_line1) lines.push(profile.address_line1);
  if (profile.address_line2) lines.push(profile.address_line2);
  const cityPost = [profile.city, profile.postcode].filter(Boolean).join("  ");
  if (cityPost) lines.push(cityPost);
  if (profile.country) lines.push(profile.country);
  if (profile.email) lines.push(profile.email);
  if (profile.phone) lines.push(profile.phone);
  if (profile.utr) lines.push(`UTR: ${profile.utr}`);
  if (profile.company_number) lines.push(`Co. No: ${profile.company_number}`);
  return lines.length ? lines : ["(no billing address set)"];
}

function buildToLines(to: any): string[] {
  const lines: string[] = [];
  if (to.company_name) lines.push(to.company_name);
  if (to.contact_name) lines.push(to.contact_name);
  if (to.address_line1) lines.push(to.address_line1);
  if (to.address_line2) lines.push(to.address_line2);
  const cityPost = [to.city, to.postcode].filter(Boolean).join("  ");
  if (cityPost) lines.push(cityPost);
  if (to.country) lines.push(to.country);
  if (to.email) lines.push(to.email);
  return lines.length ? lines : ["(client details not set)"];
}
