import { describe, it, expect } from "vitest";
import { allowableExpensePence, sumAllowableExpenses } from "./expense-totals";

const e = (over: Partial<Parameters<typeof allowableExpensePence>[0]> = {}) => ({
  net_amount_pence: 10000,
  vat_amount_pence: 2000,
  business_use_percent: 100,
  allowable: true,
  currency: "GBP",
  ...over,
});

describe("allowableExpensePence", () => {
  it("counts gross × business use for an allowable sterling expense", () => {
    expect(allowableExpensePence(e())).toBe(12000);
    expect(allowableExpensePence(e({ business_use_percent: 50 }))).toBe(6000);
  });

  it("counts nothing for a disallowed expense", () => {
    expect(allowableExpensePence(e({ allowable: false }))).toBe(0);
  });

  it("never counts €100 as £100", () => {
    expect(allowableExpensePence(e({ currency: "EUR" }))).toBe(0);
  });
});

describe("sumAllowableExpenses", () => {
  it("totals sterling and reports what was left out for currency", () => {
    expect(
      sumAllowableExpenses([
        e(),
        e({ currency: "EUR" }),
        e({ currency: "usd" }),
        e({ allowable: false }),
      ])
    ).toEqual({ pence: 12000, otherCurrency: 2 });
  });
});
