import { describe, it, expect } from "vitest";
import { fillsLastPosition, hireRefusal } from "./hiring";

describe("hireRefusal", () => {
  it("one-position job: the first hire is allowed, the second refused", () => {
    expect(hireRefusal({ status: "active", positions: 1 }, 0)).toBeNull();
    expect(hireRefusal({ status: "active", positions: 1 }, 1)).toBe("fully_crewed");
  });
  it("a closed job refuses even with positions left", () => {
    expect(hireRefusal({ status: "closed", positions: 5 }, 3)).toBe("job_closed");
  });
  it("a completed job refuses too", () => {
    expect(hireRefusal({ status: "completed", positions: 5 }, 1)).toBe("job_closed");
  });
  it("a private (invite-only) job can still hire", () => {
    expect(hireRefusal({ status: "private", positions: 2 }, 1)).toBeNull();
  });
  it("a bad positions value is treated as one", () => {
    expect(hireRefusal({ status: "active", positions: 0 }, 1)).toBe("fully_crewed");
  });
});

describe("fillsLastPosition", () => {
  it("closes on the fifth of five, not before", () => {
    expect(fillsLastPosition(5, 4)).toBe(false);
    expect(fillsLastPosition(5, 5)).toBe(true);
  });
});
