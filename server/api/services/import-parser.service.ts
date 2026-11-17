import ExcelJS from "exceljs";
import { createRequire } from "module";
import { and, eq } from "drizzle-orm";
import { db } from "../config/db";
import { import_batches, import_rows } from "@shared/schema";
import { ObjectStorageService } from "../utils/object-storage";
import { computeSignature, lookupMapping } from "./import-mapping.service";
import { markDuplicates } from "./import-dedup.service";
import {
  detectBySheetNames,
  detectByHeaders,
  detectHeaderless,
} from "./import-source-detect.service";
import { extractRowsFromPdf } from "./import-pdf-ai.service";
import {
  parseCsvText,
  looksDelimited,
  rowsFromText,
  largestHtmlTable,
  legacyDocText,
} from "./import-parse-utils";
import {
  findHeaderRow,
  inferColumnMap,
  inferHeaderlessMap,
  pnlReportRows,
  isContactList,
  invoiceFromText,
  sheetDirection,
  type ColumnMap,
  type PnlLine,
} from "./import-table";
import { classifyRow } from "./import-classify";

// pdf-parse v2 is CJS and exports a class; load it with require so it resolves
// the same way under tsx and the esbuild bundle.
const _require = createRequire(import.meta.url);
const { PDFParse } = _require("pdf-parse") as {
  PDFParse: new (opts: { data: Uint8Array }) => {
    getText(): Promise<{ text: string }>;
    destroy(): Promise<void>;
  };
};

interface RawRow {
  [header: string]: string;
}

// ── Segments ──────────────────────────────────────────────────────────────────
// A file becomes one or more segments: each sheet of a workbook, or the one
// table in a CSV / document. Each segment has its own header row and column
// map, so a workbook with a "Gigs" sheet and an "expenses" sheet reads both.

interface Segment {
  rows: RawRow[];
  headers: string[];
  headerless: boolean;
  sheet?: string;
  direction?: "expense" | "earnings" | null;
  /** Column map forced by the reader (single invoices, text extraction). */
  fixedMap?: ColumnMap;
  aiExtracted?: boolean;
}

interface FileRead {
  segments: Segment[];
  /** A P&L report: category totals instead of transactions. */
  pnl?: { period: string | null; lines: PnlLine[] };
  /** Set when the file is a list of contacts, not transactions. */
  notTransactions?: string;
  detectedSource?: string;
}

const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `C${i + 1}`); // A…Z, then C27…

/** A table of cells → a segment, after finding the header row. */
function tableToSegment(table: string[][], sheet?: string): Segment | null {
  const clean = table.map((r) => r.map((c) => (c ?? "").trim()));
  const nonEmpty = clean.filter((r) => r.some((c) => c !== ""));
  if (nonEmpty.length === 0) return null;
  const headerIdx = findHeaderRow(clean);
  const headerless = headerIdx === 0 && detectHeaderless(clean[0]);
  const width = Math.max(...clean.map((r) => r.length));
  const headers = headerless
    ? Array.from({ length: width }, (_, i) => letter(i))
    : Array.from({ length: width }, (_, i) => clean[headerIdx][i] || letter(i));
  const rows: RawRow[] = [];
  for (const cells of clean.slice(headerless ? 0 : headerIdx + 1)) {
    if (!cells.some((c) => c !== "")) continue;
    const obj: RawRow = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    rows.push(obj);
  }
  if (rows.length === 0) return null;
  return { rows, headers, headerless, sheet, direction: sheet ? sheetDirection(sheet) : null };
}

/** Rows from free text: a single invoice, AI extraction, or date…amount lines. */
async function readTextDocument(text: string): Promise<FileRead> {
  const invoice = invoiceFromText(text);
  if (invoice) {
    return {
      segments: [
        {
          rows: [{ ...invoice }],
          headers: Object.keys(invoice),
          headerless: false,
          direction: "earnings",
          fixedMap: {
            date: "Date",
            description: "Description",
            amount: "Amount",
            reference: "Reference",
            payee: "Payee",
          },
        },
      ],
    };
  }
  const textMap: ColumnMap = { date: "Date", description: "Description", amount: "Amount" };
  if (process.env.OPENAI_API_KEY) {
    try {
      const aiRows = await extractRowsFromPdf(text);
      if (aiRows.length > 0) {
        return {
          segments: [
            {
              rows: aiRows.map((r) => ({
                Date: r.date ?? "",
                Description: r.description ?? "",
                Amount: r.amount ?? "",
                Reference: r.reference ?? "",
              })),
              headers: ["Date", "Description", "Amount", "Reference"],
              headerless: false,
              fixedMap: { ...textMap, reference: "Reference" },
              aiExtracted: true,
            },
          ],
        };
      }
    } catch (err) {
      console.warn("[import] AI extraction failed, falling back to text rules:", String(err));
    }
  }
  const rows = rowsFromText(text);
  return {
    segments: rows.length
      ? [
          {
            rows,
            headers: ["Date", "Description", "Amount"],
            headerless: false,
            fixedMap: textMap,
            aiExtracted: true,
          },
        ]
      : [],
  };
}

