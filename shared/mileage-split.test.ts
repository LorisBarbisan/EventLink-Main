import { describe, it, expect } from "vitest";
import { priceTaxYear, type PricedTripInput } from "./mileage-split";

const car = (id: number, trip_date: string, miles: number): PricedTripInput => ({
  id,
  trip_date,
  miles,
  rate_pence: 55,
  rate_above_pence: 25,
});
const total = (m: Map<number, number>) => [...m.values()].reduce((s, v) => s + v, 0);

// Known answers: 2026/27 car rates, 55p for the first 10,000 miles, 25p after.
describe("priceTaxYear", () => {
  const inOrder = [
    car(1, "2026-05-01", 4_000),
    car(2, "2026-08-01", 4_000),
    car(3, "2026-12-01", 2_500),
  ];

  it("10,500 miles logged in order: 10,000 × 55p + 500 × 25p = £5,625", () => {
    expect(total(priceTaxYear(inOrder, 10_000))).toBe(562_500);
  });

  it("a backdated 800-mile May trip: 10,000 × 55p + 1,300 × 25p = £5,825", () => {
    const m = priceTaxYear([...inOrder, car(4, "2026-05-15", 800)], 10_000);
    expect(total(m)).toBe(582_500);
    // the May trip is wholly under the threshold; the December trip carries 1,300 at 25p
    expect(m.get(4)).toBe(44_000);
    expect(m.get(3)).toBe(1_200 * 55 + 1_300 * 25);
  });

  it("removing an early trip moves later trips back under the threshold", () => {
    const m = priceTaxYear(inOrder.slice(1), 10_000);
    expect(total(m)).toBe(6_500 * 55);
  });

  it("same-day trips are ordered by id", () => {
    const m = priceTaxYear([car(2, "2026-06-01", 500), car(1, "2026-06-01", 9_800)], 10_000);
    expect(m.get(1)).toBe(9_800 * 55);
    expect(m.get(2)).toBe(200 * 55 + 300 * 25);
  });

  it("no threshold (motorcycle, bicycle): flat rate", () => {
    const bike = {
      id: 1,
      trip_date: "2026-06-01",
      miles: 20_000,
      rate_pence: 24,
      rate_above_pence: null,
    };
    expect(total(priceTaxYear([bike], null))).toBe(480_000);
  });
});
