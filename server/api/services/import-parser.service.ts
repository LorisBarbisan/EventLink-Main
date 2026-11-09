import ExcelJS from "exceljs";
import { createRequire } from "module";
import { Readable } from "stream";
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
  detectProfitAndLoss,
  headerlessColumnMap,
} from "./import-source-detect.service";

// pdf-parse is CJS-only; use createRequire so the function is always callable
// regardless of the project's ESM/CJS module resolution.
const _require = createRequire(import.meta.url);
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = _require("pdf-parse");

// ── Types ─────────────────────────────────────────────────────────────────────

type TargetType = "earnings" | "expense" | "invoice" | "mileage" | "kit" | "skip" | "summary";

interface ReadResult {
  rows: RawRow[];
  headerless: boolean;
  detectedSource?: string;
  detectedSheetName?: string;
}

interface RawRow {
  [header: string]: string;
}

interface ParsedRow {
  date?: string; // ISO YYYY-MM-DD
  description?: string;
  amount_pence?: number;
  rate_raw?: string;
  notes?: string;
  reference?: string;
  category_name?: string; // resolved from category_map (for expenses)
}

interface ClassifiedRow {
  raw: RawRow;
  parsed: ParsedRow;
  target: TargetType | null;
  confidence: number; // 0-100
  issues: string[];
}

