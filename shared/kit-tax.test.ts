import { describe, it, expect } from "vitest";
import { kitExpenseOffer, kitDisposalOffer, type KitTaxFields } from "./kit-tax";

const desk: KitTaxFields = {
  category: "other",
  funding_method: "purchased",
  purchase_date: "2026-06-14",
  purchase_price_pence: 200000,
  expense_id: null,
  expense_prompt_dismissed: false,
  status: "in_service",
  disposal_date: null,
  disposal_proceeds_pence: null,
  disposal_entry_id: null,
};

describe("kitExpenseOffer", () => {
  it("offers a bought item with a price and date", () => {
    expect(kitExpenseOffer(desk)).toBe("offer");
  });

  it("offers it once: declining or linking stops the offer", () => {
    expect(kitExpenseOffer({ ...desk, expense_prompt_dismissed: true })).toBe("none");
    expect(kitExpenseOffer({ ...desk, expense_id: 12 })).toBe("linked");
  });

  it("needs a price and a purchase date, and only for purchased kit", () => {
    expect(kitExpenseOffer({ ...desk, purchase_price_pence: null })).toBe("none");
    expect(kitExpenseOffer({ ...desk, purchase_date: null })).toBe("none");
    expect(kitExpenseOffer({ ...desk, funding_method: "gift" })).toBe("none");
  });

  // Vehicles go through capital allowances. Offering one as an ordinary
  // expense would produce a materially wrong return.
  it("never offers a vehicle as an expense", () => {
    const van = { ...desk, category: "vehicle", purchase_price_pence: 1800000 };
    expect(kitExpenseOffer(van)).toBe("vehicle");
    expect(kitExpenseOffer({ ...van, expense_prompt_dismissed: true })).toBe("vehicle");
  });
});

describe("kitDisposalOffer", () => {
  const sold = {
    ...desk,
    status: "sold",
    disposal_date: "2026-11-01",
    disposal_proceeds_pence: 15000,
  };

  it("stops offering once answered 'already recorded'", () => {
    expect(kitDisposalOffer({ ...sold, disposal_prompt_dismissed: true })).toBe("none");
  });

  it("offers proceeds from a sale as income", () => {
    expect(kitDisposalOffer(sold)).toBe("offer");
    expect(kitDisposalOffer({ ...sold, disposal_entry_id: 9 })).toBe("linked");
  });

  it("does nothing without proceeds, or while in service", () => {
    expect(kitDisposalOffer({ ...sold, disposal_proceeds_pence: 0 })).toBe("none");
    expect(kitDisposalOffer({ ...sold, status: "in_service" })).toBe("none");
  });

  it("never offers a vehicle sale as ordinary income", () => {
    expect(kitDisposalOffer({ ...sold, category: "vehicle" })).toBe("vehicle");
  });
});
