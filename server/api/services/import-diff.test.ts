import { describe, it, expect } from "vitest";
import { earningDiffersFromImport, expenseDiffersFromImport } from "./import-diff";

const parsed = { description: "Rigger - ExCeL London", date: "2026-04-09", amount_pence: 57000 };

const asImported = {
  description: "Rigger - ExCeL London",
  work_date: "2026-04-09",
  gross_amount_pence: 57000,
  notes: null,
  status: "expected",
  paid_date: null,
  client_id: null,
  booking_id: null,
  invoice_id: null,
};

describe("earningDiffersFromImport", () => {
  it("is unchanged straight after import, whatever the review flag says", () => {
    expect(earningDiffersFromImport(asImported, parsed)).toBe(false);
  });

  it("counts real work: amount, paid, client, booking", () => {
    expect(earningDiffersFromImport({ ...asImported, gross_amount_pence: 60000 }, parsed)).toBe(
      true
    );
    expect(
      earningDiffersFromImport({ ...asImported, status: "paid", paid_date: "2026-05-31" }, parsed)
    ).toBe(true);
    expect(earningDiffersFromImport({ ...asImported, client_id: 4 }, parsed)).toBe(true);
    expect(earningDiffersFromImport({ ...asImported, booking_id: 9 }, parsed)).toBe(true);
  });

  it("uses commit's fallbacks when the file had no description or amount", () => {
    expect(
      earningDiffersFromImport(
        { ...asImported, description: "Imported earnings entry", gross_amount_pence: 0 },
        { date: "2026-04-09" }
      )
    ).toBe(false);
  });
});

describe("expenseDiffersFromImport", () => {
  const x = {
    description: "Fuel",
    expense_date: "2026-06-01",
    net_amount_pence: 4500,
    vat_amount_pence: 0,
    notes: null,
    business_use_percent: 100,
    booking_id: null,
    earnings_entry_id: null,
  };
  const p = { description: "Fuel", date: "2026-06-01", amount_pence: -4500 };

  it("is unchanged straight after import (amounts stored positive)", () => {
    expect(expenseDiffersFromImport(x, p, false)).toBe(false);
  });

  it("counts a receipt, a job link or a business-use change", () => {
    expect(expenseDiffersFromImport(x, p, true)).toBe(true);
    expect(expenseDiffersFromImport({ ...x, earnings_entry_id: 2 }, p, false)).toBe(true);
    expect(expenseDiffersFromImport({ ...x, business_use_percent: 50 }, p, false)).toBe(true);
  });
});