/** Whole-table checks that come before reading rows: P&L, contact list. */
function inspectTable(table: string[][], sheet?: string): FileRead {
  const pnl = pnlReportRows(table);
  if (pnl && pnl.lines.length) return { segments: [], pnl };
  const seg = tableToSegment(table, sheet);
  if (!seg) return { segments: [] };
  if (!seg.headerless && isContactList(seg.headers)) {
    return {
      segments: [],
      notTransactions:
        "This file is a list of contacts (names, emails, addresses) with no dates or amounts, so there are no transactions to import. Add customers under Books › Clients.",
    };
  }
  return { segments: [seg] };
}

// ── File readers ──────────────────────────────────────────────────────────────

function cellToString(cell: ExcelJS.Cell): string {
  let v = cell.value as unknown;
  // Formula cells carry their value in .result; hyperlinks in .text
  if (v && typeof v === "object" && "result" in (v as object))
    v = (v as { result: unknown }).result;
  if (v && typeof v === "object" && "text" in (v as object) && !("richText" in (v as object)))
    v = (v as { text: unknown }).text;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  }
  return String(v ?? "").trim();
}

function sheetToTable(sheet: ExcelJS.Worksheet): string[][] {
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellToString(cell);
    });
    table[rowNumber - 1] = Array.from(cells, (c) => c ?? "");
  });
  return Array.from(table, (r) => r ?? []);
}

async function readXlsx(buffer: Buffer): Promise<FileRead> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheets = workbook.worksheets.filter((ws) => ws.state !== "hidden" && ws.rowCount > 0);

  // FreeAgent: read its transactions sheet only
  const sheetDetect = detectBySheetNames(sheets.map((ws) => ws.name));
  const chosen = sheetDetect ? sheets.filter((ws) => ws.name === sheetDetect.sheetName) : sheets;

  const out: FileRead = { segments: [], detectedSource: sheetDetect?.source };
  for (const ws of chosen) {
    const part = inspectTable(sheetToTable(ws), ws.name);
    out.segments.push(...part.segments);
    if (part.pnl && !out.pnl) out.pnl = part.pnl;
    if (part.notTransactions && !out.notTransactions) out.notTransactions = part.notTransactions;
  }
  return out;
}