// ── Date normalisation ────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function parseDate(raw: string, hint?: string | null): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Hint-guided: "DD/MM/YYYY" or "MM/DD/YYYY"
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, a, b, yr] = slashMatch;
    const year =
      yr.length === 2
        ? parseInt(yr) > 50
          ? 1900 + parseInt(yr)
          : 2000 + parseInt(yr)
        : parseInt(yr);
    const [day, month] =
      hint === "MM/DD/YYYY" ? [parseInt(b), parseInt(a)] : [parseInt(a), parseInt(b)]; // default DD/MM/YYYY (UK)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // DD-MM-YYYY or YYYY-MM-DD with dashes (already handled above for 4-digit year first)
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    const [, a, b, yr] = dashMatch;
    const year =
      yr.length === 2
        ? parseInt(yr) > 50
          ? 1900 + parseInt(yr)
          : 2000 + parseInt(yr)
        : parseInt(yr);
    const day = parseInt(a);
    const month = parseInt(b);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // "01 Jan 2024" or "1 January 2024"
  const longMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (longMatch) {
    const day = parseInt(longMatch[1]);
    const month = MONTH_NAMES[longMatch[2].toLowerCase().slice(0, 3)];
    const year = parseInt(longMatch[3]);
    if (!month) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // "Jan 01, 2024" or "January 1, 2024"
  const usLongMatch = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (usLongMatch) {
    const month = MONTH_NAMES[usLongMatch[1].toLowerCase().slice(0, 3)];
    const day = parseInt(usLongMatch[2]);
    const year = parseInt(usLongMatch[3]);
    if (!month) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

// ── Amount parsing ────────────────────────────────────────────────────────────
// Strips currency symbols and thousands separators; returns integer pence.
// Negative values indicate a debit/expense.

function parseAmountPence(raw: string): number | null {
  if (!raw.trim()) return null;
  const cleaned = raw
    .replace(/[£$€¥₹]/g, "")
    .replace(/,/g, "")
    .trim();
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

// ── Column mapping application ────────────────────────────────────────────────
// column_map keys are canonical field names; values are source header names.
// e.g. { "date": "Transaction Date", "amount": "Amount (GBP)", ... }

type ColumnMap = Record<string, string | null>;

function applyMapping(
  raw: RawRow,
  columnMap: ColumnMap,
  dateHint?: string | null,
  categoryMap?: Record<string, string> | null
): ClassifiedRow {
  const issues: string[] = [];
  const parsed: ParsedRow = {};

  // Helper: get a value by canonical name via the map, or fall back to
  // case-insensitive header search if the map doesn't have that key.
  const get = (canonical: string): string => {
    const mapped = columnMap[canonical];
    if (mapped && raw[mapped] !== undefined) return raw[mapped].trim();
    // Fuzzy fallback: look for a header containing the canonical name
    const fallback = Object.keys(raw).find((k) =>
      k.toLowerCase().includes(canonical.toLowerCase())
    );
    return fallback ? raw[fallback].trim() : "";
  };

  // Date
  const rawDate = get("date");
  if (!rawDate) {
    issues.push("Missing date");
  } else {
    const isoDate = parseDate(rawDate, dateHint);
    if (!isoDate) {
      issues.push(`Could not parse date: "${rawDate}"`);
    } else {
      parsed.date = isoDate;
    }
  }

  // Description
  const desc = get("description") || get("details") || get("narrative") || get("memo");
  if (!desc) {
    issues.push("Missing description");
  } else {
    parsed.description = desc;
  }

  // Category — try to map the source category to an EventLink category name
  const rawCategory = get("category") || get("account") || get("type");
  if (rawCategory && categoryMap) {
    const mapped = categoryMap[rawCategory] ?? categoryMap[rawCategory.toLowerCase()];
    if (mapped) parsed.category_name = mapped;
    else issues.push(`unmapped_category:${rawCategory}`);
  }

  // Amount — try combined amount first, then separate credit/debit
  let amountPence: number | null = null;
  const rawAmount = get("amount");
  if (rawAmount) {
    amountPence = parseAmountPence(rawAmount);
    if (amountPence === null) issues.push(`Could not parse amount: "${rawAmount}"`);
    else parsed.rate_raw = rawAmount;
  } else {
    const rawCredit = get("credit");
    const rawDebit = get("debit");
    if (rawCredit) {
      const c = parseAmountPence(rawCredit);
      if (c !== null && c !== 0) {
        amountPence = Math.abs(c);
        parsed.rate_raw = rawCredit;
      }
    }
    if (rawDebit) {
      const d = parseAmountPence(rawDebit);
      if (d !== null && d !== 0) {
        amountPence = -Math.abs(d);
        parsed.rate_raw = rawDebit;
      }
    }
    if (amountPence === null) issues.push("Missing amount");
  }

  if (amountPence !== null) {
    if (amountPence === 0) issues.push("Amount is zero");
    parsed.amount_pence = amountPence;
  }

  // Reference / notes
  const ref = get("reference") || get("ref") || get("transaction id");
  if (ref) parsed.reference = ref;
  const notes = get("notes") || get("comments") || get("memo");
  if (notes && notes !== parsed.description) parsed.notes = notes;

  // ── Target classification ───────────────────────────────────────────────────
  let target: TargetType | null = null;
  let confidence = 100;

  // Explicit skip signals
  const descLower = (parsed.description ?? "").toLowerCase();
  const skipKeywords = [
    "transfer",
    "balance brought forward",
    "opening balance",
    "closing balance",
  ];
  if (skipKeywords.some((kw) => descLower.includes(kw)) || amountPence === 0) {
    target = "skip";
    confidence = 90;
  } else if (columnMap["target"]) {
    // Column map explicitly designates a target column
    const rawTarget = get("target").toLowerCase();
    if (rawTarget.includes("earn") || rawTarget.includes("income")) target = "earnings";
    else if (rawTarget.includes("expense") || rawTarget.includes("spend")) target = "expense";
    else if (rawTarget.includes("invoice")) target = "invoice";
    else if (rawTarget.includes("mile") || rawTarget.includes("km")) target = "mileage";
    else if (
      rawTarget.includes("kit") ||
      rawTarget.includes("asset") ||
      rawTarget.includes("equip")
    )
      target = "kit";
  } else if (amountPence !== null) {
    target = amountPence > 0 ? "earnings" : "expense";
    confidence = 75; // heuristic — lower confidence than an explicit mapping
  }

  // Deduct confidence for each issue
  confidence -= issues.length * 15;
  if (confidence < 0) confidence = 0;

  return { raw, parsed, target, confidence, issues };
}

// ── Heuristic mapping (no saved mapping available) ───────────────────────────
// Attempts to build a reasonable column_map from the headers alone by matching
// common header names. Returns a map; confidence will be lower for all rows.

function inferColumnMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const DATE_PATTERNS = [
    "date",
    "posted",
    "transaction date",
    "value date",
    "booking date",
    "trans date",
  ];
  const DESC_PATTERNS = [
    "description",
    "details",
    "narrative",
    "payee",
    "memo",
    "particulars",
    "transaction details",
  ];
  const AMOUNT_PATTERNS = ["amount", "value", "gbp amount", "eur amount", "usd amount"];
  const CREDIT_PATTERNS = ["credit", "in", "deposit", "money in", "paid in"];
  const DEBIT_PATTERNS = ["debit", "out", "withdrawal", "money out", "paid out"];
  const REF_PATTERNS = ["reference", "ref", "transaction id", "transaction ref", "cheque no"];

  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (!map["date"] && DATE_PATTERNS.some((p) => h.includes(p))) map["date"] = header;
    else if (!map["description"] && DESC_PATTERNS.some((p) => h.includes(p)))
      map["description"] = header;
    else if (!map["amount"] && AMOUNT_PATTERNS.some((p) => h === p || h.includes(p)))
      map["amount"] = header;
    else if (!map["credit"] && CREDIT_PATTERNS.some((p) => h === p || h.includes(p)))
      map["credit"] = header;
    else if (!map["debit"] && DEBIT_PATTERNS.some((p) => h === p || h.includes(p)))
      map["debit"] = header;
    else if (!map["reference"] && REF_PATTERNS.some((p) => h.includes(p)))
      map["reference"] = header;
  }

  return map;
}

// ── File readers ──────────────────────────────────────────────────────────────

async function readCsv(buffer: Buffer): Promise<ReadResult> {
  const workbook = new ExcelJS.Workbook();
  const stream = Readable.from(buffer);
  await workbook.csv.read(stream);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], headerless: false };

  // Read first row to detect headerless
  const firstRowValues: string[] = [];
  sheet.getRow(1).eachCell((cell) => firstRowValues.push(String(cell.value ?? "").trim()));

  const isHeaderless = detectHeaderless(firstRowValues);

  const headers: string[] = isHeaderless
    ? firstRowValues.map((_, i) => String.fromCharCode(65 + i)) // A, B, C…
    : firstRowValues;

  const rows: RawRow[] = [];
  const startRow = isHeaderless ? 1 : 2;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startRow) return;
    const obj: RawRow = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) obj[header] = String(cell.value ?? "").trim();
    });
    if (Object.values(obj).some((v) => v !== "")) rows.push(obj);
  });

  return { rows, headerless: isHeaderless };
}

