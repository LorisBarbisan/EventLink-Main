import { describe, it, expect } from "vitest";
import { allowableExpensePence, sumAllowableExpenses } from "./expense-totals";
import { estimateTax, BANDS_2026_27 } from "./tax-estimate";

const e = (over: Partial<Parameters<typeof allowableExpensePence>[0]> = {}) => ({
  net_amount_pence: 10000,
  vat_amount_pence: 2000,
  business_use_percent: 100,
  allowable: true,
  currency: "GBP",
  ...over,
});

describe("allowableExpensePence", () => {
  it("counts gross × business use when not VAT-registered", () => {
    expect(allowableExpensePence(e(), false)).toBe(12000);
    expect(allowableExpensePence(e({ business_use_percent: 50 }), false)).toBe(6000);
  });

  it("counts net × business use when VAT-registered: the VAT is reclaimed", () => {
    expect(allowableExpensePence(e(), true)).toBe(10000);
    expect(allowableExpensePence(e({ business_use_percent: 50 }), true)).toBe(5000);
  });

  it("counts nothing for a disallowed expense", () => {
    expect(allowableExpensePence(e({ allowable: false }), false)).toBe(0);
    expect(allowableExpensePence(e({ allowable: false }), true)).toBe(0);
  });

  it("never counts €100 as £100", () => {
    expect(allowableExpensePence(e({ currency: "EUR" }), false)).toBe(0);
  });
});

describe("sumAllowableExpenses", () => {
  it("totals sterling and reports what was left out for currency", () => {
    const list = [e(), e({ currency: "EUR" }), e({ currency: "usd" }), e({ allowable: false })];
    expect(sumAllowableExpenses(list, false)).toEqual({ pence: 12000, otherCurrency: 2 });
    expect(sumAllowableExpenses(list, true)).toEqual({ pence: 10000, otherCurrency: 2 });
  });
});

// Known answer from the VAT epic: £60,000 of fees (recorded net of output VAT)
// and £10,000 of costs carrying £2,000 of input VAT. Done properly, profit is
// £50,000 for a registered freelancer; counting the reclaimed VAT as a cost
// gave £48,000 and under-reserved tax.
describe("VAT-registered profit and tax", () => {
  const earnings = 6_000_000;
  const costs = [e({ net_amount_pence: 1_000_000, vat_amount_pence: 200_000 })];

  it("profit excludes the reclaimed VAT for a registered freelancer", () => {
    expect(earnings - sumAllowableExpenses(costs, true).pence).toBe(5_000_000);
    expect(earnings - sumAllowableExpenses(costs, false).pence).toBe(4_800_000);
  });

  it("reserves £520 more tax per £2,000 of input VAT at basic rate (20% tax + 6% Class 4)", () => {
    const registered = estimateTax(
      earnings - sumAllowableExpenses(costs, true).pence,
      BANDS_2026_27
    );
    const gross = estimateTax(earnings - sumAllowableExpenses(costs, false).pence, BANDS_2026_27);
    expect(registered.totalTaxPence - gross.totalTaxPence).toBe(52_000);
  });
});
