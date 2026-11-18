/**
 * UK self-assessment tax estimate for sole traders / freelancers.
 *
 * Covers Income Tax and Class 4 National Insurance.
 * Class 2 NI: from 2024/25 nobody has to pay it. Above the Small Profits
 * Threshold the year counts towards the State Pension automatically; below it,
 * paying voluntary Class 2 buys that qualifying year. The estimate never adds
 * it to the tax due, but reports what it would cost so the screen can say so.
 * Figures are for 2024/25 and later years; update `BANDS` for future years.
 *
 * All monetary values are integer pence.
 */

export interface TaxBands {
  taxYear: string; // e.g. "2024/25"
  personalAllowancePence: number;
  /** Income above which the personal allowance tapers at £1 for every £2 */
  taperThresholdPence: number;
  basicRatePence: number; // upper limit of basic rate band (England/Wales/NI)
  higherRatePence: number; // upper limit of higher rate band
  basicRatePct: number; // e.g. 20
  higherRatePct: number; // e.g. 40
  additionalRatePct: number; // e.g. 45
  /** Class 4 NI lower profits limit */
  niLowerPence: number;
  /** Class 4 NI upper profits limit */
  niUpperPence: number;
  niLowerRatePct: number; // 6% 2024/25
  niUpperRatePct: number; // 2%
  /** Small Profits Threshold: below it, Class 2 NI is voluntary */
  smallProfitsThresholdPence: number;
  /**
   * Voluntary Class 2 NI, pence per week (GOV.UK, "Self-employed National
   * Insurance rates"). Not Class 3: the NI rates table lists Class 3 (£18.40/wk
   * in 2026/27) as "voluntary", but that route is for people who are not
   * self-employed. A self-employed person below the Small Profits Threshold
   * buys the qualifying year with voluntary Class 2 at this rate. HMRC counts
   * 52 weeks, so the yearly figure is weekly × 52.
   */
  class2WeeklyPence: number;
}

/** 2024/25 rates — update each April */
export const BANDS_2024_25: TaxBands = {
  taxYear: "2024/25",
  personalAllowancePence: 1_257_000, // £12,570
  taperThresholdPence: 10_000_000, // £100,000
  basicRatePence: 5_027_000, // £50,270
  higherRatePence: 12_514_000, // £125,140
  basicRatePct: 20,
  higherRatePct: 40,
  additionalRatePct: 45,
  niLowerPence: 1_257_000, // £12,570
  niUpperPence: 5_027_000, // £50,270
  niLowerRatePct: 6,
  niUpperRatePct: 2,
  smallProfitsThresholdPence: 672_500, // £6,725
  class2WeeklyPence: 345, // £3.45
};

/** 2025/26 — same rates as 2024/25 (thresholds frozen) */
export const BANDS_2025_26: TaxBands = {
  ...BANDS_2024_25,
  taxYear: "2025/26",
  smallProfitsThresholdPence: 684_500, // £6,845
  class2WeeklyPence: 350, // £3.50
};

/** 2026/27 — same rates (thresholds still frozen per current policy) */
export const BANDS_2026_27: TaxBands = {
  ...BANDS_2024_25,
  taxYear: "2026/27",
  // Checked against GOV.UK, 17 Nov 2026
  smallProfitsThresholdPence: 710_500, // £7,105
  class2WeeklyPence: 365, // £3.65
};

const ALL_BANDS: TaxBands[] = [BANDS_2024_25, BANDS_2025_26, BANDS_2026_27];

/** Pick the best matching bands for a tax year label, falling back to latest. */
export function bandsForTaxYear(label: string): TaxBands {
  return ALL_BANDS.find((b) => b.taxYear === label) ?? BANDS_2026_27;
}

/**
 * Scottish Income Tax thresholds for 2024/25 (same for 2025/26 and 2026/27
 * pending Scottish Budget — update each December).
 * Format: [bandLowerPence, bandUpperPence, ratePct]
 * The first entry's lower is replaced with adjustedPA inside estimateTax.
 */
