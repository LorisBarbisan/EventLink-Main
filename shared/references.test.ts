import { describe, it, expect } from "vitest";
import { NON_PUBLIC_BADGE_RESULTS, isPublicReference } from "./references";

describe("isPublicReference", () => {
  it("withholds a verified_private reference", () => {
    // Referee rated the work mixed, or unlikely to work together again.
    expect(isPublicReference({ is_flagged: false, badge_result: "verified_private" })).toBe(false);
  });

  it("withholds a flagged reference", () => {
    expect(isPublicReference({ is_flagged: true, badge_result: "flagged" })).toBe(false);
  });

  it("withholds a reference flagged by fraud checks even with a positive badge", () => {
    // is_flagged can be set independently of badge_result (fraud flags).
    expect(isPublicReference({ is_flagged: true, badge_result: "recommended" })).toBe(false);
  });

  it("withholds a reference with no computed badge", () => {
    expect(isPublicReference({ is_flagged: false, badge_result: null })).toBe(false);
    expect(isPublicReference({ is_flagged: false })).toBe(false);
  });

  it("publishes the positive badges", () => {
    for (const badge of ["highly_recommended", "recommended", "work_history_confirmed"]) {
      expect(isPublicReference({ is_flagged: false, badge_result: badge })).toBe(true);
    }
  });
});

describe("NON_PUBLIC_BADGE_RESULTS", () => {
  it("excludes both flagged and verified_private", () => {
    expect(NON_PUBLIC_BADGE_RESULTS).toContain("flagged");
    expect(NON_PUBLIC_BADGE_RESULTS).toContain("verified_private");
  });

  it("does not withhold any of the positive badges", () => {
    const set = NON_PUBLIC_BADGE_RESULTS as readonly string[];
    expect(set).not.toContain("highly_recommended");
    expect(set).not.toContain("recommended");
    expect(set).not.toContain("work_history_confirmed");
  });
});
