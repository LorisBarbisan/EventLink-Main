import { describe, it, expect } from "vitest";
import {
  estimateTax,
  bandsForTaxYear,
  BANDS_2024_25,
  BANDS_2025_26,
  BANDS_2026_27,
} from "./tax-estimate";

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

describe("Income Tax known answers — Scotland 2026/27", () => {
  // Limits above the allowance: starter 3,967, basic 16,956,
  // intermediate 31,092, higher 62,430, advanced 125,140
  it("£40,000 profit", () => {
    // 3,967 × 19% + 12,989 × 20% + 10,474 × 21%
    expect(it_(40_000, { scotland: true })).toBe(5_551.07);
  });

  it("£125,140 profit: every band moves down with the lost allowance", () => {
    // 3,967×19% + 12,989×20% + 14,136×21% + 31,338×42% + 62,710×45%
    expect(it_(125_140, { scotland: true })).toBe(47_701.55);
  });

  it("each year uses its own Scottish bands", () => {
    // £40,000 in 2024/25: 2,306×19% + 11,685×20% + 13,439×21%
    expect(estimateTax(4_000_000, BANDS_2024_25, { scotland: true }).incomeTaxTotalPence).toBe(
      559_733
    );
    // 2025/26: 2,827×19% + 12,094×20% + 12,509×21% = 5,582.82
    expect(estimateTax(4_000_000, BANDS_2025_26, { scotland: true }).incomeTaxTotalPence).toBe(
      558_282
    );
  });
});

describe("Scottish freelancer, 2026/27 — pension, Gift Aid, Plan 4, Child Benefit", () => {
  // Checked against an independent hand calculation.
  // Profit £72,421.20; £5,000 gross pension (relief at source);
  // £200 Gift Aid (£250 gross); Plan 4; one child at £27.05 a week.
  const e = estimateTax(7_242_120, BANDS_2026_27, {
    scotland: true,
    pensionGrossPence: 500_000,
    giftAidNetPence: 20_000,
    studentLoanPlans: ["plan4"],
    childBenefitAnnualPence: 140_660,
  });

  it("Income Tax: pension and Gift Aid extend basic and intermediate by £5,250", () => {
    // taxable 59,851.20: 3,967×19% + 18,239×20% + 14,136×21% + 23,509.20×42%
    expect(e.incomeTaxTotalPence).toBe(1_724_395);
  });

  it("pension: £1,000 added to the pot, £1,100 more off the bill", () => {
    expect(e.pensionExtraReliefPence).toBe(110_000);
    expect(e.pensionTaxSavingPence).toBe(210_000);
  });

  it("Class 4 NI is not reduced by the pension", () => {
    // 37,700 × 6% + 22,151.20 × 2%
    expect(e.niTotalPence).toBe(270_502);
  });

  it("Plan 4 repays 9% above the 2026/27 threshold of £33,795", () => {
    expect(e.studentLoanTotalPence).toBe(347_636);
  });

  it("HICBC: ANI £67,171.20 → 35% of £1,406.60, rounded down to whole pounds", () => {
    expect(e.adjustedNetIncomePence).toBe(6_717_120);
    expect(e.hicbcPence).toBe(49_200);
  });
});

describe("student loan thresholds follow the tax year", () => {
  const sl = (bands: typeof BANDS_2026_27) =>
    estimateTax(4_000_000, bands, { studentLoanPlans: ["plan1"] }).studentLoanTotalPence;
  it("Plan 1 on £40,000", () => {
    expect(sl(BANDS_2024_25)).toBe(135_090); // (40,000 − 24,990) × 9%
    expect(sl(BANDS_2025_26)).toBe(125_415); // (40,000 − 26,065) × 9%
    expect(sl(BANDS_2026_27)).toBe(117_900); // (40,000 − 26,900) × 9%
  });
});