const SCOTLAND_IT_THRESHOLDS: [number, number, number][] = [
  [1_257_000, 1_487_600, 19], // Starter  (£12,570 – £14,876)
  [1_487_600, 2_656_100, 20], // Basic    (£14,876 – £26,561)
  [2_656_100, 4_366_200, 21], // Intermediate (£26,561 – £43,662)
  [4_366_200, 7_500_000, 42], // Higher   (£43,662 – £75,000)
  [7_500_000, 12_514_000, 45], // Advanced (£75,000 – £125,140)
  [12_514_000, Infinity, 48], // Top      (above £125,140)
];

export interface TaxBand {
  label: string;
  ratePct: number;
  onPence: number; // the slice of profit this band applies to
  taxPence: number;
}

/** HMRC simplified WFH allowance per year (pence) by tier */
export const WFH_TIERS = {
  low: 12_000, // £120/yr  (25–50 h/month)
  mid: 21_600, // £216/yr  (51–100 h/month)
  high: 31_200, // £312/yr  (101+ h/month)
} as const;

/** UK student loan repayment plans available to self-employed earners */
export type StudentLoanPlan = "plan1" | "plan2" | "plan4" | "plan5" | "postgrad";

/** Thresholds and rates per plan (2024/25 onwards) — pence per year */
export const STUDENT_LOAN_PLANS: Record<
  StudentLoanPlan,
  { label: string; thresholdPence: number; ratePct: number }
> = {
  plan1: { label: "Plan 1", thresholdPence: 2_499_000, ratePct: 9 }, // £24,990
  plan2: { label: "Plan 2", thresholdPence: 2_729_500, ratePct: 9 }, // £27,295
  plan4: { label: "Plan 4 (Scotland)", thresholdPence: 3_139_500, ratePct: 9 }, // £31,395
  plan5: { label: "Plan 5", thresholdPence: 2_500_000, ratePct: 9 }, // £25,000
  postgrad: { label: "Postgraduate", thresholdPence: 2_100_000, ratePct: 6 }, // £21,000
};

export interface TaxOptions {
  /** Other non-self-employment income (salary, pension, etc.) in pence */
  otherIncomePence?: number;
  /** Use Scottish Income Tax rates instead of England/Wales/NI */
  scotland?: boolean;
  /** Student loan plan(s) to include in the estimate */
  studentLoanPlans?: StudentLoanPlan[];
  /**
   * Gross pension contributions (personal + employer/relief-at-source top-up)
   * in pence for the tax year. Reduces taxable profit for Income Tax purposes
   * but does NOT reduce Class 4 NI (NI is on trading profits before pension).
   * Capped internally at net profit so it cannot create a negative IT base.
   */
  pensionGrossPence?: number;
  /**
   * HMRC simplified-expenses working-from-home tier for sole traders.
   * Reduces trading profit (affects both IT and NI).
   *   low  = 25–50 h/month  → £10/month (£120/year)
   *   mid  = 51–100 h/month → £18/month (£216/year)
   *   high = 101+ h/month   → £26/month (£312/year)
   */
  wfhTier?: "low" | "mid" | "high";
  /**
   * Net Gift Aid donations for the tax year in pence. Grossed up internally
   * by 100/80 (basic rate relief at source). The gross amount extends the
   * basic rate band and reduces adjusted net income.
   */
  giftAidNetPence?: number;
  /**
   * Unused trading losses brought forward from earlier tax years in pence.
   * Offset against this year's profit for Income Tax only (not Class 4 NI).
   */
  lossesCarriedForwardPence?: number;
  /**
   * Annual Child Benefit received (in pence). Required to compute HICBC.
   * Set to 0 or omit if the user does not receive Child Benefit.
   */
  childBenefitAnnualPence?: number;
  /**
   * Whether the user is transferring (giving) or receiving the Marriage
   * Allowance (£1,260 personal allowance transfer).
   * "giving"    — your PA is reduced by £1,260 (you are the lower earner)
   * "receiving" — you receive a £252 tax reducer (you are the higher earner)
   */
  marriageAllowance?: "giving" | "receiving";
}

