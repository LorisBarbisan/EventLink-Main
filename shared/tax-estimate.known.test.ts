import { describe, it, expect } from "vitest";
import { estimateTax, BANDS_2026_27 } from "./tax-estimate";

/**
 * Known answers, worked by hand from HMRC's 2026/27 rates. These assert
 * pounds, not shape: the earlier tests checked that the parts summed to the
 * whole and missed two faults where the parts themselves were wrong.
 *
 * Income Tax here is the tax on the freelance profit only — total tax on
 * (other income + profit) minus tax on other income alone.
 */
const it_ = (profit: number, opts: Parameters<typeof estimateTax>[2] = {}) =>
  estimateTax(profit * 100, BANDS_2026_27, opts).incomeTaxTotalPence / 100;

describe("Income Tax known answers — rUK", () => {
  it("£40,000 profit: (40,000 − 12,570) × 20%", () => {
    expect(it_(40_000)).toBe(5_486);
  });

  it("£100,000 profit: allowance intact", () => {
    expect(it_(100_000)).toBe(27_432);
  });

  it("£110,000 profit: allowance £7,570, basic band moves down with it", () => {
    // 37,700 × 20% + (110,000 − 45,270) × 40%
    expect(it_(110_000)).toBe(33_432);
  });

  it("£125,140 profit: no allowance, 37,700 at 20%, the rest at 40%", () => {
    expect(it_(125_140)).toBe(42_516);
  });

  it("£150,000 profit: plus 45% above £125,140", () => {
    expect(it_(150_000)).toBe(53_703);
  });

  it("£60,000 profit with £800 Gift Aid widens the basic band by £1,000", () => {
    expect(it_(60_000, { giftAidNetPence: 80_000 })).toBe(11_232);
  });
});

describe("Income Tax known answers — profit on top of other income", () => {
  it("£20,000 salary + £30,000 profit: profit stays in the basic band", () => {
    expect(it_(30_000, { otherIncomePence: 2_000_000 })).toBe(6_000);
  });

  it("£50,000 salary + £30,000 profit: £270 at 20%, the rest at 40%", () => {
    expect(it_(30_000, { otherIncomePence: 5_000_000 })).toBe(11_946);
  });

  it("£50,000 salary + £60,000 profit: includes the £5,000 of allowance lost to the taper", () => {
    // tax on £110,000 (33,432) − tax on £50,000 (7,486)
    expect(it_(60_000, { otherIncomePence: 5_000_000 })).toBe(25_946);
  });

  it("£80,000 salary + £40,000 profit: includes £10,000 of allowance lost", () => {
    // tax on £120,000 (39,432) − tax on £80,000 (19,432)
    expect(it_(40_000, { otherIncomePence: 8_000_000 })).toBe(20_000);
  });
});

describe("Income Tax known answers — Scotland", () => {
  it("£40,000 profit", () => {
    // 2,306 × 19% + 11,685 × 20% + 13,439 × 21%
    expect(it_(40_000, { scotland: true })).toBe(5_597.33);
  });

  it("£125,140 profit: every band moves down with the lost allowance", () => {
    // 2,306×19% + 11,685×20% + 17,101×21% + 31,338×42% + 62,710×45%
    expect(it_(125_140, { scotland: true })).toBe(47_747.81);
  });
});

describe("pension saving uses the same banding", () => {
  it("£10,000 gross pension on £60,000 profit saves 40% of it", () => {
    const e = estimateTax(6_000_000, BANDS_2026_27, { pensionGrossPence: 1_000_000 });
    // tax on £60,000 (11,432) − tax on £50,000 (7,486) = 3,946
    expect(e.pensionTaxSavingPence / 100).toBe(3_946);
  });
});
