import { describe, it, expect } from "vitest";
import { taxYearFromStart } from "../../../shared/tax-periods";
import { quarterRows, quarterPeriodLabel, addQuartersSheet } from "./hmrc-quarters-sheet";
import { createWorkbook } from "./xlsx";

const ty = taxYearFromStart(2026);
const income = [
  { date: "2026-05-01", amount_pence: 300000 },
  { date: "2026-07-05", amount_pence: 225000 }, // last day of Q1
  { date: "2026-07-06", amount_pence: 315000 }, // first day of Q2
  { date: "2025-12-01", amount_pence: 999999 }, // previous tax year: ignored
];
const expenses = [
  { date: "2026-06-14", amount_pence: 81505 },
  { date: "2026-08-01", amount_pence: 19705 },
  { date: "2026-11-01", amount_pence: 77405 },
];

describe("quarterRows", () => {
  const rows = quarterRows(ty, income, expenses, "2026-11-16");

  it("always returns all four quarters, empty ones as zero", () => {
    expect(rows.map((r) => r.label)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(rows[3]).toMatchObject({ income: 0, expenses: 0, status: "Not started" });
  });

  it("splits on the quarter boundary and accumulates to date", () => {
    expect(rows[0]).toMatchObject({ income: 525000, expenses: 81505, status: "Complete" });
    expect(rows[1]).toMatchObject({ income: 315000, incomeToDate: 840000 });
    expect(rows[2]).toMatchObject({ income: 0, expenses: 77405, status: "In progress" });
  });

  it("the last row's to-date figures equal the year's totals", () => {
    expect(rows[3].incomeToDate).toBe(840000);
    expect(rows[3].expensesToDate).toBe(81505 + 19705 + 77405);
  });
});

describe("quarterPeriodLabel", () => {
  it("labels a quarter that crosses the calendar year with the end year", () => {
    expect(quarterPeriodLabel("2026-10-06", "2027-01-05")).toBe("6 Oct - 5 Jan 2027");
  });
});

describe("addQuartersSheet", () => {
  it("adds a sheet with a title, a header and four quarter rows", () => {
    const wb = createWorkbook();
    const ws = addQuartersSheet(wb, ty, income, expenses, { today: "2026-11-16" });
    expect(ws.name).toBe("HMRC quarters");
    expect(ws.getRow(4).getCell(1).value).toBe("Quarter");
    expect(ws.getRow(5).getCell(1).value).toBe("Q1");
    expect(ws.getRow(8).getCell(1).value).toBe("Q4");
  });
});