export interface PaymentSchedule {
  /**
   * Payments on account apply when the tax bill is ≥ £1,000.
   * Each POA = 50 % of the previous year's bill.
   */
  poaApplies: boolean;
  /** First payment on account (31 Jan, year+2) + balancing payment in pence */
  januaryPence: number;
  /** Second payment on account (31 Jul, year+2) in pence */
  julyPence: number;
  /** e.g. "31 Jan 2028" */
  januaryDate: string;
  /** e.g. "31 Jul 2028" */
  julyDate: string;
}

export interface StudentLoanRepayment {
  plan: StudentLoanPlan;
  planLabel: string;
  thresholdPence: number;
  ratePct: number;
  repaymentPence: number;
}

export interface TaxEstimate {
  taxYearLabel: string;
  netProfitPence: number;
  adjustedPersonalAllowancePence: number;
  otherIncomePence: number;
  scotland: boolean;
  /** Income Tax */
  incomeTaxBands: TaxBand[];
  incomeTaxTotalPence: number;
  /** Class 4 NI */
  niBands: TaxBand[];
  niTotalPence: number;
  /** Combined Income Tax + NI (excludes student loan) */
  totalTaxPence: number;
  effectiveRatePct: number; // rounded to 1 dp
  paymentSchedule: PaymentSchedule;
  /** Student loan repayments (one entry per active plan) */
  studentLoanRepayments: StudentLoanRepayment[];
  /** Sum of all student loan repayments */
  studentLoanTotalPence: number;
  /** Gross pension contribution used in this estimate */
  pensionGrossPence: number;
  /** Income Tax saved because of the pension contribution */
  pensionTaxSavingPence: number;
  /** WFH flat-rate deduction applied (pence/year) — reduces both IT and NI */
  wfhAllowancePence: number;
  /** Gross Gift Aid amount used (net donations × 100/80); extends basic rate band */
  giftAidGrossPence: number;
  /** Losses brought forward offset against IT profit */
  lossReliefPence: number;
  /** Adjusted net income (profit + other income − pension − gift aid) */
  adjustedNetIncomePence: number;
  /** High Income Child Benefit Charge (0 if ANI ≤ £60,000 or no child benefit) */
  hicbcPence: number;
  /**
   * Marriage Allowance effect in pence.
   * Positive = tax saving (receiving the allowance, −£252).
   * Negative = additional tax cost (giving the allowance, +£252).
   */
  marriageAllowancePenceDelta: number;
  /** totalTaxPence + studentLoanTotalPence + hicbcPence */
  totalDeductionsPence: number;
  /**
   * Voluntary Class 2 NI. Set only when profit is below the Small Profits
   * Threshold: what a year of voluntary contributions would cost. Never part
   * of totalTaxPence — it is a choice, not a liability.
   */
  class2Voluntary: { annualPence: number; weeklyPence: number; thresholdPence: number } | null;
}

function bandTax(profit: number, lower: number, upper: number, ratePct: number): TaxBand | null {
  if (profit <= lower || lower >= upper) return null;
  const on = Math.min(profit, upper) - lower;
  if (on <= 0) return null;
  return {
    label: `${ratePct}% on ${formatBandLabel(lower, upper)}`,
    ratePct,
    onPence: on,
    taxPence: Math.round((on * ratePct) / 100),
  };
}

function formatBandLabel(lower: number, upper: number): string {
  const lo = (lower / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });
  if (upper === Infinity) return `over ${lo}`;
  const hi = (upper / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });
  return `${lo}–${hi}`;
}

interface ItInterval {
  lo: number;
  hi: number;
  rate: number;
  scottish: boolean;
}

/**
 * Income Tax bands as intervals of TOTAL income. Every boundary below the
 * additional/top rate threshold (£125,140, which HMRC fixes) sits a fixed
 * width above the personal allowance actually available, so when the
 * allowance tapers or is transferred the bands move down with it. Gift Aid
 * widens the basic band (rUK) or the bands up to intermediate (Scotland).
 */
