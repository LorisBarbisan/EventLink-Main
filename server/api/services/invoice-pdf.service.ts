import PDFDocument from "pdfkit";
import type { Invoice, FreelancerBillingProfile } from "@shared/schema";
import { ObjectStorageService } from "../utils/object-storage";

export interface InvoiceRenderData {
  invoice: Invoice;
  billingProfile: FreelancerBillingProfile;
}

const DARK = "#111827";
const MUTED = "#6B7280";
const ACCENT = "#1B2A4A";
const LINE = "#E5E7EB";

export async function renderInvoicePDF(data: InvoiceRenderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { invoice, billingProfile } = data;
    const from = (invoice.from_details as any) ?? {};
    const to = (invoice.to_details as any) ?? {};
    const lineItems: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
    const currency = invoice.currency ?? "GBP";

    const L = 60; // left margin
    const R = doc.page.width - 60; // right margin
    const W = R - L;
    let y = 60;

    // ── Title + invoice number ─────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(28).fillColor(ACCENT).text("Invoice", L, y);

    const numBlock = [`#${invoice.invoice_number}`];
    if (invoice.issue_date) numBlock.push(`Date: ${fmtDate(invoice.issue_date)}`);
    if (invoice.due_date) numBlock.push(`Due: ${fmtDate(invoice.due_date)}`);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(numBlock.join("\n"), L, y + 6, { width: W, align: "right" });

    y += 52;

    // ── Thin rule ─────────────────────────────────────────────────────────────
    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(1).stroke();
    y += 20;

    // ── From / To ─────────────────────────────────────────────────────────────
    const colW = W / 2 - 10;
    const startY = y;

    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("FROM", L, y);
    y += 11;
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    for (const line of buildAddressLines(from, billingProfile)) {
      doc.text(line, L, y, { width: colW });
      y += 12;
    }

    const toX = L + colW + 20;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("BILL TO", toX, startY);
    let ty = startY + 11;
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    for (const line of buildToLines(to)) {
      doc.text(line, toX, ty, { width: colW });
      ty += 12;
    }

    y = Math.max(y, ty) + 24;

    // ── Line items table ──────────────────────────────────────────────────────
    const cDesc = L;
    const cRate = L + W * 0.52;
    const cQty = L + W * 0.63;
    const cUnit = L + W * 0.73;
    const cAmt = L + W * 0.87;
    const amtW = R - cAmt;

    // Header row
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED);
    doc.text("DESCRIPTION", cDesc, y, { width: cRate - cDesc - 6 });
    doc.text("RATE", cRate, y, { width: cQty - cRate - 4 });
    doc.text("QTY", cQty, y, { width: cUnit - cQty - 4 });
    doc.text("UNIT PRICE", cUnit, y, { width: cAmt - cUnit - 4, align: "right" });
    doc.text("AMOUNT", cAmt, y, { width: amtW, align: "right" });

    y += 13;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 8;

    const RATE_LABELS: Record<string, string> = {
      hour: "Hourly",
      day: "Day rate",
      ot: "Overtime",
      special: "Special",
      flat: "Flat fee",
    };

    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    for (const item of lineItems) {
      const desc = String(item.description ?? "");
      const rateLabel = RATE_LABELS[item.rate_type ?? ""] ?? "";
      const qty = Number(item.quantity ?? 1);
      const unitPence = Number(item.unit_price_pence ?? 0);
      const totalPence = Number(item.total_pence ?? qty * unitPence);
      const confident = item.confident !== false;

      const descH = doc.heightOfString(desc, { width: cRate - cDesc - 10 });
      const rowH = Math.max(descH + (confident ? 0 : 13), 16);

      doc.text(desc, cDesc, y, { width: cRate - cDesc - 10 });
      if (!confident) {
        doc
          .font("Helvetica-Oblique")
          .fontSize(7)
          .fillColor("#EF4444")
          .text("⚠ estimated", cDesc, y + descH);
        doc.font("Helvetica").fontSize(9).fillColor(DARK);
      }
      doc.text(rateLabel, cRate, y, { width: cQty - cRate - 4 });
      doc.text(String(qty), cQty, y, { width: cUnit - cQty - 4 });
      doc.text(formatMoney(unitPence, currency), cUnit, y, {
        width: cAmt - cUnit - 4,
        align: "right",
      });
      doc.text(formatMoney(totalPence, currency), cAmt, y, { width: amtW, align: "right" });

      y += rowH + 8;
    }

    // ── Totals ─────────────────────────────────────────────────────────────────
    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 12;

    const tLabelX = L + W * 0.68;
    const tValueW = R - tLabelX;

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text("Subtotal", tLabelX, y)
      .text(formatMoney(invoice.subtotal_pence, currency), tLabelX, y, {
        width: tValueW,
        align: "right",
      });
    y += 14;

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(ACCENT)
      .text("Total", tLabelX, y)
      .text(formatMoney(invoice.total_pence, currency), tLabelX, y, {
        width: tValueW,
        align: "right",
      });
    y += 22;

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (invoice.notes) {
      doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(0.5).stroke();
      y += 12;
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED).text("NOTES", L, y);
      y += 12;
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#374151")
        .text(invoice.notes, L, y, { width: W });
      y += doc.heightOfString(invoice.notes, { width: W }) + 6;
    }

    // ── Footer (flows below content, not pinned to bottom) ────────────────────
    y += 20;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(1).stroke();
    y += 14;

    const hasBank =
      billingProfile.bank_account_name ||
      billingProfile.bank_sort_code ||
      billingProfile.bank_account_number ||
      billingProfile.bank_iban;

    const terms =
      billingProfile.invoice_footer_note ||
      `Payment due within ${billingProfile.payment_terms_days ?? 30} days of invoice date.`;

    const bankColW = W * 0.55;
    const termsX = hasBank ? L + bankColW + 16 : L;
    const termsW = hasBank ? W - bankColW - 16 : W;

    if (hasBank) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED).text("PAYMENT DETAILS", L, y);
      let fy = y + 11;
      doc.font("Helvetica").fontSize(8).fillColor(DARK);
      if (billingProfile.bank_account_name) {
        doc.text(`Account name: ${billingProfile.bank_account_name}`, L, fy);
        fy += 11;
      }
      if (billingProfile.bank_sort_code) {
        const masked = `XX-XX-${billingProfile.bank_sort_code.replace(/\D/g, "").slice(-2)}`;
        doc.text(`Sort code: ${masked}`, L, fy);
        fy += 11;
      }
      if (billingProfile.bank_account_number) {
        doc.text(`Account: XXXX${billingProfile.bank_account_number.slice(-4)}`, L, fy);
        fy += 11;
      }
      if (billingProfile.bank_iban) {
        const iban = billingProfile.bank_iban;
        doc.text(`IBAN: ${iban.slice(0, 4)}****${iban.slice(-4)}`, L, fy);
      }
    }

    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(terms, termsX, y, {
        width: termsW,
        align: hasBank ? "right" : "left",
      });

    doc.end();
  });
}

