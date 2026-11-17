import { describe, it, expect } from "vitest";
import {
  findHeaderRow,
  inferColumnMap,
  inferHeaderlessMap,
  isTotalRow,
  pnlReportRows,
  isContactList,
  invoiceFromText,
  cleanBankText,
  sheetDirection,
  normHeader,
} from "./import-table";

const rowsOf = (headers: string[], data: string[][]) =>
  data.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));

describe("findHeaderRow", () => {
  it("skips a QuickBooks report's title rows", () => {
    const t = [
      ["Loris Barbisan"],
      ["Transaction Detail by Account"],
      ["6 April 2026 - 13 November 2026"],
      [],
      [
        "Date",
        "Transaction Type",
        "Num",
        "Name",
        "Memo/Description",
        "Account",
        "Debit",
        "Credit",
        "Balance",
      ],
      ["2026-04-09", "Invoice", "INV-0101", "Stage One", "Rigger", "Sales", "", "570", "570"],
    ];
    expect(findHeaderRow(t)).toBe(4);
  });

  it("skips a diary's title and note", () => {
    const t = [
      ["MY WORK DIARY 2026/27"],
      ["(remember to send Apex the October invoice!!)"],
      [],
      ["Date", "Job", "Who for", "Days", "Rate", "TOTAL", "Paid?", "notes"],
    ];
    expect(findHeaderRow(t)).toBe(3);
  });

  it("is row 0 for an ordinary header", () => {
    expect(
      findHeaderRow([
        ["Date", "Description", "Amount"],
        ["08/05/2026", "x", "1"],
      ])
    ).toBe(0);
  });
});

describe("inferColumnMap", () => {
  it("QuickBooks transaction detail", () => {
    const h = [
      "Date",
      "Transaction Type",
      "Num",
      "Name",
      "Memo/Description",
      "Account",
      "Debit",
      "Credit",
      "Balance",
    ];
    const m = inferColumnMap(
      h,
      rowsOf(h, [
        ["", "", "", "", "", "Sales"],
        ["", "", "", "", "", "PPE"],
      ])
    );
    expect(m).toMatchObject({
      date: "Date",
      kind: "Transaction Type",
      reference: "Num",
      payee: "Name",
      description: "Memo/Description",
      category: "Account",
      debit: "Debit",
      credit: "Credit",
    });
    expect(Object.values(m)).not.toContain("Balance");
  });

  it("does not take a constant bank-account column for the category", () => {
    const h = ["Date", "Description", "Category", "Amount", "Account"];
    const m = inferColumnMap(h, rowsOf(h, [["", "", "Sales", "", "Business Current Account"]]));
    expect(m.category).toBe("Category");
    const h2 = ["Date", "Name", "Account", "Split", "Debit", "Credit"];
    expect(
      inferColumnMap(
        h2,
        rowsOf(h2, [
          ["", "", "Business"],
          ["", "", "Business"],
        ])
      ).category
    ).toBeUndefined();
  });

  it("Starling-style: counter party, reference, spending category", () => {
    const h = [
      "Date",
      "Counter Party",
      "Reference",
      "Type",
      "Amount (GBP)",
      "Balance (GBP)",
      "Spending Category",
      "Notes",
    ];
    expect(inferColumnMap(h)).toMatchObject({
      date: "Date",
      payee: "Counter Party",
      reference: "Reference",
      amount: "Amount (GBP)",
      category: "Spending Category",
      notes: "Notes",
    });
  });

  it("Xero invoice export, with camelCase headers", () => {
    const h = [
      "ContactName",
      "InvoiceNumber",
      "InvoiceDate",
      "DueDate",
      "Description",
      "Quantity",
      "UnitAmount",
      "AccountCode",
      "TaxType",
      "Currency",
    ];
    expect(inferColumnMap(h)).toEqual({
      payee: "ContactName",
      reference: "InvoiceNumber",
      date: "InvoiceDate",
      description: "Description",
      quantity: "Quantity",
      unit_amount: "UnitAmount",
    });
  });

  it("Xero ledger: debit/credit with gross, net and VAT", () => {
    const h = [
      "Date",
      "Source",
      "Description",
      "Reference",
      "Account Code",
      "Account",
      "Debit",
      "Credit",
      "Gross",
      "Net",
      "VAT",
    ];
    expect(inferColumnMap(h)).toMatchObject({
      kind: "Source",
      debit: "Debit",
      credit: "Credit",
      gross: "Gross",
      amount: "Net",
      vat: "VAT",
    });
  });

  it("work diary and its expenses sheet", () => {
    expect(
      inferColumnMap(["Date", "Job", "Who for", "Days", "Rate", "TOTAL", "Paid?", "notes"])
    ).toEqual({
      date: "Date",
      description: "Job",
      payee: "Who for",
      quantity: "Days",
      unit_amount: "Rate",
      amount: "TOTAL",
      paid: "Paid?",
      notes: "notes",
    });
    expect(inferColumnMap(["date", "what", "who", "amount inc vat"])).toEqual({
      date: "date",
      description: "what",
      payee: "who",
      gross: "amount inc vat",
    });
  });

  it("Monzo-style money in / out", () => {
    const m = inferColumnMap([
      "Date",
      "Name",
      "Category",
      "Amount",
      "Description",
      "Money Out",
      "Money In",
    ]);
    expect(m).toMatchObject({ debit: "Money Out", credit: "Money In", payee: "Name" });
  });
});