function cellToString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  }
  return String(v ?? "").trim();
}

async function readXlsx(buffer: Buffer): Promise<ReadResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (workbook.worksheets.length === 0) return { rows: [], headerless: false };

  // Step 1: sheet-name detection (FreeAgent)
  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const sheetDetect = detectBySheetNames(sheetNames);

  let sheet: ExcelJS.Worksheet | undefined;
  let detectedSource: string | undefined;
  let detectedSheetName: string | undefined;

  if (sheetDetect) {
    sheet = workbook.worksheets.find((ws) => ws.name === sheetDetect.sheetName);
    detectedSource = sheetDetect.source;
    detectedSheetName = sheetDetect.sheetName;
  }

  if (!sheet) {
    sheet = workbook.worksheets.find((ws) => ws.rowCount > 0);
  }
  if (!sheet) return { rows: [], headerless: false };

  // Read first row
  const firstRowValues: string[] = [];
  sheet
    .getRow(1)
    .eachCell({ includeEmpty: false }, (cell) => firstRowValues.push(cellToString(cell)));

  const isHeaderless = !sheetDetect && detectHeaderless(firstRowValues);
  const headers: string[] = isHeaderless
    ? firstRowValues.map((_, i) => String.fromCharCode(65 + i))
    : firstRowValues;

  const rows: RawRow[] = [];
  const startRow = isHeaderless ? 1 : 2;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startRow) return;
    const obj: RawRow = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (!header) return;
      obj[header] = cellToString(cell);
    });
    if (Object.values(obj).some((v) => v !== "")) rows.push(obj);
  });

  return { rows, headerless: isHeaderless, detectedSource, detectedSheetName };
}

