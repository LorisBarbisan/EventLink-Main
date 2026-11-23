/**
 * Shared ExcelJS helpers for EventLink workbook exports.
 *
 * Exports: createWorkbook, addTypedSheet (with optional SheetOpts),
 * addSummarySheet, streamWorkbook, ColSpec, ColType, SheetOpts.
 *
 * Design rules, unchanged from before:
 *   - No formulas anywhere. Totals are typed values.
 *   - Nothing exotic: fills, borders, number formats and column widths only,
 *     all of which render identically in Excel, LibreOffice, Numbers and
 *     Google Sheets.
 *   - Real typed cells — Date objects for dates, numbers for money.
 */

import ExcelJS from "exceljs";
import type { Response } from "express";

// ── Palette ──────────────────────────────────────────────────────────────────
// Navy is the app's signed-in header; orange is --primary. The pairing is the
// product's, not a spreadsheet convention.
const NAVY = "FF1E3A5F";
const ORANGE = "FFD8690E";
const ORANGE_SOFT = "FFFFF4E8"; // totals fill
const ZEBRA = "FFF7F9FC"; // alternate row fill
const HAIRLINE = "FFE3E8EF"; // row separator
const MUTED = "FF6B7280"; // subtitles, empty states, notes
const INK = "FF111827"; // body text

const CURRENCY_FMT: Record<string, string> = {
  GBP: "£#,##0.00",
  EUR: "€#,##0.00",
  USD: "$#,##0.00",
};

export type ColType = "text" | "date" | "money" | "number" | "percent";

export interface ColSpec {
  header: string;
  type: ColType;
  /** Include this column in the totals row. */
  total?: boolean;
  /** 0-based index of the column holding this row's ISO currency code. */
  currencyFrom?: number;
}

export interface SheetOpts {
  /** Large heading above the table. */
  title?: string;
  /** One muted line under the title. */
  subtitle?: string;
  /** Label for the totals row's first cell. Default "Total". */
  totalLabel?: string;
  /** Shown when there are no rows. */
  emptyLabel?: string;
  /**
   * Freeze the first column as well as the header. Deliberately unused: Excel
   * renders a two-way split with an autofilter in the frozen row as a doubled
   * header (LibreOffice does not, which is how it was missed). Freeze rows only.
   */
  freezeFirstCol?: boolean;
  /** Tab colour. Defaults to orange. */
  tabColor?: string;
}

type CellValue = string | number | Date | null | undefined;

export function createWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EventLink";
  wb.created = new Date();
  return wb;
}

/**
 * A totals-row figure. Cells hold pounds (pence already divided), and
 * summing those in floating point leaves noise: 127.53 + 143.39 + 143.8 is
 * 414.71999999999997. Money is rounded back to whole pence; other numbers
 * (miles, hours) to six places, which only removes the noise.
 */
export function columnTotal(col: ColSpec, rows: CellValue[][], i: number): number {
  const sum = rows.reduce<number>(
    (s, row) => s + (typeof row[i] === "number" ? (row[i] as number) : 0),
    0
  );
  const places = col.type === "money" ? 100 : 1_000_000;
  return Math.round(sum * places) / places;
}