describe("inferHeaderlessMap", () => {
  it("finds date, amount and description in any order", () => {
    const rows = rowsOf(
      ["A", "B", "C"],
      [
        ["09/04/2026", "-48.5", "Trainline Return London - Birmingham"],
        ["08/05/2026", "570", "Stage One Productions Ltd INV-0101"],
      ]
    );
    expect(inferHeaderlessMap(rows)).toEqual({ date: "A", amount: "B", description: "C" });
  });

  it("treats two exclusive amount columns as money out and in", () => {
    const rows = rowsOf(
      ["A", "B", "C", "D"],
      [
        ["14/04/2026", "CARD Premier Inn", "77", ""],
        ["08/05/2026", "FPS CR Stage One", "", "570"],
      ]
    );
    expect(inferHeaderlessMap(rows)).toEqual({
      date: "A",
      description: "B",
      debit: "C",
      credit: "D",
    });
  });
});

describe("isTotalRow", () => {
  it("catches totals wherever the label sits", () => {
    expect(isTotalRow(["", "", "SUBTOTAL INCOME", "£5,030.00"])).toBe(true);
    expect(isTotalRow(["", "", "", "", "TOTAL", "£17,750.00"])).toBe(true);
    expect(isTotalRow(["09/04/2026", "Rigger - ExCeL London", "570"])).toBe(false);
  });
});

describe("pnlReportRows", () => {
  it("reads category totals and skips headings and totals", () => {
    const t = [
      ["Loris Barbisan"],
      ["Profit and Loss"],
      ["6 April 2026 - 13 November 2026"],
      ["", "Total"],
      ["Income"],
      ["Sales", "17,750.00"],
      ["Total Income", "17,750.00"],
      ["Expenses"],
      ["Travel and parking", "451.50"],
      ["Bank charges", "5.00"],
      ["Total Expenses", "3,108.80"],
      ["Net Profit", "14,641.20"],
    ];
    expect(pnlReportRows(t)).toEqual({
      period: "6 April 2026 - 13 November 2026",
      lines: [
        { section: "income", label: "Sales", amount_pence: 1775000 },
        { section: "expenses", label: "Travel and parking", amount_pence: 45150 },
        { section: "expenses", label: "Bank charges", amount_pence: 500 },
      ],
    });
  });

  it("is null for a transaction list", () => {
    expect(
      pnlReportRows([
        ["Date", "Amount"],
        ["08/05/2026", "1"],
      ])
    ).toBeNull();
  });
});

describe("isContactList", () => {
  it("recognises a customer list", () => {
    expect(isContactList(["Customer", "Email", "Phone", "Billing Address"])).toBe(true);
    expect(isContactList(["Date", "Customer", "Amount"])).toBe(false);
  });
});

describe("invoiceFromText", () => {
  it("reads a single invoice", () => {
    const text = [
      "INVOICE",
      "Barbisan Technical Services",
      "Invoice number INV-0112",
      "Invoice date 27/06/2026",
      "Due date 24/06/2026",
      "Bill to Meridian Broadcast Ltd",
      "Reference Summer Broadcast, ExCeL London",
      "Description Days Rate Amount",
      "Video Engineer - ExCeL London 3 £420.00 £1,260.00",
      "Kit hire — comms rebilled £84.00",
      "Total due £1,344.00",
    ].join("\n");
    expect(invoiceFromText(text)).toEqual({
      Date: "27/06/2026",
      Description: "Video Engineer - ExCeL London; Kit hire — comms rebilled",
      Amount: "£1,344.00",
      Reference: "INV-0112",
      Payee: "Meridian Broadcast Ltd",
    });
  });

  it("is null for a statement", () => {
    expect(invoiceFromText("Statement\n08/05/2026 Stage One 570.00")).toBeNull();
  });
});

describe("small helpers", () => {
  it("cleanBankText drops bank codes", () => {
    expect(cleanBankText("FPS CR Stage One Producti")).toBe("Stage One Producti");
    expect(cleanBankText("CARD Premier Inn")).toBe("Premier Inn");
    expect(cleanBankText("Cardiff Arms Park")).toBe("Cardiff Arms Park");
  });

  it("sheetDirection reads sheet names", () => {
    expect(sheetDirection("expenses")).toBe("expense");
    expect(sheetDirection("Gigs 26-27")).toBe("earnings");
    expect(sheetDirection("Sheet1")).toBeNull();
  });

  it("normHeader splits camelCase and drops punctuation", () => {
    expect(normHeader("InvoiceDate")).toBe("invoice date");
    expect(normHeader("Amount (GBP)")).toBe("amount gbp");
    expect(normHeader("Paid?")).toBe("paid");
  });
});