async function readPdf(buffer: Buffer): Promise<RawRow[]> {
  const data = await pdfParse(buffer);
  const lines = data.text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Very basic heuristic: look for lines that have a date at the start.
  // PDF bank statements vary wildly; this handles the most common tabular layout.
  // Lines that don't match are skipped.
  const rows: RawRow[] = [];
  const datePrefix = /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/;

  for (const line of lines) {
    if (!datePrefix.test(line)) continue;
    // Split on 2+ spaces (common column separator in PDF text extractions)
    const parts = line
      .split(/\s{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) continue;
    rows.push({
      Date: parts[0] ?? "",
      Description: parts[1] ?? "",
      Amount: parts[parts.length - 1] ?? "",
    });
  }

  return rows;
}

// ── Main entry point ──────────────────────────────────────────────────────────
// Called by the parse worker in place of the stub.

export async function parseImportFile(batchId: number, jobId: string): Promise<void> {
  const [batch] = await db
    .select()
    .from(import_batches)
    .where(and(eq(import_batches.id, batchId), eq(import_batches.parse_job_id, jobId)))
    .limit(1);

  if (!batch || batch.status !== "parsing") return; // stale or already handled

  try {
    // 1. Download file
    const buffer = await ObjectStorageService.downloadObjectBuffer(batch.file_key);

    // 2. Read raw rows based on MIME type
    let readResult: ReadResult;
    if (
      batch.mime_type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      batch.mime_type === "application/vnd.ms-excel"
    ) {
      readResult = await readXlsx(buffer);
    } else if (batch.mime_type === "application/pdf") {
      const pdfRows = await readPdf(buffer);
      readResult = { rows: pdfRows, headerless: false };
    } else {
      readResult = await readCsv(buffer); // text/csv and fallback
    }

    const rawRows = readResult.rows;

    if (rawRows.length === 0) {
      await db
        .update(import_batches)
        .set({
          status: "failed",
          error:
            "No data rows found in the file. Check the file has at least one header row and one data row.",
          updated_at: new Date(),
        })
        .where(eq(import_batches.id, batchId));
      return;
    }

    // 3. Find or infer column mapping
    // Priority: (a) saved mapping, (b) header fingerprint, (c) heuristic inference
    const headers = Object.keys(rawRows[0]);
    const signature = readResult.headerless ? "" : computeSignature(headers);
    const savedMapping = signature ? await lookupMapping(batch.freelancer_id, signature) : null;

    let columnMap: ColumnMap;
    if (savedMapping?.column_map) {
      columnMap = savedMapping.column_map as ColumnMap;
    } else if (readResult.headerless) {
      columnMap = headerlessColumnMap(headers.length);
    } else {
      const fp = detectByHeaders(headers);
      columnMap = fp ? (fp.columnMap as ColumnMap) : inferColumnMap(headers);
    }

    const categoryMap =
      (savedMapping?.category_map as Record<string, string> | null | undefined) ?? null;

    // Persist detected source on the batch if we found one
    if (readResult.detectedSource) {
      await db
        .update(import_batches)
        .set({ source: readResult.detectedSource as typeof batch.source, updated_at: new Date() })
        .where(eq(import_batches.id, batchId));
    }

    // 4. Detect P&L report (summary-only path) or classify transaction rows
    const isPnL = detectProfitAndLoss(rawRows);
    const fidelityFrom = batch.full_fidelity_from ?? null; // ISO date string or null
    const toInsert: (typeof import_rows.$inferInsert)[] = [];

    if (isPnL) {
      // P&L path: each row becomes one "summary" import_row.
      // The first column is the category name; remaining columns are period totals.
      const cols = Object.keys(rawRows[0]);
      const categoryCol = cols[0];
      const periodCols = cols.slice(1);

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const categoryLabel = (row[categoryCol] ?? "").trim();
        if (!categoryLabel || categoryLabel.match(/^(total|subtotal|grand total)/i)) continue;

        for (const periodCol of periodCols) {
          const rawAmount = (row[periodCol] ?? "").trim();
          if (!rawAmount) continue;
          const amountPence = parseAmountPence(rawAmount);
          if (amountPence === null || amountPence === 0) continue;

          toInsert.push({
            batch_id: batchId,
            row_number: i * 100 + periodCols.indexOf(periodCol) + 1,
            raw: row,
            parsed: {
              description: categoryLabel,
              period: periodCol,
              amount_pence: amountPence,
              category_name: categoryLabel,
            },
            target: "summary",
            confidence: 70,
            issues: null,
            decision: "pending",
          });
        }
      }
    } else {
      for (let i = 0; i < rawRows.length; i++) {
        const classified = applyMapping(rawRows[i], columnMap, batch.date_format, categoryMap);

        // Fidelity downgrade: rows before full_fidelity_from become "summary"
        let target = classified.target;
        const rowDate = classified.parsed.date ?? null;
        if (
          target !== "skip" &&
          target !== null &&
          fidelityFrom &&
          rowDate &&
          rowDate < fidelityFrom
        ) {
          target = "summary";
        }

        toInsert.push({
          batch_id: batchId,
          row_number: i + 1,
          raw: rawRows[i],
          parsed: classified.parsed,
          target,
          confidence: classified.confidence,
          issues: classified.issues.length > 0 ? classified.issues : null,
          decision: "pending",
        });

        // Update progress every 100 rows
        if ((i + 1) % 100 === 0) {
          const progress = Math.round(((i + 1) / rawRows.length) * 100);
          await db
            .update(import_batches)
            .set({ parse_progress: progress, updated_at: new Date() })
            .where(eq(import_batches.id, batchId));
        }
      }
    } // end else (non-P&L path)

    // 5. Delete any rows from a previous parse attempt, then bulk-insert
    await db.delete(import_rows).where(eq(import_rows.batch_id, batchId));

    // Insert in chunks of 500 to avoid parameter limit
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await db.insert(import_rows).values(toInsert.slice(i, i + CHUNK));
    }

    // 6. Dedup check against live records and prior committed batches
    await markDuplicates(batchId, batch.freelancer_id);

    // 7. Mark done
    await db
      .update(import_batches)
      .set({
        status: "review",
        parse_completed_at: new Date(),
        parse_progress: 100,
        row_count: rawRows.length,
        updated_at: new Date(),
      })
      .where(eq(import_batches.id, batchId));
  } catch (err) {
    await db
      .update(import_batches)
      .set({
        status: "failed",
        error: `Parse failed: ${String(err)}`,
        updated_at: new Date(),
      })
      .where(eq(import_batches.id, batchId));
    throw err;
  }
}