// ── Blank template (PDF) ──────────────────────────────────────────────────────

export async function renderBlankTemplatePDF(
  billingProfile: FreelancerBillingProfile
): Promise<Buffer> {
  const today = new Date().toISOString().slice(0, 10);
  const prefix = billingProfile.invoice_prefix ?? "INV";

  const placeholderInvoice = {
    invoice_number: `${prefix}-XXXX`,
    issue_date: today,
    due_date: null,
    from_details: {},
    to_details: {},
    line_items: [
      {
        description: "Description of services",
        rate_type: "day",
        quantity: 1,
        unit_price_pence: 0,
        total_pence: 0,
        confident: true,
      },
    ],
    currency: "GBP",
    subtotal_pence: null,
    total_pence: null,
    vat_pence: 0,
    notes: null,
    id: 0,
    freelancer_id: billingProfile.user_id,
    booking_id: null,
    status: "draft" as const,
    sent_at: null,
    sent_message_id: null,
    marked_sent_externally: false,
    paid_at: null,
    paid_amount_pence: null,
    pdf_key: null,
    archived: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const L = 60;
    const R = doc.page.width - 60;
    const W = R - L;
    let y = 60;

    // Title
    doc.font("Helvetica-Bold").fontSize(28).fillColor(ACCENT).text("Invoice", L, y);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        `#${placeholderInvoice.invoice_number}\nDate: ___________\nDue: ___________`,
        L,
        y + 6,
        { width: W, align: "right" }
      );
    y += 52;

    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(1).stroke();
    y += 20;

    const colW = W / 2 - 10;
    const startY = y;

    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("FROM", L, y);
    y += 11;
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    for (const line of buildAddressLines({}, billingProfile)) {
      doc.text(line, L, y, { width: colW });
      y += 12;
    }

    const toX = L + colW + 20;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("BILL TO", toX, startY);
    let ty = startY + 11;
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    const toFields = [
      "Company name: _______________________",
      "Contact name: ________________________",
      "Address: ____________________________",
      "",
      "City/Postcode: _______________________",
      "Email: _______________________________",
    ];
    for (const line of toFields) {
      doc.text(line, toX, ty, { width: colW });
      ty += 12;
    }

    y = Math.max(y, ty) + 24;

    // Line items header
    const cDesc = L;
    const cRate = L + W * 0.52;
    const cQty = L + W * 0.63;
    const cUnit = L + W * 0.73;
    const cAmt = L + W * 0.87;
    const amtW = R - cAmt;

    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED);
    doc.text("DESCRIPTION", cDesc, y, { width: cRate - cDesc - 6 });
    doc.text("RATE", cRate, y, { width: cQty - cRate - 4 });
    doc.text("QTY", cQty, y, { width: cUnit - cQty - 4 });
    doc.text("UNIT PRICE", cUnit, y, { width: cAmt - cUnit - 4, align: "right" });
    doc.text("AMOUNT", cAmt, y, { width: amtW, align: "right" });
    y += 13;

    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 8;

    // Three blank rows
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    for (let i = 0; i < 3; i++) {
      doc.text("_________________________________", cDesc, y, { width: cRate - cDesc - 10 });
      doc.text("_______", cRate, y, { width: cQty - cRate - 4 });
      doc.text("____", cQty, y, { width: cUnit - cQty - 4 });
      doc.text("__________", cUnit, y, { width: cAmt - cUnit - 4, align: "right" });
      doc.text("__________", cAmt, y, { width: amtW, align: "right" });
      y += 24;
    }

    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 12;

    const tLabelX = L + W * 0.68;
    const tValueW = R - tLabelX;
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Subtotal", tLabelX, y);
    doc.text("__________", tLabelX, y, { width: tValueW, align: "right" });
    y += 14;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(ACCENT).text("Total", tLabelX, y);
    doc.text("__________", tLabelX, y, { width: tValueW, align: "right" });
    y += 22;

    // Notes row
    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 12;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED).text("NOTES", L, y);
    y += 12;
    doc.font("Helvetica").fontSize(9).fillColor(DARK).text("_".repeat(80), L, y, { width: W });
    y += 16;
    doc.text("_".repeat(80), L, y, { width: W });
    y += 30;

    // Footer
    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(1).stroke();
    y += 14;

    const hasBank =
      billingProfile.bank_account_name ||
      billingProfile.bank_sort_code ||
      billingProfile.bank_account_number ||
      billingProfile.bank_iban;

    const terms =
      billingProfile.invoice_footer_note ||
      `Payment due within ${billingProfile.payment_terms_days ?? 30} days of invoice date.`;

    const bankColW = W * 0.55;
    const termsX = hasBank ? L + bankColW + 16 : L;
    const termsW = hasBank ? W - bankColW - 16 : W;

    if (hasBank) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED).text("PAYMENT DETAILS", L, y);
      let fy = y + 11;
      doc.font("Helvetica").fontSize(8).fillColor(DARK);
      if (billingProfile.bank_account_name) {
        doc.text(`Account name: ${billingProfile.bank_account_name}`, L, fy);
        fy += 11;
      }
      if (billingProfile.bank_sort_code) {
        const masked = `XX-XX-${billingProfile.bank_sort_code.replace(/\D/g, "").slice(-2)}`;
        doc.text(`Sort code: ${masked}`, L, fy);
        fy += 11;
      }
      if (billingProfile.bank_account_number) {
        doc.text(`Account: XXXX${billingProfile.bank_account_number.slice(-4)}`, L, fy);
        fy += 11;
      }
      if (billingProfile.bank_iban) {
        const iban = billingProfile.bank_iban;
        doc.text(`IBAN: ${iban.slice(0, 4)}****${iban.slice(-4)}`, L, fy);
      }
    }

    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(terms, termsX, y, { width: termsW, align: hasBank ? "right" : "left" });

    doc.end();
  });
}

