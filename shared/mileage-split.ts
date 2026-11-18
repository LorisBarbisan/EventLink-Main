/**
 * Prices a whole tax year of trips for one vehicle type against the annual
 * threshold (cars: first 10,000 miles at 55p, the rest at 25p).
 *
 * Each trip's split depends on the miles logged before it, so adding,
 * editing or removing any trip can move the threshold for every later one.
 * Pricing the year in one pass, in date order, is the only way to keep the
 * total right when trips are entered out of order.
 */
export interface PricedTripInput {
  id: number;
  trip_date: string;
  miles: number;
  rate_pence: number;
  rate_above_pence: number | null;
}

/** Returns the correct amount_pence for every trip, keyed by id. */
export function priceTaxYear(
  trips: PricedTripInput[],
  thresholdMiles: number | null
): Map<number, number> {
  const sorted = [...trips].sort((a, b) =>
    a.trip_date === b.trip_date ? a.id - b.id : a.trip_date < b.trip_date ? -1 : 1
  );
  const out = new Map<number, number>();
  let ytd = 0;
  for (const t of sorted) {
    if (!thresholdMiles || t.rate_above_pence == null) {
      out.set(t.id, Math.round(t.miles * t.rate_pence));
    } else {
      const below = Math.max(0, Math.min(t.miles, thresholdMiles - ytd));
      const above = t.miles - below;
      out.set(t.id, Math.round(below * t.rate_pence + above * t.rate_above_pence));
    }
    ytd += t.miles;
  }
  return out;
}