describe("pension relief at source", () => {
  it("£10,000 gross pension on £60,000 profit: £2,000 in the pot, £1,946 off the bill", () => {
    const e = estimateTax(6_000_000, BANDS_2026_27, { pensionGrossPence: 1_000_000 });
    // bill: 11,432 without; basic band extended to £60,270 → 47,430 × 20% = 9,486
    expect(e.incomeTaxTotalPence / 100).toBe(9_486);
    expect(e.pensionExtraReliefPence / 100).toBe(1_946);
    expect(e.pensionTaxSavingPence / 100).toBe(3_946);
  });

  it("a basic rate taxpayer gets all relief in the pot, none on the bill", () => {
    const e = estimateTax(3_000_000, BANDS_2026_27, { pensionGrossPence: 200_000 });
    expect(e.incomeTaxTotalPence / 100).toBe(3_486);
    expect(e.pensionExtraReliefPence).toBe(0);
    expect(e.pensionTaxSavingPence / 100).toBe(400);
  });

  it("restores the personal allowance lost to the taper", () => {
    // £110,000 profit, £10,000 gross: ANI £100,000 → full allowance
    const e = estimateTax(11_000_000, BANDS_2026_27, { pensionGrossPence: 1_000_000 });
    expect(e.adjustedPersonalAllowancePence).toBe(1_257_000);
    // 47,700 × 20% + 49,730 × 40%
    expect(e.incomeTaxTotalPence / 100).toBe(29_432);
  });
});

describe("31 January: the balancing payment is everything Self Assessment collects", () => {
  it("£70,000, Plan 2, £2,000 Child Benefit", () => {
    const e = estimateTax(7_000_000, BANDS_2026_27, {
      studentLoanPlans: ["plan2"],
      childBenefitAnnualPence: 200_000,
    });
    expect(e.totalTaxPence).toBe(1_808_860); // IT 15,432 + Class 4 2,656.60
    expect(e.studentLoanTotalPence).toBe(365_535); // (70,000 − 29,385) × 9%
    expect(e.hicbcPence).toBe(100_000); // 50% of £2,000
    // balancing 18,088.60 + 3,655.35 + 1,000 = 22,743.95
    // + 1st payment on account: half of (18,088.60 + 1,000) = 9,544.30
    expect(e.paymentSchedule.januaryPence).toBe(3_228_825);
    // student loan is never in a payment on account
    expect(e.paymentSchedule.julyPence).toBe(954_430);
  });
});

describe("losses brought forward reduce Class 4 and the student loan too", () => {
  it("£40,000 less £10,000 is taxed like £30,000", () => {
    const opts = { studentLoanPlans: ["plan2" as const] };
    const withLoss = estimateTax(4_000_000, BANDS_2026_27, {
      ...opts,
      lossesCarriedForwardPence: 1_000_000,
    });
    const plain = estimateTax(3_000_000, BANDS_2026_27, opts);
    expect(withLoss.incomeTaxTotalPence).toBe(348_600);
    expect(withLoss.niTotalPence).toBe(104_580);
    expect(withLoss.studentLoanTotalPence).toBe(5_535);
    expect(withLoss.niTotalPence).toBe(plain.niTotalPence);
    expect(withLoss.studentLoanTotalPence).toBe(plain.studentLoanTotalPence);
  });
});

describe("Marriage Allowance shows the giver's real cost", () => {
  it("nil when the reduced allowance still covers the profit", () => {
    const e = estimateTax(1_000_000, BANDS_2026_27, { marriageAllowance: "giving" });
    expect(e.marriageAllowancePenceDelta).toBe(0);
  });
  it("£252 when the whole £1,260 would have been taxed at 20%", () => {
    const e = estimateTax(3_000_000, BANDS_2026_27, { marriageAllowance: "giving" });
    expect(e.marriageAllowancePenceDelta).toBe(25_200);
  });
  it("part of it in between: £12,000 profit, £690 newly taxed at 20%", () => {
    const e = estimateTax(1_200_000, BANDS_2026_27, { marriageAllowance: "giving" });
    expect(e.marriageAllowancePenceDelta).toBe(13_800);
  });
});

describe("a tax year without published rates says so", () => {
  it("2027/28 borrows 2026/27 figures, keeps its own label and dates", () => {
    const b = bandsForTaxYear("2027/28");
    expect(b.provisionalFrom).toBe("2026/27");
    const e = estimateTax(4_000_000, b);
    expect(e.taxYearLabel).toBe("2027/28");
    expect(e.ratesProvisionalFrom).toBe("2026/27");
    expect(e.paymentSchedule.januaryDate).toBe("31 Jan 2029");
  });
  it("a known year is not provisional", () => {
    expect(bandsForTaxYear("2026/27").provisionalFrom).toBeUndefined();
  });
});