export function addTypedSheet(
  wb: ExcelJS.Workbook,
  name: string,
  cols: ColSpec[],
  rows: CellValue[][],
  opts: SheetOpts = {}
): ExcelJS.Worksheet {
  const titleRows = opts.title ? (opts.subtitle ? 3 : 2) : 0;

  const ws = wb.addWorksheet(name, {
    views: [
      {
        state: "frozen",
        ySplit: titleRows + 1,
        xSplit: opts.freezeFirstCol ? 1 : 0,
      },
    ],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `1:${titleRows + 1}`,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });
  ws.properties.defaultRowHeight = 18;
  ws.properties.tabColor = { argb: opts.tabColor ?? ORANGE };

  // ── Title block ────────────────────────────────────────────────────────────
  if (opts.title) {
    const t = ws.addRow([opts.title]);
    t.height = 24;
    t.getCell(1).font = { bold: true, size: 14, color: { argb: NAVY } };
    if (opts.subtitle) {
      const s = ws.addRow([opts.subtitle]);
      s.getCell(1).font = { size: 9, italic: true, color: { argb: MUTED } };
    }
    ws.addRow([]);
  }

  // ── Header row ─────────────────────────────────────────────────────────────
  const headerRow = ws.addRow(cols.map((c) => c.header));
  const headerRowNum = headerRow.number;
  headerRow.height = 26;
  headerRow.eachCell((cell, i) => {
    const col = cols[i - 1];
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = {
      vertical: "middle",
      horizontal: isNumeric(col?.type) ? "right" : "left",
      indent: 1,
    };
    cell.border = { bottom: { style: "medium", color: { argb: ORANGE } } };
  });

  // ── Empty state ────────────────────────────────────────────────────────────
  if (rows.length === 0) {
    const e = ws.addRow([opts.emptyLabel ?? "No records for this period."]);
    ws.mergeCells(e.number, 1, e.number, cols.length);
    e.height = 22;
    e.getCell(1).font = { italic: true, color: { argb: MUTED } };
    e.getCell(1).alignment = { horizontal: "left", indent: 1, vertical: "middle" };
    setWidths(ws, cols, rows);
    return ws; // no autofilter, no totals row
  }

  // ── Data rows ──────────────────────────────────────────────────────────────
  rows.forEach((row, ri) => {
    const wsRow = ws.addRow(row.map((v, i) => typedValue(v, cols[i]?.type ?? "text")));
    wsRow.height = 18;
    wsRow.eachCell({ includeEmpty: true }, (cell, i) => {
      const col = cols[i - 1];
      if (!col) return;
      if (ri % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
      cell.border = { bottom: { style: "thin", color: { argb: HAIRLINE } } };
      cell.font = { size: 10, color: { argb: INK } };
      const currency = col.currencyFrom != null ? String(row[col.currencyFrom] ?? "") : undefined;
      applyColFormat(cell, col, currency);
    });
  });

  // ── Totals row ─────────────────────────────────────────────────────────────
  if (cols.some((c) => c.total)) {
    ws.addRow([]); // separator
    const data = cols.map((c, i) => {
      if (c.total) return columnTotal(c, rows, i);
      return i === 0 ? (opts.totalLabel ?? "Total") : null;
    });
    const tr = ws.addRow(data);
    tr.height = 22;
    tr.eachCell({ includeEmpty: true }, (cell, i) => {
      const col = cols[i - 1];
      if (!col) return;
      cell.font = { bold: true, size: 10, color: { argb: NAVY } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_SOFT } };
      cell.border = { top: { style: "medium", color: { argb: ORANGE } } };
      if (col.total) {
        const currency =
          col.currencyFrom != null ? String(rows[0]?.[col.currencyFrom] ?? "") : undefined;
        applyColFormat(cell, col, currency);
      } else {
        cell.alignment = { horizontal: "left", indent: 1, vertical: "middle" };
      }
    });
  }

  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum, column: cols.length },
  };

  setWidths(ws, cols, rows);
  return ws;
}

/**
 * A label/value summary sheet — navy section bars, muted rows, soft-orange
 * totals. `sections` is a list of [heading, lines] where each line is
 * [label, value, { bold?, text? }].
 */
