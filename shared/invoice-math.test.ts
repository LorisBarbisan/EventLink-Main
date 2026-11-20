import { describe, it, expect } from "vitest";
import { invoiceAmounts, lineTotalPence, roundPence } from "./invoice-math";

// Hand-worked cases, asserted in pence.
const noVat = { vat_registered: false };
const vat20 = { vat_registered: true, vat_rate_pct: 20 };
const vat0 = { vat_registered: true, vat_rate_pct: 0 };

describe("invoice arithmetic", () => {
  it("three lines whose unrounded sum rounds differently: total = sum of printed lines", () => {
    // 1.5 × £3.33 = 499.5p → 500p, three times. Unrounded sum 1498.5 → 1499p;
    // the invoice must say 1500p, because that is what its lines add up to.
    const r = invoiceAmounts(
      [
        { quantity: 1.5, unit_price_pence: 333 },
        { quantity: 1.5, unit_price_pence: 333 },
        { quantity: 1.5, unit_price_pence: 333 },
      ],
      noVat
    );
    expect(r.lines.map((l) => l.total_pence)).toEqual([500, 500, 500]);
    expect(r.subtotal_pence).toBe(1500);
    expect(r.total_pence).toBe(1500);
  });

  it("20% VAT on two days at £350 plus 3.5h overtime at £52.50", () => {
    // 2 × 35000 = 70000; 3.5 × 5250 = 18375; subtotal 88375;
    // VAT 17675 (17675.0); total 106050
    const r = invoiceAmounts(
      [
        { quantity: 2, unit_price_pence: 35000, rate_type: "day" },
        { quantity: 3.5, unit_price_pence: 5250, rate_type: "ot" },
      ],
      vat20
    );
    expect(r.subtotal_pence).toBe(88375);
    expect(r.vat_pence).toBe(17675);
    expect(r.total_pence).toBe(106050);
  });

  it("VAT rounds once, on the subtotal", () => {
    // subtotal 1001p → VAT 200.2 → 200p
    const r = invoiceAmounts([{ quantity: 1, unit_price_pence: 1001 }], vat20);
    expect(r.vat_pence).toBe(200);
    expect(r.total_pence).toBe(1201);
  });

  it("zero-rated: registered, no VAT added", () => {
    const r = invoiceAmounts([{ quantity: 1, unit_price_pence: 50000 }], vat0);
    expect(r.vat_pence).toBe(0);
    expect(r.total_pence).toBe(50000);
  });

  it("a discount or correction line reduces the total, rounding away from zero", () => {
    const r = invoiceAmounts(
      [
        { quantity: 1, unit_price_pence: 30000 },
        { quantity: 1.5, unit_price_pence: -333 }, // −499.5p → −500p
      ],
      noVat
    );
    expect(r.lines[1].total_pence).toBe(-500);
    expect(r.subtotal_pence).toBe(29500);
  });

  it("strings from a form are numbers; nonsense is zero", () => {
    expect(lineTotalPence("2", "1250")).toBe(2500);
    expect(lineTotalPence("x", 100)).toBe(0);
    expect(roundPence(-0.5)).toBe(-1);
    expect(roundPence(0.5)).toBe(1);
  });
});
