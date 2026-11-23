import { describe, expect, it } from "vitest";
import { columnTotal, type ColSpec } from "./xlsx";

describe("columnTotal", () => {
  it("rounds money totals to whole pence, not 414.71999999999997", () => {
    const col: ColSpec = { header: "Box 4", type: "money", total: true };
    const rows = [[127.53], [143.39], [143.8]];
    expect(127.53 + 143.39 + 143.8).not.toBe(414.72); // the noise this removes
    expect(columnTotal(col, rows, 0)).toBe(414.72);
    expect(columnTotal(col, [[-127.53], [-143.39], [-143.8]], 0)).toBe(-414.72);
  });

  it("skips blanks and text, and keeps fractional miles", () => {
    const col: ColSpec = { header: "Miles", type: "number", total: true };
    expect(columnTotal(col, [[12.4], [null], ["n/a"], [0.35]], 0)).toBe(12.75);
  });
});