function itIntervals(
  adjustedPA: number,
  giftAidGross: number,
  bands: TaxBands,
  scotland: boolean
): ItInterval[] {
  const topFixed = bands.higherRatePence; // £125,140 — fixed in both systems
  const cap = (v: number) => Math.min(v, topFixed);
  if (scotland) {
    const basePA = SCOTLAND_IT_THRESHOLDS[0][0];
    return SCOTLAND_IT_THRESHOLDS.map(([lo, hi, rate], i) => {
      if (lo >= topFixed) return { lo: topFixed, hi, rate, scottish: true };
      // Gift Aid extends everything from the intermediate ceiling upwards.
      const shift = (v: number, idx: number) =>
        adjustedPA + (v - basePA) + (idx >= 2 ? giftAidGross : 0);
      const l = i === 0 ? adjustedPA : cap(shift(lo, i - 1));
      const h = hi >= topFixed ? topFixed : cap(shift(hi, i));
      return { lo: l, hi: h, rate, scottish: true };
    });
  }
  const basicTop = cap(
    adjustedPA + (bands.basicRatePence - bands.personalAllowancePence) + giftAidGross
  );
  return [
    { lo: adjustedPA, hi: basicTop, rate: bands.basicRatePct, scottish: false },
    { lo: basicTop, hi: topFixed, rate: bands.higherRatePct, scottish: false },
    { lo: topFixed, hi: Infinity, rate: bands.additionalRatePct, scottish: false },
  ];
}

function onInterval(income: number, iv: ItInterval): number {
  return Math.max(0, Math.min(income, iv.hi) - iv.lo);
}

function adjustedPersonalAllowance(ani: number, bands: TaxBands, maGiving: boolean): number {
  const reduction = Math.max(0, Math.floor((ani - bands.taperThresholdPence) / 2));
  return Math.max(0, bands.personalAllowancePence - reduction - (maGiving ? 126_000 : 0));
}

/**
 * Income Tax attributable to the freelance profit: tax on (other income +
 * profit) minus tax on other income alone, band by band. The profit sits on
 * top of any salary, so it is taxed at the rates the salary leaves free.
 */
function freelanceIncomeTax(
  profitIT: number,
  otherIncome: number,
  giftAidGross: number,
  bands: TaxBands,
  scotland: boolean,
  maGiving: boolean
): { bands: TaxBand[]; totalPence: number; adjustedPA: number } {
  const total = profitIT + otherIncome;
  const paTotal = adjustedPersonalAllowance(Math.max(0, total - giftAidGross), bands, maGiving);
  const paOther = adjustedPersonalAllowance(
    Math.max(0, otherIncome - giftAidGross),
    bands,
    maGiving
  );
  const withProfit = itIntervals(paTotal, giftAidGross, bands, scotland);
  const without = itIntervals(paOther, giftAidGross, bands, scotland);
  const out: TaxBand[] = [];
  let totalPence = 0;
  withProfit.forEach((iv, i) => {
    const on = onInterval(total, iv) - onInterval(otherIncome, without[i]);
    if (on === 0) return;
    const taxPence = Math.round((on * iv.rate) / 100);
    totalPence += taxPence;
    out.push({
      label: `${iv.rate}%${iv.scottish ? " Scottish IT" : ""} on ${formatBandLabel(iv.lo, iv.hi)}`,
      ratePct: iv.rate,
      onPence: on,
      taxPence,
    });
  });
  return { bands: out, totalPence, adjustedPA: paTotal };
}

