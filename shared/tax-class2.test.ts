import { describe, it, expect } from "vitest";
import { estimateTax, BANDS_2025_26 } from "./tax-estimate";

describe("voluntary Class 2 NI", () => {
  it("is offered below the Small Profits Threshold, and never added to tax due", () => {
    const est = estimateTax(500_000, BANDS_2025_26); // £5,000 profit
    expect(est.class2Voluntary).toEqual({
      annualPence: 350 * 52,
      weeklyPence: 350,
      thresholdPence: 684_500,
    });
    expect(est.totalTaxPence).toBe(est.incomeTaxTotalPence + est.niTotalPence);
  });

  it("is not mentioned above the threshold, where the year counts automatically", () => {
    expect(estimateTax(2_000_000, BANDS_2025_26).class2Voluntary).toBeNull();
  });
});
