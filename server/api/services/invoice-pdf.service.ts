import PDFDocument from "pdfkit";
import https from "https";
import http from "http";
import type { Invoice, FreelancerBillingProfile } from "@shared/schema";
import { ObjectStorageService } from "../utils/object-storage";

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    // R2 object key (not a full URL) — fetch directly via SDK
    if (!url.startsWith("http")) {
      return await ObjectStorageService.downloadObjectBuffer(url);
    }
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    return await new Promise<Buffer>((resolve, reject) => {
      lib
        .get(url, (res) => {
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
          res.on("error", reject);
        })
        .on("error", reject);
    });
  } catch (err) {
    console.error("fetchImageBuffer failed for", url, err);
    return null;
  }
}

export interface InvoiceRenderData {
  invoice: Invoice;
  billingProfile: FreelancerBillingProfile;
}

const DARK = "#111827";
const MUTED = "#6B7280";
const ACCENT = "#1B2A4A";
const LINE = "#E5E7EB";

export async function renderInvoicePDF(data: InvoiceRenderData): Promise<Buffer> {
  const logoBuffer = data.billingProfile.logo_url
    ? await fetchImageBuffer(data.billingProfile.logo_url)
    : null;

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

    // ── Logo (if set) ─────────────────────────────────────────────────────────
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, L, y, { height: 40, fit: [200, 40] });
        y += 52;
      } catch {
        // logo failed to render — continue without it
      }
    }

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
  const logoBuffer = billingProfile.logo_url
    ? await fetchImageBuffer(billingProfile.logo_url)
    : null;

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

    // ── Logo (if set) ─────────────────────────────────────────────────────────
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, L, y, { height: 40, fit: [200, 40] });
        y += 52;
      } catch {
        // logo failed to render — continue without it
      }
    }

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
        doc.text(`Sort code: ${billingProfile.bank_sort_code}`, L, fy);
        fy += 11;
      }
      if (billingProfile.bank_account_number) {
        doc.text(`Account: ${billingProfile.bank_account_number}`, L, fy);
        fy += 11;
      }
      if (billingProfile.bank_iban) {
        doc.text(`IBAN: ${billingProfile.bank_iban}`, L, fy);
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

// ── Blank template (Word .docx) ───────────────────────────────────────────────

export async function renderBlankTemplateDoc(
  billingProfile: FreelancerBillingProfile
): Promise<Buffer> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    ShadingType,
    UnderlineType,
  } = await import("docx");

  const prefix = billingProfile.invoice_prefix ?? "INV";
  const fromLines = buildFromLines(billingProfile);
  const terms =
    billingProfile.invoice_footer_note ||
    `Payment due within ${billingProfile.payment_terms_days ?? 30} days of invoice date.`;

  const hasBank =
    billingProfile.bank_account_name ||
    billingProfile.bank_sort_code ||
    billingProfile.bank_account_number ||
    billingProfile.bank_iban;

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  const DXA = WidthType.DXA;
  const PAGE_W = 11906; // A4 width in DXA
  const MARGIN = 1440; // 1 inch
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const HALF = Math.floor(CONTENT_W / 2);

  const labelRun = (text: string) =>
    new TextRun({ text, font: "Arial", size: 14, color: "6B7280", bold: true, allCaps: true });

  const bodyRun = (text: string) => new TextRun({ text, font: "Arial", size: 18, color: "111827" });

  const mutedRun = (text: string) =>
    new TextRun({ text, font: "Arial", size: 16, color: "6B7280" });

  const underlineRun = (width: number) =>
    new TextRun({
      text: " ".repeat(width),
      font: "Arial",
      size: 18,
      underline: { type: UnderlineType.SINGLE, color: "9CA3AF" },
    });

  // Header table: Invoice title (left) + number/dates (right)
  const headerTable = new Table({
    width: { size: CONTENT_W, type: DXA },
    columnWidths: [HALF, HALF],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorder,
            width: { size: HALF, type: DXA },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Invoice",
                    font: "Arial",
                    size: 56,
                    bold: true,
                    color: "1B2A4A",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: noBorder,
            width: { size: HALF, type: DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `${prefix}-`, font: "Arial", size: 20, color: "6B7280" }),
                  underlineRun(8),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [mutedRun("Date:  "), underlineRun(10)],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [mutedRun("Due:   "), underlineRun(10)],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Rule paragraph
  const rulePara = new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB" } },
    spacing: { before: 160, after: 160 },
    children: [],
  });

  // From / Bill To table
  const fromCells = [
    new Paragraph({ children: [labelRun("FROM")] }),
    ...fromLines.map((l) => new Paragraph({ children: [bodyRun(l)] })),
  ];

  const toBillCells = [
    new Paragraph({ children: [labelRun("BILL TO")] }),
    new Paragraph({ children: [bodyRun("Company: "), underlineRun(20)] }),
    new Paragraph({ children: [bodyRun("Contact: "), underlineRun(20)] }),
    new Paragraph({ children: [bodyRun("Address: "), underlineRun(20)] }),
    new Paragraph({ children: [bodyRun("City/Post: "), underlineRun(18)] }),
    new Paragraph({ children: [bodyRun("Email: "), underlineRun(22)] }),
  ];

  const fromBillTable = new Table({
    width: { size: CONTENT_W, type: DXA },
    columnWidths: [HALF, HALF],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorder,
            width: { size: HALF, type: DXA },
            children: fromCells,
          }),
          new TableCell({
            borders: noBorder,
            width: { size: HALF, type: DXA },
            children: toBillCells,
          }),
        ],
      }),
    ],
  });

  // Line items table
  const colDesc = Math.round(CONTENT_W * 0.42);
  const colRate = Math.round(CONTENT_W * 0.14);
  const colQty = Math.round(CONTENT_W * 0.1);
  const colUnit = Math.round(CONTENT_W * 0.17);
  const colAmt = CONTENT_W - colDesc - colRate - colQty - colUnit;

  const thCell = (text: string, w: number, align: string = AlignmentType.LEFT) =>
    new TableCell({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: "F9FAFB" },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      width: { size: w, type: DXA },
      children: [
        new Paragraph({
          alignment: align as any,
          children: [
            new TextRun({
              text,
              font: "Arial",
              size: 14,
              bold: true,
              color: "6B7280",
              allCaps: true,
            }),
          ],
        }),
      ],
    });

  const tdCell = (w: number, align: string = AlignmentType.LEFT) =>
    new TableCell({
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: "F3F4F6" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      width: { size: w, type: DXA },
      children: [new Paragraph({ alignment: align as any, children: [bodyRun(" ")] })],
    });

  const blankRows = [1, 2, 3, 4].map(
    () =>
      new TableRow({
        children: [
          tdCell(colDesc),
          tdCell(colRate),
          tdCell(colQty),
          tdCell(colUnit, AlignmentType.RIGHT),
          tdCell(colAmt, AlignmentType.RIGHT),
        ],
      })
  );

  const subtotalRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 3,
        borders: noBorder,
        width: { size: colDesc + colRate + colQty, type: DXA },
        children: [new Paragraph({ children: [] })],
      }),
      new TableCell({
        borders: {
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" },
          top: noBorder.top,
          left: noBorder.left,
          right: noBorder.right,
        },
        width: { size: colUnit, type: DXA },
        children: [
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [mutedRun("Subtotal")] }),
        ],
      }),
      new TableCell({
        borders: {
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "E5E7EB" },
          top: noBorder.top,
          left: noBorder.left,
          right: noBorder.right,
        },
        width: { size: colAmt, type: DXA },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [underlineRun(10)] })],
      }),
    ],
  });

  const totalRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 3,
        borders: noBorder,
        width: { size: colDesc + colRate + colQty, type: DXA },
        children: [new Paragraph({ children: [] })],
      }),
      new TableCell({
        borders: noBorder,
        width: { size: colUnit, type: DXA },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "Total", font: "Arial", size: 22, bold: true, color: "1B2A4A" }),
            ],
          }),
        ],
      }),
      new TableCell({
        borders: noBorder,
        width: { size: colAmt, type: DXA },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: " ",
                font: "Arial",
                size: 22,
                bold: true,
                underline: { type: UnderlineType.SINGLE, color: "9CA3AF" },
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const lineItemsTable = new Table({
    width: { size: CONTENT_W, type: DXA },
    columnWidths: [colDesc, colRate, colQty, colUnit, colAmt],
    rows: [
      new TableRow({
        children: [
          thCell("Description", colDesc),
          thCell("Rate Type", colRate),
          thCell("Qty", colQty),
          thCell("Unit Price", colUnit, AlignmentType.RIGHT),
          thCell("Amount", colAmt, AlignmentType.RIGHT),
        ],
      }),
      ...blankRows,
      subtotalRow,
      totalRow,
    ],
  });

  // Notes section
  const notesSection = [
    new Paragraph({
      spacing: { before: 240 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB" } },
      children: [labelRun("Notes")],
    }),
    new Paragraph({
      spacing: { before: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" } },
      children: [bodyRun(" ")],
    }),
    new Paragraph({
      spacing: { before: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" } },
      children: [bodyRun(" ")],
    }),
  ];

  // Bank details rows
  const bankLines: InstanceType<typeof Paragraph>[] = [];
  if (hasBank) {
    bankLines.push(new Paragraph({ children: [labelRun("Payment Details")] }));
    if (billingProfile.bank_account_name)
      bankLines.push(
        new Paragraph({ children: [bodyRun(`Account name: ${billingProfile.bank_account_name}`)] })
      );
    if (billingProfile.bank_sort_code)
      bankLines.push(
        new Paragraph({
          children: [
            bodyRun(
              `Sort code: XX-XX-${billingProfile.bank_sort_code.replace(/\D/g, "").slice(-2)}`
            ),
          ],
        })
      );
    if (billingProfile.bank_account_number)
      bankLines.push(
        new Paragraph({
          children: [bodyRun(`Account: XXXX${billingProfile.bank_account_number.slice(-4)}`)],
        })
      );
    if (billingProfile.bank_iban)
      bankLines.push(
        new Paragraph({
          children: [
            bodyRun(
              `IBAN: ${billingProfile.bank_iban.slice(0, 4)}****${billingProfile.bank_iban.slice(-4)}`
            ),
          ],
        })
      );
  }

  // Footer table (bank left, terms right)
  const footerTable = new Table({
    width: { size: CONTENT_W, type: DXA },
    columnWidths: [HALF, HALF],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: { ...noBorder, top: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB" } },
            width: { size: HALF, type: DXA },
            children: bankLines.length ? bankLines : [new Paragraph({ children: [] })],
          }),
          new TableCell({
            borders: { ...noBorder, top: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB" } },
            width: { size: HALF, type: DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: terms, font: "Arial", size: 16, color: "6B7280" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Arial", size: 18, color: "111827" } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        children: [
          headerTable,
          rulePara,
          fromBillTable,
          new Paragraph({ spacing: { before: 240 }, children: [] }),
          lineItemsTable,
          ...notesSection,
          new Paragraph({ spacing: { before: 240 }, children: [] }),
          footerTable,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
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
