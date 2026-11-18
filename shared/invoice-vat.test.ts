import { describe, it, expect } from "vitest";
import { invoiceTotals, netOfInvoice } from "./invoice-vat";

describe("invoiceTotals", () => {
  it("not registered: no VAT", () => {
    expect(invoiceTotals(100_000, { vat_registered: false, vat_rate_pct: 20 })).toEqual({
      vat_pence: 0,
      total_pence: 100_000,
      rate: null,
    });
  });

  it("£1,000 net at 20% = £200 VAT, £1,200 total", () => {
    expect(invoiceTotals(100_000, { vat_registered: true, vat_rate_pct: 20 })).toEqual({
      vat_pence: 20_000,
      total_pence: 120_000,
      rate: 20,
    });
  });

  it("£333.33 at 5% rounds to the penny: £16.67", () => {
    expect(invoiceTotals(33_333, { vat_registered: true, vat_rate_pct: 5 }).vat_pence).toBe(1_667);
  });

  it("zero-rated: registered, 0% charged", () => {
    expect(invoiceTotals(50_000, { vat_registered: true, vat_rate_pct: 0 })).toEqual({
      vat_pence: 0,
      total_pence: 50_000,
      rate: 0,
    });
  });

  it("registered with no rate saved yet defaults to 20%", () => {
    expect(invoiceTotals(10_000, { vat_registered: true }).vat_pence).toBe(2_000);
  });
});

describe("netOfInvoice", () => {
  const inv = { subtotal_pence: 100_000, total_pence: 120_000 };
  it("full payment records the net amount", () => {
    expect(netOfInvoice(inv, 120_000)).toBe(100_000);
    expect(netOfInvoice(inv, null)).toBe(100_000);
  });
  it("part payment is split pro rata", () => {
    expect(netOfInvoice(inv, 60_000)).toBe(50_000);
  });
  it("no VAT: unchanged", () => {
    expect(netOfInvoice({ subtotal_pence: 500, total_pence: 500 }, 400)).toBe(400);
  });
});