export function addSummarySheet(
  wb: ExcelJS.Workbook,
  name: string,
  header: { title: string; subtitle?: string; meta?: string },
  sections: Array<{
    heading: string;
    lines: Array<{ label: string; value: number | string; bold?: boolean; text?: boolean }>;
  }>,
  footnote?: string
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: {
      orientation: "portrait",
      fitToPage: true,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });
  ws.properties.tabColor = { argb: NAVY };
  ws.properties.defaultRowHeight = 18;
  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 20;

  const t = ws.addRow([header.title]);
  t.height = 30;
  t.getCell(1).font = { bold: true, size: 18, color: { argb: NAVY } };
  if (header.subtitle) {
    ws.addRow([header.subtitle]).getCell(1).font = { size: 10, color: { argb: MUTED } };
  }
  if (header.meta) {
    ws.addRow([header.meta]).getCell(1).font = { size: 9, italic: true, color: { argb: MUTED } };
  }
  ws.addRow([]);

  for (const section of sections) {
    const h = ws.addRow([section.heading]);
    h.height = 24;
    ws.mergeCells(h.number, 1, h.number, 2);
    h.getCell(1).font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    h.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    h.getCell(1).alignment = { vertical: "middle", indent: 1 };
    h.getCell(1).border = { bottom: { style: "medium", color: { argb: ORANGE } } };

    for (const line of section.lines) {
      const r = ws.addRow([line.label, line.value]);
      r.height = 18;
      const colour = line.bold ? NAVY : INK;
      r.getCell(1).font = { size: 10, bold: !!line.bold, color: { argb: colour } };
      r.getCell(1).alignment = { indent: line.bold ? 1 : 2, vertical: "middle" };
      r.getCell(2).font = { size: 10, bold: !!line.bold, color: { argb: colour } };
      r.getCell(2).numFmt = line.text ? "@" : CURRENCY_FMT.GBP;
      r.getCell(2).alignment = { horizontal: "right", indent: 1, vertical: "middle" };
      if (line.bold) {
        for (const c of [r.getCell(1), r.getCell(2)]) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_SOFT } };
          c.border = { top: { style: "thin", color: { argb: ORANGE } } };
        }
      } else {
        for (const c of [r.getCell(1), r.getCell(2)]) {
          c.border = { bottom: { style: "thin", color: { argb: HAIRLINE } } };
        }
      }
    }
    ws.addRow([]);
  }

  if (footnote) {
    const f = ws.addRow([footnote]);
    ws.mergeCells(f.number, 1, f.number, 2);
    f.height = 42;
    f.getCell(1).font = { size: 9, italic: true, color: { argb: MUTED } };
    f.getCell(1).alignment = { wrapText: true, vertical: "top", indent: 1 };
  }

  return ws;
}

// ── Internals ────────────────────────────────────────────────────────────────

function isNumeric(t?: ColType) {
  return t === "money" || t === "number" || t === "percent";
}

function setWidths(ws: ExcelJS.Worksheet, cols: ColSpec[], rows: CellValue[][]) {
  cols.forEach((col, i) => {
    let max = col.header.length;
    for (const row of rows) {
      const v = row[i];
      if (v == null) continue;
      const len =
        v instanceof Date
          ? 11
          : typeof v === "number"
            ? v.toFixed(2).length + 3 // room for the currency symbol and separators
            : String(v).length;
      if (len > max) max = len;
    }
    ws.getColumn(i + 1).width = Math.min(Math.max(max + 4, 12), 46);
  });
}

function typedValue(v: CellValue, type: ColType): CellValue {
  if (v == null || v === "") return null;
  if (type === "date") {
    if (v instanceof Date) return v;
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T00:00:00Z");
    return null;
  }
  if (isNumeric(type)) {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return isNaN(n) ? null : n;
  }
  return String(v);
}

function applyColFormat(cell: ExcelJS.Cell, col: ColSpec, currency?: string) {
  const right = { horizontal: "right" as const, indent: 1, vertical: "middle" as const };
  const left = { horizontal: "left" as const, indent: 1, vertical: "middle" as const };

  if (col.type === "date") {
    cell.numFmt = "dd mmm yyyy";
    cell.alignment = left;
  } else if (col.type === "money") {
    const base = (currency && CURRENCY_FMT[currency]) ?? CURRENCY_FMT.GBP;
    cell.numFmt = `${base};[Red]-${base}`; // negatives in red, same symbol
    cell.alignment = right;
  } else if (col.type === "number") {
    cell.numFmt = "#,##0";
    cell.alignment = right;
  } else if (col.type === "percent") {
    cell.numFmt = '0"%"';
    cell.alignment = right;
  } else {
    cell.alignment = left;
  }
}

export async function streamWorkbook(
  wb: ExcelJS.Workbook,
  res: Response,
  filename: string
): Promise<void> {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  await wb.xlsx.write(res);
}
