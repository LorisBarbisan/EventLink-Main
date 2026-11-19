import { describe, it, expect, vi, afterEach } from "vitest";
import { currentTaxYear } from "./tax-periods";

describe("currentTaxYear uses the UK date", () => {
  afterEach(() => vi.useRealTimers());
  it("00:30 BST on 6 April is already the new tax year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T23:30:00Z"));
    expect(currentTaxYear().label).toBe("2026/27");
  });
  it("23:30 BST on 5 April is still the old one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T22:30:00Z"));
    expect(currentTaxYear().label).toBe("2025/26");
  });
});