export function estimateTax(
  netProfitPence: number,
  bands: TaxBands,
  options?: TaxOptions
): TaxEstimate {
  const rawProfit = Math.max(0, netProfitPence);
  const otherIncome = options?.otherIncomePence ?? 0;
  const scotland = options?.scotland ?? false;

  // ── Working-from-home flat rate ──────────────────────────────────────────────
  // WFH reduces trading profit before both IT and NI.
  const wfhAllowancePence = options?.wfhTier ? WFH_TIERS[options.wfhTier] : 0;
  const profit = Math.max(0, rawProfit - wfhAllowancePence);

  // ── Losses carried forward ───────────────────────────────────────────────────
  // Offset against IT profit only (not NI). Capped at available profit.
  const lossReliefPence = Math.min(Math.max(0, options?.lossesCarriedForwardPence ?? 0), profit);
  const profitForIT = profit - lossReliefPence;

  // ── Pension relief ───────────────────────────────────────────────────────────
  // Pension contributions reduce taxable income for IT only, not Class 4 NI.
  // Cap at the IT profit so the base cannot go negative.
  const pensionGross = Math.min(Math.max(0, options?.pensionGrossPence ?? 0), profitForIT);
  const itProfit = profitForIT - pensionGross;

  // ── Gift Aid ─────────────────────────────────────────────────────────────────
  // Gross up net donations by 100/80 (basic rate relief at source = 25%).
  // The gross amount extends the basic rate band and reduces adjusted net income.
  const giftAidGrossPence = Math.round((options?.giftAidNetPence ?? 0) * (100 / 80));

  // ── Adjusted net income ──────────────────────────────────────────────────────
  // Used for: PA taper, HICBC, Marriage Allowance eligibility.
  const adjustedNetIncomePence = Math.max(0, itProfit + otherIncome - giftAidGrossPence);

  const MA_ALLOWANCE_TRANSFER = 126_000; // £1,260 in pence
  const maGiving = options?.marriageAllowance === "giving";
  const maReceiving = options?.marriageAllowance === "receiving";

  // ── Income Tax ──────────────────────────────────────────────────────────────
  // Personal allowance taper (£1 per £2 of ANI over £100,000) and Marriage
  // Allowance (giver) are applied inside, on total income.
  const it = freelanceIncomeTax(
    itProfit,
    otherIncome,
    giftAidGrossPence,
    bands,
    scotland,
    maGiving
  );
  const adjustedPA = it.adjustedPA;
  const itBands: TaxBand[] = it.bands;

  let incomeTaxTotalPence = it.totalPence;

  // ── Marriage Allowance (receiver) ────────────────────────────────────────────
  // Tax reducer of 20% × £1,260 = £252. Applied after band calculation.
  const MA_TAX_REDUCER = Math.round((MA_ALLOWANCE_TRANSFER * 20) / 100); // 25_200 pence
  const marriageAllowancePenceDelta = maReceiving
    ? -MA_TAX_REDUCER // saving (reduces bill)
    : maGiving
      ? MA_TAX_REDUCER // cost (the giver loses their own PA slice)
      : 0;
  if (maReceiving) {
    incomeTaxTotalPence = Math.max(0, incomeTaxTotalPence - MA_TAX_REDUCER);
  }

  // ── Class 4 NI ──────────────────────────────────────────────────────────────
  const niBands: TaxBand[] = [];

  const niLower = bandTax(profit, bands.niLowerPence, bands.niUpperPence, bands.niLowerRatePct);
  if (niLower)
    niBands.push({
      ...niLower,
      label: `Class 4 NI ${bands.niLowerRatePct}% on ${formatBandLabel(bands.niLowerPence, bands.niUpperPence)}`,
    });

  const niUpper = bandTax(profit, bands.niUpperPence, Infinity, bands.niUpperRatePct);
  if (niUpper)
    niBands.push({
      ...niUpper,
      label: `Class 4 NI ${bands.niUpperRatePct}% on ${formatBandLabel(bands.niUpperPence, Infinity)}`,
    });

  const niTotalPence = niBands.reduce((s, b) => s + b.taxPence, 0);

  // ── Pension tax saving ───────────────────────────────────────────────────────
  // Saving = IT that would have been due on the pension contribution amount.
  // Computed as the difference between IT with and without the contribution.
  let pensionTaxSavingPence = 0;
  if (pensionGross > 0) {
    // Baseline IT without the pension deduction (profitForIT, not itProfit)
    let baselineIT = freelanceIncomeTax(
      profitForIT,
      otherIncome,
      giftAidGrossPence,
      bands,
      scotland,
      maGiving
    ).totalPence;
    if (maReceiving) baselineIT = Math.max(0, baselineIT - MA_TAX_REDUCER);
    pensionTaxSavingPence = Math.max(0, baselineIT - incomeTaxTotalPence);
  }

  const totalTaxPence = incomeTaxTotalPence + niTotalPence;
  const effectiveRatePct = profit > 0 ? Math.round((totalTaxPence / profit) * 1000) / 10 : 0;

  // ── Payments on account ──────────────────────────────────────────────────────
  // POAs apply when the bill is ≥ £1,000.  Each is 50 % of this year's bill.
  // Both fall in the year AFTER the tax year ends:
  //   - 1st POA + balancing payment: 31 January (startYear + 2)
  //   - 2nd POA:                     31 July    (startYear + 2)
  const POA_THRESHOLD = 100_000; // £1,000 in pence
  const poaApplies = totalTaxPence >= POA_THRESHOLD;
  const startYear = parseInt(bands.taxYear.slice(0, 4), 10);
  const payYear = startYear + 2;
  const firstPoaPence = Math.round(totalTaxPence / 2);
  const secondPoaPence = totalTaxPence - firstPoaPence;
  // januaryPence = balancing payment (this year's tax) + 1st POA for next year
  const januaryPence = poaApplies ? totalTaxPence + firstPoaPence : totalTaxPence;
  const julyPence = poaApplies ? secondPoaPence : 0;
  const paymentSchedule: PaymentSchedule = {
    poaApplies,
    januaryPence,
    julyPence,
    januaryDate: `31 Jan ${payYear}`,
    julyDate: `31 Jul ${payYear}`,
  };

  // ── Student loan repayments ─────────────────────────────────────────────────
  // Self-employed earners repay via Self Assessment on total gross income
  // (profit + other income) above the plan threshold.
  const totalGross = profit + otherIncome;
  const studentLoanRepayments: StudentLoanRepayment[] = (options?.studentLoanPlans ?? []).map(
    (plan) => {
      const cfg = STUDENT_LOAN_PLANS[plan];
      const repaymentPence = Math.max(
        0,
        Math.round(((totalGross - cfg.thresholdPence) * cfg.ratePct) / 100)
      );
      return {
        plan,
        planLabel: cfg.label,
        thresholdPence: cfg.thresholdPence,
        ratePct: cfg.ratePct,
        repaymentPence,
      };
    }
  );
  const studentLoanTotalPence = studentLoanRepayments.reduce((s, r) => s + r.repaymentPence, 0);

  // ── High Income Child Benefit Charge ─────────────────────────────────────────
  // 1% of Child Benefit for each £200 of ANI above £60,000, capped at 100%
  // at £80,000. Only applies if the user provided a child benefit amount.
  const HICBC_LOWER = 6_000_000; // £60,000
  const HICBC_STEP = 20_000; // £200 per 1%
  const childBenefitPence = options?.childBenefitAnnualPence ?? 0;
  const hicbcPence =
    childBenefitPence > 0 && adjustedNetIncomePence > HICBC_LOWER
      ? Math.round(
          childBenefitPence *
            (Math.min(100, Math.floor((adjustedNetIncomePence - HICBC_LOWER) / HICBC_STEP)) / 100)
        )
      : 0;

  return {
    taxYearLabel: bands.taxYear,
    netProfitPence: rawProfit,
    adjustedPersonalAllowancePence: adjustedPA,
    otherIncomePence: otherIncome,
    scotland,
    incomeTaxBands: itBands,
    incomeTaxTotalPence,
    niBands,
    niTotalPence,
    totalTaxPence,
    effectiveRatePct,
    paymentSchedule,
    studentLoanRepayments,
    studentLoanTotalPence,
    pensionGrossPence: pensionGross,
    pensionTaxSavingPence,
    wfhAllowancePence,
    giftAidGrossPence,
    lossReliefPence,
    adjustedNetIncomePence,
    hicbcPence,
    marriageAllowancePenceDelta,
    totalDeductionsPence: totalTaxPence + studentLoanTotalPence + hicbcPence,
    class2Voluntary:
      profit < bands.smallProfitsThresholdPence
        ? {
            annualPence: bands.class2WeeklyPence * 52,
            weeklyPence: bands.class2WeeklyPence,
            thresholdPence: bands.smallProfitsThresholdPence,
          }
        : null,
  };
}
