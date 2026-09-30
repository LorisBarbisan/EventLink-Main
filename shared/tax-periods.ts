/**
 * UK tax year and MTD Income Tax quarter utilities.
 *
 * Tax year runs 6 April to 5 April.
 * MTD quarters: 6 Apr–5 Jul | 6 Jul–5 Oct | 6 Oct–5 Jan | 6 Jan–5 Apr
 *
 * All functions accept and return ISO date strings (YYYY-MM-DD).
 */

export interface DateRange {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

export interface TaxYear extends DateRange {
  label: string; // e.g. "2026/27"
  year: number; // the year in which the tax year starts (April), e.g. 2026
}

export interface TaxQuarter extends DateRange {
  label: string; // e.g. "Q1 2026/27"
  taxYear: number;
  quarter: 1 | 2 | 3 | 4;
}

/** ISO date string for 6 April of the given year. */
function apr6(year: number): string {
  return `${year}-04-06`;
}

/** ISO date string for 5 April of the given year. */
function apr5(year: number): string {
  return `${year}-04-05`;
}

/**
 * Return the tax year that contains the given date.
 * A date of 2026-04-05 is in 2025/26; 2026-04-06 is in 2026/27.
 */
export function taxYearForDate(isoDate: string): TaxYear {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Before 6 April → prior tax year
  const startYear = m < 4 || (m === 4 && d < 6) ? y - 1 : y;
  return taxYearFromStart(startYear);
}

/** Build a TaxYear from its start year (the April that opens it). */
export function taxYearFromStart(startYear: number): TaxYear {
  return {
    from: apr6(startYear),
    to: apr5(startYear + 1),
    label: `${startYear}/${String(startYear + 1).slice(2)}`,
    year: startYear,
  };
}

/**
 * Return the current UK tax year based on today's date.
 * Useful for default date ranges in the UI.
 */
export function currentTaxYear(): TaxYear {
  return taxYearForDate(new Date().toISOString().slice(0, 10));
}

/**
 * Return all four MTD quarters for a given tax year start.
 * Q1: 6 Apr – 5 Jul
 * Q2: 6 Jul – 5 Oct
 * Q3: 6 Oct – 5 Jan (crosses calendar year)
 * Q4: 6 Jan – 5 Apr
 */
export function taxQuarters(startYear: number): TaxQuarter[] {
  const label = `${startYear}/${String(startYear + 1).slice(2)}`;
  return [
    {
      quarter: 1,
      label: `Q1 ${label}`,
      taxYear: startYear,
      from: `${startYear}-04-06`,
      to: `${startYear}-07-05`,
    },
    {
      quarter: 2,
      label: `Q2 ${label}`,
      taxYear: startYear,
      from: `${startYear}-07-06`,
      to: `${startYear}-10-05`,
    },
    {
      quarter: 3,
      label: `Q3 ${label}`,
      taxYear: startYear,
      from: `${startYear}-10-06`,
      to: `${startYear + 1}-01-05`,
    },
    {
      quarter: 4,
      label: `Q4 ${label}`,
      taxYear: startYear,
      from: `${startYear + 1}-01-06`,
      to: `${startYear + 1}-04-05`,
    },
  ];
}

/** Return the MTD quarter that contains the given date. */
export function taxQuarterForDate(isoDate: string): TaxQuarter {
  const ty = taxYearForDate(isoDate);
  const quarters = taxQuarters(ty.year);
  return quarters.find((q) => isoDate >= q.from && isoDate <= q.to)!;
}

/**
 * Return whether a date falls within the given date range (inclusive).
 */
export function inRange(isoDate: string, range: DateRange): boolean {
  return isoDate >= range.from && isoDate <= range.to;
}

/**
 * Given a basis and an earnings entry's dates, return the date used for
 * reporting: paid_date on cash basis, invoiced_date (falling back to
 * work_date) on accruals.
 */
export function reportingDate(
  basis: "cash" | "accruals",
  dates: { work_date: string; invoiced_date?: string | null; paid_date?: string | null }
): string | null {
  if (basis === "cash") {
    return dates.paid_date ?? null;
  }
  return dates.invoiced_date ?? dates.work_date;
}
