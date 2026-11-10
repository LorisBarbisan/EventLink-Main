/**
 * Shared ExcelJS helpers for EventLink workbook exports.
 *
 * Usage:
 *   const wb = createWorkbook();
 *   addTypedSheet(wb, "Earnings", earningsCols, earningsRows);
 *   await streamWorkbook(wb, res, "eventlink-books-2026-04-06-to-2027-04-05.xlsx");
 */

import ExcelJS from "exceljs";
import type { Response } from "express";

// Brand colours
const HEADER_BG = "FFD8690E"; // --primary
const HEADER_BORDER = "FFB85C0A"; // darker amber
const HEADER_FG = "FFFFFFFF";
const TOTALS_BORDER = "FFB85C0A";

export type ColType = "text" | "date" | "money" | "number" | "percent";

export interface ColSpec {
  header: string;
  type: ColType;
  /** If true, include this column in the totals row */
  total?: boolean;
  /**
   * Index (0-based) of the column in the same row that holds the ISO currency
   * code (GBP/EUR/USD). When set on a money column the per-cell numFmt is
   * derived from that row's currency rather than a fixed format.
   */
  currencyFrom?: number;
}

const CURRENCY_FMT: Record<string, string> = {
  GBP: "£#,##0.00",
  EUR: "€#,##0.00",
  USD: "$#,##0.00",
};

type CellValue = string | number | Date | null | undefined;

export function createWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EventLink";
  wb.created = new Date();
  return wb;
}

/**
 * Add a typed sheet to `wb`.
 * - header row: bold white on brand orange, frozen, autofilter
 * - dates: real Date cells, dd/mm/yyyy
 * - money: number cells, #,##0.00, right-aligned
 * - totals row: typed values (not formulas), bold, thin top border
 * - column widths: fit to longest value, clamped 10–45
 * - printing: landscape, fit-to-width
 */
export function addTypedSheet(
  wb: ExcelJS.Workbook,
  name: string,
  cols: ColSpec[],
  rows: CellValue[][]
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name);

  // ── Header row ────────────────────────────────────────────────────────────────
  ws.addRow(cols.map((c) => c.header));
  const headerRow = ws.getRow(1);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FG } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: HEADER_BORDER } } };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Data rows or empty-state message ─────────────────────────────────────────
  if (rows.length === 0) {
    const emptyRow = ws.addRow(["No records for this period."]);
    ws.mergeCells(2, 1, 2, cols.length);
    emptyRow.getCell(1).font = { italic: true, color: { argb: "FF9CA3AF" } };
    emptyRow.getCell(1).alignment = { horizontal: "left" };
    return ws;
  }

  for (const row of rows) {
    const wsRow = ws.addRow(row.map((v, i) => typedValue(v, cols[i]?.type ?? "text")));
    wsRow.eachCell((cell, colNum) => {
      const col = cols[colNum - 1];
      const currency = col?.currencyFrom != null ? String(row[col.currencyFrom] ?? "") : undefined;
      applyColFormat(cell, col, currency);
    });
  }

  // ── Totals row ────────────────────────────────────────────────────────────────
  const moneyTotals = cols.some((c) => c.total && c.type === "money");
  if (moneyTotals) {
    ws.addRow([]); // blank separator
    const totalsData = cols.map((c) => {
      if (!c.total || c.type !== "money") return null;
      let sum = 0;
      for (const row of rows) {
        const v = row[cols.indexOf(c)];
        if (typeof v === "number") sum += v;
      }
      return sum;
    });
    const totalsRow = ws.addRow(totalsData);
    totalsRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      const col = cols[colNum - 1];
      if (col?.type === "money") {
        applyColFormat(cell, col);
      }
      cell.font = { bold: true };
      cell.border = { top: { style: "thin", color: { argb: TOTALS_BORDER } } };
    });
  }

  // Auto-filter on header row (only when there are data rows)
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  // ── Column widths (fit to data, not header) ───────────────────────────────────
  cols.forEach((col, i) => {
    const colNum = i + 1;
    let maxLen = col.header.length;
    for (const row of rows) {
      const v = row[i];
      if (v == null) continue;
      const len =
        v instanceof Date
          ? 10
          : col.type === "money" || col.type === "number"
            ? String(typeof v === "number" ? v.toFixed(2) : v).length
            : String(v).length;
      if (len > maxLen) maxLen = len;
    }
    ws.getColumn(colNum).width = Math.min(Math.max(maxLen + 2, 10), 45);
  });

  // ── Print settings ────────────────────────────────────────────────────────────
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:1",
  };

  return ws;
}

function typedValue(v: CellValue, type: ColType): CellValue {
  if (v == null || v === "") return null;
  if (type === "date") {
    if (v instanceof Date) return v;
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T00:00:00Z");
    return null;
  }
  if (type === "money" || type === "number") {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return isNaN(n) ? null : n;
  }
  return String(v);
}

function applyColFormat(cell: ExcelJS.Cell, col: ColSpec | undefined, currency?: string) {
  if (!col) return;
  if (col.type === "date") {
    cell.numFmt = "dd/mm/yyyy";
  } else if (col.type === "money") {
    cell.numFmt = (currency && CURRENCY_FMT[currency]) ?? "#,##0.00";
    cell.alignment = { horizontal: "right" };
  } else if (col.type === "number") {
    cell.alignment = { horizontal: "right" };
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