async function readPdf(buffer: Buffer): Promise<FileRead> {
  // pdf-parse v2 is a class: new PDFParse({ data }).getText()
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const { text } = await parser.getText();
    if (!text.trim()) {
      return {
        segments: [],
        notTransactions:
          "This PDF has no readable text (it may be a scanned image). Export the statement as CSV or Excel, or as a PDF with selectable text.",
      };
    }
    return await readTextDocument(text);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/** Word .docx: a single invoice, else its largest table, else its text. */
async function readDocx(buffer: Buffer): Promise<FileRead> {
  const mammoth = await import("mammoth");
  const { value: text } = await mammoth.extractRawText({ buffer });
  if (invoiceFromText(text)) return readTextDocument(text);
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const table = largestHtmlTable(html);
  if (table.length >= 2 && table[0].length >= 2) return inspectTable(table);
  return readTextDocument(text);
}

/** Plain text: a CSV-style table if laid out as one, otherwise free text. */
async function readTxt(buffer: Buffer): Promise<FileRead> {
  const text = buffer.toString("utf8");
  if (looksDelimited(text)) return inspectTable(parseCsvText(text));
  return readTextDocument(text);
}

async function readFile(buffer: Buffer, fileName: string, mimeType: string): Promise<FileRead> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isZip =
    buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  const isOle2 =
    buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;

  if (mimeType === "application/pdf" || ext === "pdf") return readPdf(buffer);
  if (
    ext === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return readDocx(buffer);
  if (ext === "doc" || mimeType === "application/msword") {
    return readTextDocument(
      isOle2 ? legacyDocText(buffer) : buffer.toString("utf8").replace(/\\[a-z]+-?\d* ?|[{}]/g, " ")
    );
  }
  if (ext === "txt" || mimeType === "text/plain") return readTxt(buffer);
  if (isOle2) {
    throw new Error(
      "This is an older Excel file (.xls). Open it in Excel and use Save As → Excel Workbook (.xlsx), then upload again."
    );
  }
  if (isZip) return readXlsx(buffer);
  // CSV: our own reader, so dates are never guessed (08/05 is not 5 August)
  return inspectTable(parseCsvText(buffer.toString("utf8")));
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function parseImportFile(batchId: number, jobId: string): Promise<void> {
  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.parse_job_id, jobId)))
    .limit(1);

  if (!batch || batch.status !== "parsing") return; // stale or already handled

  const fail = (error: string) =>
    db
      .update(import_batches)
      .set({ status: "failed", error, updated_at: new Date() })
      .where(eq(import_batches.id, batchId));

  try {
    const buffer = await ObjectStorageService.downloadObjectBuffer(batch.file_key);
    const file = await readFile(buffer, batch.file_name, batch.mime_type);

    if (file.detectedSource) {
      await db
        .update(import_batches)
        .set({ source: file.detectedSource as typeof batch.source, updated_at: new Date() })
        .where(eq(import_batches.id, batchId));
    }

    const toInsert: (typeof import_rows.$inferInsert)[] = [];
    let rowNumber = 0;

    // P&L report: one summary line per category (totals, not transactions)
    if (file.pnl) {
      for (const line of file.pnl.lines) {
        toInsert.push({
          batch_id: batchId,
          row_number: ++rowNumber,
          raw: { Category: line.label, Section: line.section, Period: file.pnl.period ?? "" },
          parsed: {
            description: line.label,
            period: file.pnl.period,
            amount_pence: line.section === "expenses" ? -line.amount_pence : line.amount_pence,
            category_name: line.label,
          },
          target: "summary",
          confidence: 70,
          issues: ["summary_total"],
          decision: "pending",
        });
      }
    }

    const fidelityFrom = batch.full_fidelity_from ?? null;
    const totalRows = file.segments.reduce((s, seg) => s + seg.rows.length, 0);

    for (const seg of file.segments) {
      // Column map: saved mapping > known source fingerprint > inference
      let columnMap: ColumnMap;
      let categoryMap: Record<string, string> | null = null;
      if (seg.fixedMap) {
        columnMap = seg.fixedMap;
      } else if (seg.headerless) {
        columnMap = inferHeaderlessMap(seg.rows);
      } else {
        const signature = computeSignature(seg.headers);
        const saved = await lookupMapping(batch.freelancer_id, signature);
        const inferred = inferColumnMap(seg.headers, seg.rows);
        const fp = detectByHeaders(seg.headers);
        columnMap = saved?.column_map
          ? (saved.column_map as ColumnMap)
          : { ...inferred, ...((fp?.columnMap as ColumnMap) ?? {}) };
        categoryMap = (saved?.category_map as Record<string, string> | null | undefined) ?? null;
      }

      for (const raw of seg.rows) {
        const c = classifyRow(raw, columnMap, {
          dateHint: batch.date_format,
          categoryMap,
          direction: seg.direction,
          headerless: seg.headerless,
        });
        let target = c.target;
        const rowDate = c.parsed.date ?? null;
        if (target && target !== "skip" && fidelityFrom && rowDate && rowDate < fidelityFrom) {
          target = "summary";
        }
        const issues = [...c.issues];
        if (seg.aiExtracted) issues.push("low_confidence_extraction");
        if (seg.sheet && file.segments.length > 1) issues.push(`sheet:${seg.sheet}`);

        toInsert.push({
          batch_id: batchId,
          row_number: ++rowNumber,
          raw,
          parsed: c.parsed,
          target,
          confidence: seg.aiExtracted ? Math.min(c.confidence, 50) : c.confidence,
          issues: issues.length ? issues : null,
          decision: target === "skip" && issues.includes("total_row") ? "skipped" : "pending",
        });

        if (rowNumber % 100 === 0) {
          await db
            .update(import_batches)
            .set({
              parse_progress: Math.round((rowNumber / Math.max(totalRows, 1)) * 100),
              updated_at: new Date(),
            })
            .where(eq(import_batches.id, batchId));
        }
      }
    }

    if (toInsert.length === 0) {
      await fail(
        file.notTransactions ??
          "No transactions found in the file. A spreadsheet or table needs a header row and at least one data row; a document needs lines that start with a date and end with an amount."
      );
      return;
    }

    await db.delete(import_rows).where(eq(import_rows.batch_id, batchId));
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await db.insert(import_rows).values(toInsert.slice(i, i + CHUNK));
    }

    await markDuplicates(batchId, batch.freelancer_id);

    await db
      .update(import_batches)
      .set({
        status: "review",
        parse_completed_at: new Date(),
        parse_progress: 100,
        row_count: toInsert.length,
        updated_at: new Date(),
      })
      .where(eq(import_batches.id, batchId));
  } catch (err) {
    await fail(`Parse failed: ${String(err)}`);
    throw err;
  }
}
