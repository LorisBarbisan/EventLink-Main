import { describe, it, expect } from "vitest";
import {
  taxYearForDate,
  taxYearFromStart,
  taxQuarters,
  taxQuarterForDate,
  reportingDate,
  inRange,
} from "./tax-periods";

describe("taxYearForDate", () => {
  it("5 Apr 2026 is in 2025/26", () => {
    const ty = taxYearForDate("2026-04-05");
    expect(ty.year).toBe(2025);
    expect(ty.label).toBe("2025/26");
    expect(ty.from).toBe("2025-04-06");
    expect(ty.to).toBe("2026-04-05");
  });

  it("6 Apr 2026 is in 2026/27", () => {
    const ty = taxYearForDate("2026-04-06");
    expect(ty.year).toBe(2026);
    expect(ty.label).toBe("2026/27");
  });

  it("1 Jan 2027 is in 2026/27", () => {
    expect(taxYearForDate("2027-01-01").year).toBe(2026);
  });

  it("handles a date in a leap year — 29 Feb 2028 is in 2027/28", () => {
    expect(taxYearForDate("2028-02-29").year).toBe(2027);
  });
});

describe("taxYearFromStart", () => {
  it("builds correct range for 2026", () => {
    const ty = taxYearFromStart(2026);
    expect(ty.from).toBe("2026-04-06");
    expect(ty.to).toBe("2027-04-05");
    expect(ty.label).toBe("2026/27");
  });
});

describe("taxQuarters", () => {
  it("returns four quarters covering the full tax year", () => {
    const qs = taxQuarters(2026);
    expect(qs).toHaveLength(4);
    expect(qs[0].from).toBe("2026-04-06");
    expect(qs[0].to).toBe("2026-07-05");
    expect(qs[1].from).toBe("2026-07-06");
    expect(qs[1].to).toBe("2026-10-05");
    expect(qs[2].from).toBe("2026-10-06");
    expect(qs[2].to).toBe("2027-01-05");
    expect(qs[3].from).toBe("2027-01-06");
    expect(qs[3].to).toBe("2027-04-05");
  });

  it("Q3 spans the calendar year boundary", () => {
    const q3 = taxQuarters(2026)[2];
    expect(q3.quarter).toBe(3);
    expect(q3.from).toBe("2026-10-06");
    expect(q3.to).toBe("2027-01-05");
  });

  it("labels are correct", () => {
    const qs = taxQuarters(2026);
    expect(qs.map((q) => q.label)).toEqual([
      "Q1 2026/27",
      "Q2 2026/27",
      "Q3 2026/27",
      "Q4 2026/27",
    ]);
  });
});

describe("taxQuarterForDate", () => {
  it("6 Apr 2026 is Q1", () => {
    expect(taxQuarterForDate("2026-04-06").quarter).toBe(1);
  });
  it("5 Jul 2026 is Q1", () => {
    expect(taxQuarterForDate("2026-07-05").quarter).toBe(1);
  });
  it("6 Jul 2026 is Q2", () => {
    expect(taxQuarterForDate("2026-07-06").quarter).toBe(2);
  });
  it("31 Dec 2026 is Q3", () => {
    expect(taxQuarterForDate("2026-12-31").quarter).toBe(3);
  });
  it("5 Jan 2027 is Q3", () => {
    expect(taxQuarterForDate("2027-01-05").quarter).toBe(3);
  });
  it("6 Jan 2027 is Q4", () => {
    expect(taxQuarterForDate("2027-01-06").quarter).toBe(4);
  });
  it("5 Apr 2027 is Q4", () => {
    expect(taxQuarterForDate("2027-04-05").quarter).toBe(4);
  });
});

describe("reportingDate — cash vs accruals boundary cases", () => {
  it("cash: uses paid_date, ignoring invoiced_date", () => {
    expect(
      reportingDate("cash", {
        work_date: "2027-03-28",
        invoiced_date: "2027-03-28",
        paid_date: "2027-04-30",
      })
    ).toBe("2027-04-30");
  });

  it("cash: returns null if not yet paid", () => {
    expect(
      reportingDate("cash", {
        work_date: "2027-03-28",
        invoiced_date: "2027-03-28",
        paid_date: null,
      })
    ).toBeNull();
  });

  it("accruals: uses invoiced_date, falls back to work_date", () => {
    expect(
      reportingDate("accruals", {
        work_date: "2027-03-28",
        invoiced_date: "2027-04-01",
        paid_date: "2027-04-30",
      })
    ).toBe("2027-04-01");
  });

  it("accruals: falls back to work_date when invoiced_date absent", () => {
    expect(
      reportingDate("accruals", {
        work_date: "2027-03-28",
        invoiced_date: null,
        paid_date: null,
      })
    ).toBe("2027-03-28");
  });

  it("gig on 4 Apr 2027, paid 10 Apr 2027 — cash=2027/28, accruals=2026/27", () => {
    const dates = { work_date: "2027-04-04", invoiced_date: "2027-04-04", paid_date: "2027-04-10" };
    const cashDate = reportingDate("cash", dates)!;
    const accrualDate = reportingDate("accruals", dates)!;
    expect(taxYearForDate(cashDate).label).toBe("2027/28");
    expect(taxYearForDate(accrualDate).label).toBe("2026/27");
  });
});

describe("inRange", () => {
  it("inclusive on both ends", () => {
    const range = { from: "2026-04-06", to: "2027-04-05" };
    expect(inRange("2026-04-06", range)).toBe(true);
    expect(inRange("2027-04-05", range)).toBe(true);
    expect(inRange("2026-10-01", range)).toBe(true);
    expect(inRange("2026-04-05", range)).toBe(false);
    expect(inRange("2027-04-06", range)).toBe(false);
  });
});
