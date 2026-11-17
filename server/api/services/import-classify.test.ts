import { describe, it, expect } from "vitest";
import { classifyRow } from "./import-classify";
import { inferColumnMap, inferHeaderlessMap } from "./import-table";

const row = (headers: string[], cells: string[]) =>
  Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));

describe("classifyRow, per source layout", () => {
  it("QuickBooks transaction detail: name + memo, debit is an expense", () => {
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
    const m = inferColumnMap(h, [
      row(h, ["", "", "", "", "", "Sales"]),
      row(h, ["", "", "", "", "", "PPE"]),
    ]);
    const inv = classifyRow(
      row(h, [
        "2026-04-09",
        "Invoice",
        "INV-0101",
        "Stage One Productions Ltd",
        "Rigger - ExCeL London",
        "Sales",
        "",
        "570",
        "570",
      ]),
      m
    );
    expect(inv).toMatchObject({
      target: "earnings",
      parsed: {
        date: "2026-04-09",
        amount_pence: 57000,
        reference: "INV-0101",
        payee: "Stage One Productions Ltd",
        description: "Stage One Productions Ltd — Rigger - ExCeL London",
      },
    });
    const exp = classifyRow(
      row(h, [
        "2026-04-09",
        "Expense",
        "",
        "Trainline",
        "Return London - Birmingham",
        "Travel and parking",
        "48.5",
        "",
        "521.5",
      ]),
      m
    );
    expect(exp).toMatchObject({
      target: "expense",
      parsed: { amount_pence: -4850, category_name: "Travel and parking" },
    });
  });

  it("Xero ledger: a Bill's debit is an expense at its gross, with VAT", () => {
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
    const m = inferColumnMap(h);
    expect(
      classifyRow(
        row(h, [
          "2026-04-10",
          "Bill",
          "NCP - Parking ExCeL",
          "",
          "400",
          "Travel and parking",
          "22",
          "",
          "26.4",
          "22",
          "4.4",
        ]),
        m
      )
    ).toMatchObject({
      target: "expense",
      parsed: { amount_pence: -2640, vat_pence: 440 },
    });
    expect(
      classifyRow(
        row(h, [
          "2026-04-09",
          "Sales Invoice",
          "Rigger - ExCeL",
          "INV-0101",
          "200",
          "Sales",
          "",
          "570",
          "570",
          "570",
          "0",
        ]),
        m
      ).target
    ).toBe("earnings");
  });

  it("Starling: counter party and reference make the description", () => {
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
    expect(
      classifyRow(
        row(h, [
          "09/04/2026",
          "Trainline",
          "Return London - Birmingham",
          "Card Payment",
          "-48.5",
          "1794.1",
          "Travel and parking",
        ]),
        inferColumnMap(h)
      ).parsed
    ).toMatchObject({
      description: "Trainline — Return London - Birmingham",
      amount_pence: -4850,
      category_name: "Travel and parking",
    });
  });

  it("Xero invoice export: quantity × unit amount, camelCase date", () => {
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
    expect(
      classifyRow(
        row(h, [
          "Stage One Productions Ltd",
          "INV-0101",
          "2026-04-09",
          "2026-05-09",
          "Rigger - ExCeL London",
          "2",
          "285",
          "200",
          "No VAT",
          "GBP",
        ]),
        inferColumnMap(h)
      )
    ).toMatchObject({
      target: "earnings",
      parsed: { date: "2026-04-09", amount_pence: 57000, reference: "INV-0101" },
    });
  });

  it("work diary: total, client and Paid? YES", () => {
    const h = ["Date", "Job", "Who for", "Days", "Rate", "TOTAL", "Paid?", "notes"];
    expect(
      classifyRow(
        row(h, [
          "14-Apr-26",
          "LX Technician - Manchester Central",
          "Northern AV Hire Ltd",
          "1",
          "£240.00",
          "£240.00",
          "YES",
        ]),
        inferColumnMap(h)
      )
    ).toMatchObject({
      target: "earnings",
      parsed: {
        date: "2026-04-14",
        amount_pence: 24000,
        paid: true,
        payee: "Northern AV Hire Ltd",
      },
    });
  });

  it("an 'expenses' sheet turns unsigned amounts into expenses", () => {
    const h = ["date", "what", "who", "amount inc vat"];
    expect(
      classifyRow(
        row(h, ["09/04/2026", "Return London - Birmingham", "Trainline", "£48.50"]),
        inferColumnMap(h),
        { direction: "expense" }
      )
    ).toMatchObject({
      target: "expense",
      parsed: { amount_pence: -4850, description: "Trainline — Return London - Birmingham" },
    });
  });

  it("headerless bank export: codes stripped, money out and in", () => {
    const rows = [
      row(["A", "B", "C", "D"], ["14/04/2026", "CARD Premier Inn", "77", ""]),
      row(["A", "B", "C", "D"], ["08/05/2026", "FPS CR Stage One Producti", "", "570"]),
    ];
    const m = inferHeaderlessMap(rows);
    expect(classifyRow(rows[0], m, { headerless: true })).toMatchObject({
      target: "expense",
      parsed: { description: "Premier Inn", amount_pence: -7700 },
    });
    expect(classifyRow(rows[1], m, { headerless: true })).toMatchObject({
      target: "earnings",
      parsed: { description: "Stage One Producti", amount_pence: 57000 },
    });
  });

  it("subtotal rows are skipped", () => {
    const h = ["Transaction Date", "Client / Supplier", "Details", "Amount", "VAT", "Ref"];
    expect(
      classifyRow(row(h, ["", "", "SUBTOTAL INCOME", "£5,030.00", "£0.00"]), inferColumnMap(h))
        .target
    ).toBe("skip");
  });
});
