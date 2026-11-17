import { describe, it, expect } from "vitest";
import { parseDate, parseAmountPence, parseCsvText, inferColumnMap } from "./import-parse-utils";
import { detectProfitAndLoss } from "./import-source-detect.service";

// Rows as the reader produces them from the user's spreadsheet: Excel dates
// arrive as ISO strings.
const ledger = [
  {
    Date: "2026-05-08",
    Description: "Stage One Productions Ltd INV-0101",
    Category: "Sales",
    Amount: "570",
    Account: "Business Current Account",
  },
  {
    Date: "2026-05-12",
    Description: "Northern AV Hire Ltd INV-0102",
    Category: "Sales",
    Amount: "240",
    Account: "Business Current Account",
  },
  {
    Date: "2026-04-09",
    Description: "Trainline - Return London",
    Category: "Travel and parking",
    Amount: "-48.5",
    Account: "Business Current Account",
  },
];

describe("detectProfitAndLoss", () => {
  it("does not mistake a dated transaction list for a P&L report", () => {
    expect(detectProfitAndLoss(ledger)).toBe(false);
  });

  it("still recognises a P&L report", () => {
    const pnl = [
      { Account: "Sales", "Apr 2026": "5,250.00", "May 2026": "3,100.00" },
      { Account: "Travel and parking", "Apr 2026": "120.00", "May 2026": "80.00" },
      { Account: "Accommodation", "Apr 2026": "77.00", "May 2026": "0.00" },
    ];
    expect(detectProfitAndLoss(pnl)).toBe(true);
  });
});

describe("inferColumnMap", () => {
  it("maps the user's headers, and does not take Account for an amount", () => {
    expect(inferColumnMap(["Date", "Description", "Category", "Amount", "Account"])).toEqual({
      date: "Date",
      description: "Description",
      category: "Category",
      amount: "Amount",
    });
  });

  it("matches whole words, so a running balance is not money in", () => {
    const m = inferColumnMap(["Date", "Details", "Paid in", "Paid out", "Running balance"]);
    expect(m).toMatchObject({
      date: "Date",
      description: "Details",
      credit: "Paid in",
      debit: "Paid out",
    });
    expect(Object.values(m)).not.toContain("Running balance");
  });
});

describe("parseDate", () => {
  it("reads ISO, UK numeric and named-month dates", () => {
    expect(parseDate("2026-05-08")).toBe("2026-05-08");
    expect(parseDate("08/05/2026")).toBe("2026-05-08");
    expect(parseDate("08/05/2026", "MM/DD/YYYY")).toBe("2026-08-05");
    expect(parseDate("8 May 2026")).toBe("2026-05-08");
    expect(parseDate("08-May-26")).toBe("2026-05-08");
    expect(parseDate("2026-05-08T00:00:00.000Z")).toBe("2026-05-08");
  });

  it("reads an Excel serial number", () => {
    expect(parseDate("46150")).toBe("2026-05-08");
  });

  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("Stage One")).toBeNull();
  });
});

describe("parseAmountPence", () => {
  it("handles plain, signed, bracketed and suffixed amounts", () => {
    expect(parseAmountPence("570")).toBe(57000);
    expect(parseAmountPence("-48.5")).toBe(-4850);
    expect(parseAmountPence("£1,140.00")).toBe(114000);
    expect(parseAmountPence("(70.00)")).toBe(-7000);
    expect(parseAmountPence("9.85 DR")).toBe(-985);
    expect(parseAmountPence("26.40-")).toBe(-2640);
    expect(parseAmountPence("abc")).toBeNull();
  });
});

describe("parseCsvText", () => {
  it("keeps dates as typed and handles quotes, commas and a BOM", () => {
    const csv =
      '﻿Date,Description,Amount\r\n08/05/2026,"Stage One, Ltd ""INV-0101""",570\r\n12/05/2026,Northern AV,240\r\n';
    expect(parseCsvText(csv)).toEqual([
      ["Date", "Description", "Amount"],
      ["08/05/2026", 'Stage One, Ltd "INV-0101"', "570"],
      ["12/05/2026", "Northern AV", "240"],
    ]);
  });

  it("detects semicolon-separated files", () => {
    expect(parseCsvText("Date;Amount\n08/05/2026;570")).toEqual([
      ["Date", "Amount"],
      ["08/05/2026", "570"],
    ]);
  });
});