// ── Blank template (Word .doc HTML) ──────────────────────────────────────────

export function renderBlankTemplateDoc(billingProfile: FreelancerBillingProfile): string {
  const prefix = billingProfile.invoice_prefix ?? "INV";
  const fromLines = buildFromLines(billingProfile);
  const hasBank =
    billingProfile.bank_account_name ||
    billingProfile.bank_sort_code ||
    billingProfile.bank_account_number ||
    billingProfile.bank_iban;

  const bankHtml = hasBank
    ? `<p style="font-size:9pt;margin:0"><strong>PAYMENT DETAILS</strong><br>
      ${billingProfile.bank_account_name ? `Account name: ${billingProfile.bank_account_name}<br>` : ""}
      ${billingProfile.bank_sort_code ? `Sort code: XX-XX-${billingProfile.bank_sort_code.replace(/\D/g, "").slice(-2)}<br>` : ""}
      ${billingProfile.bank_account_number ? `Account: XXXX${billingProfile.bank_account_number.slice(-4)}<br>` : ""}
      ${billingProfile.bank_iban ? `IBAN: ${billingProfile.bank_iban.slice(0, 4)}****${billingProfile.bank_iban.slice(-4)}<br>` : ""}
    </p>`
    : "";

  const terms =
    billingProfile.invoice_footer_note ||
    `Payment due within ${billingProfile.payment_terms_days ?? 30} days of invoice date.`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>Invoice Template — ${prefix}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111827; margin: 2cm; }
  h1   { font-size: 22pt; color: #1B2A4A; margin: 0 0 4pt; }
  .rule { border-top: 1px solid #E5E7EB; margin: 10pt 0; }
  .row { display: flex; gap: 20pt; }
  .col { flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-top: 12pt; font-size: 9pt; }
  th { background: #F9FAFB; padding: 5pt 4pt; text-align: left; font-size: 8pt; color: #6B7280; border-bottom: 1px solid #E5E7EB; }
  td { padding: 7pt 4pt; border-bottom: 1px solid #F3F4F6; }
  .total-row td { border-top: 1px solid #E5E7EB; font-weight: bold; font-size: 11pt; color: #1B2A4A; }
  .footer { margin-top: 20pt; border-top: 1px solid #E5E7EB; padding-top: 10pt; display: flex; gap: 20pt; font-size: 8pt; color: #6B7280; }
  .label { font-size: 7pt; color: #6B7280; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 3pt; }
  .field { border-bottom: 1px solid #9CA3AF; min-width: 120pt; display: inline-block; }
</style>
</head>
<body>
<table style="width:100%;border-collapse:collapse;margin-bottom:10pt">
<tr>
  <td style="vertical-align:top"><h1>Invoice</h1></td>
  <td style="text-align:right;vertical-align:top;font-size:9pt;color:#6B7280">
    <strong>${prefix}-<span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></strong><br>
    Date: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><br>
    Due: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
  </td>
</tr>
</table>
<div class="rule"></div>
<table style="width:100%;border-collapse:collapse;margin-bottom:12pt">
<tr>
  <td style="width:50%;vertical-align:top;padding-right:10pt">
    <div class="label">FROM</div>
    ${fromLines.map((l) => `<div style="font-size:9pt">${escapeHtml(l)}</div>`).join("")}
  </td>
  <td style="width:50%;vertical-align:top;padding-left:10pt">
    <div class="label">BILL TO</div>
    <div style="font-size:9pt">Company: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div style="font-size:9pt">Contact: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div style="font-size:9pt">Address: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div style="font-size:9pt">City/Post: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div style="font-size:9pt">Email: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
  </td>
</tr>
</table>
<table>
<thead><tr>
  <th style="width:45%">DESCRIPTION</th>
  <th>RATE TYPE</th>
  <th>QTY</th>
  <th style="text-align:right">UNIT PRICE</th>
  <th style="text-align:right">AMOUNT</th>
</tr></thead>
<tbody>
${[1, 2, 3, 4]
  .map(
    () => `<tr>
  <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
  <td style="text-align:right">&nbsp;</td>
  <td style="text-align:right">&nbsp;</td>
</tr>`
  )
  .join("\n")}
<tr>
  <td colspan="3"></td>
  <td style="text-align:right;font-size:8pt;color:#6B7280">Subtotal</td>
  <td style="text-align:right">&nbsp;</td>
</tr>
<tr class="total-row">
  <td colspan="3"></td>
  <td style="text-align:right">Total</td>
  <td style="text-align:right">&nbsp;</td>
</tr>
</tbody>
</table>
<div style="margin-top:14pt;font-size:9pt;color:#374151">
  <div class="label">NOTES</div>
  <div style="border-bottom:1px solid #D1D5DB;padding-bottom:6pt;min-height:20pt">&nbsp;</div>
  <div style="border-bottom:1px solid #D1D5DB;padding-bottom:6pt;min-height:20pt;margin-top:6pt">&nbsp;</div>
</div>
<div class="footer">
  <div style="flex:1">${bankHtml}</div>
  <div style="flex:1;text-align:right">${escapeHtml(terms)}</div>
</div>
</body>
</html>`;
}

function buildFromLines(profile: FreelancerBillingProfile): string[] {
  const lines: string[] = [];
  if (profile.trading_name) lines.push(profile.trading_name);
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
  if (pence == null) return "—";
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
  if (to.company) lines.push(to.company);
  if (to.name) lines.push(to.name);
  if (to.address_line1) lines.push(to.address_line1);
  if (to.address_line2) lines.push(to.address_line2);
  const cityPost = [to.city, to.postcode].filter(Boolean).join("  ");
  if (cityPost) lines.push(cityPost);
  if (to.country) lines.push(to.country);
  if (to.email) lines.push(to.email);
  return lines.length ? lines : ["(client details not set)"];
}
