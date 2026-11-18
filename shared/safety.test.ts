import { describe, it, expect } from "vitest";
import { isReportCategory, messagingAllowed } from "./safety";

describe("messagingAllowed", () => {
  it("no block: allowed", () => {
    expect(messagingAllowed({ blocked: false, activeBooking: false })).toBe(true);
  });
  it("blocked: stopped", () => {
    expect(messagingAllowed({ blocked: true, activeBooking: false })).toBe(false);
  });
  it("blocked but an active booking: the job's messages still get through", () => {
    expect(messagingAllowed({ blocked: true, activeBooking: true })).toBe(true);
  });
});

describe("report categories", () => {
  it("accepts only the fixed list", () => {
    expect(isReportCategory("credentials_mismatch")).toBe(true);
    expect(isReportCategory("anything")).toBe(false);
  });
});
