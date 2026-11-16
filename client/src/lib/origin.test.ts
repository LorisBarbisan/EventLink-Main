import { describe, it, expect } from "vitest";
import { originOf, matchesOrigin } from "./origin";

describe("originOf", () => {
  it("treats anything linked to a booking as EventLink work", () => {
    expect(originOf({ source: "booking", booking_id: 3 })).toBe("eventlink");
    expect(originOf({ source: "manual", booking_id: 3 })).toBe("eventlink");
    expect(originOf({ source: "imported", booking_id: 3 })).toBe("eventlink");
  });

  it("labels imports and everything else", () => {
    expect(originOf({ source: "imported", booking_id: null })).toBe("imported");
    expect(originOf({ source: "manual", booking_id: null })).toBe("mine");
    expect(originOf({ source: "invoice" })).toBe("mine");
    expect(originOf({ source: "receipt" })).toBe("mine");
  });

  it("filters", () => {
    expect(matchesOrigin({ source: "imported" }, "all")).toBe(true);
    expect(matchesOrigin({ source: "imported" }, "mine")).toBe(false);
  });
});
