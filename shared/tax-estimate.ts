/**
 * UK self-assessment tax estimate for sole traders / freelancers.
 *
 * Covers Income Tax and Class 4 National Insurance only.
 * Class 2 NI was abolished for 2024/25 onwards.
 * Figures are for the 2024/25 tax year; update `BANDS` for future years.
 *
 * All monetary values are integer pence.
 */

export interface TaxBands {
  taxYear: string; // e.g. "2024/25"
  personalAllowancePence: number;
  basicRatePence: number; // upper limit of basic rate band
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
}

/** 2024/25 rates — update each April */
export const BANDS_2024_25: TaxBands = {
  taxYear: "2024/25",
  personalAllowancePence: 1_257_000, // £12,570
  basicRatePence: 5_027_000, // £50,270
  higherRatePence: 12_514_000, // £125,140
  basicRatePct: 20,
  higherRatePct: 40,
  additionalRatePct: 45,
  niLowerPence: 1_257_000, // £12,570
  niUpperPence: 5_027_000, // £50,270
  niLowerRatePct: 6,
  niUpperRatePct: 2,
};

/** 2025/26 — same rates as 2024/25 (thresholds frozen) */
export const BANDS_2025_26: TaxBands = {
  ...BANDS_2024_25,
  taxYear: "2025/26",
};

/** 2026/27 — same rates (thresholds still frozen per current policy) */
export const BANDS_2026_27: TaxBands = {
  ...BANDS_2024_25,
  taxYear: "2026/27",
};

const ALL_BANDS: TaxBands[] = [BANDS_2024_25, BANDS_2025_26, BANDS_2026_27];

/** Pick the best matching bands for a tax year label, falling back to latest. */
export function bandsForTaxYear(label: string): TaxBands {
  return ALL_BANDS.find((b) => b.taxYear === label) ?? BANDS_2026_27;
}

export interface TaxBand {
  label: string;
  ratePct: number;
  onPence: number; // the slice of profit this band applies to
  taxPence: number;
}

export interface TaxEstimate {
  taxYearLabel: string;
  netProfitPence: number;
  /** Income Tax */
  incomeTaxBands: TaxBand[];
  incomeTaxTotalPence: number;
  /** Class 4 NI */
  niBands: TaxBand[];
  niTotalPence: number;
  /** Combined */
  totalTaxPence: number;
  effectiveRatePct: number; // rounded to 1 dp
}

function bandTax(profit: number, lower: number, upper: number, ratePct: number): TaxBand | null {
  if (profit <= lower) return null;
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

export function estimateTax(netProfitPence: number, bands: TaxBands): TaxEstimate {
  const profit = Math.max(0, netProfitPence);

  // ── Income Tax ──────────────────────────────────────────────────────────────
  const itBands: TaxBand[] = [];

  const basic = bandTax(
    profit,
    bands.personalAllowancePence,
    bands.basicRatePence,
    bands.basicRatePct
  );
  if (basic) itBands.push(basic);

  const higher = bandTax(profit, bands.basicRatePence, bands.higherRatePence, bands.higherRatePct);
  if (higher) itBands.push(higher);

  const additional = bandTax(profit, bands.higherRatePence, Infinity, bands.additionalRatePct);
  if (additional) itBands.push(additional);

  const incomeTaxTotalPence = itBands.reduce((s, b) => s + b.taxPence, 0);

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

  const totalTaxPence = incomeTaxTotalPence + niTotalPence;
  const effectiveRatePct = profit > 0 ? Math.round((totalTaxPence / profit) * 1000) / 10 : 0;

  return {
    taxYearLabel: bands.taxYear,
    netProfitPence: profit,
    incomeTaxBands: itBands,
    incomeTaxTotalPence,
    niBands,
    niTotalPence,
    totalTaxPence,
    effectiveRatePct,
  };
}
