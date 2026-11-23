import { describe, expect, it } from "vitest";
import { countryFilterValues } from "./country-filter";

describe("countryFilterValues", () => {
  it("counts blank countries and other UK spellings under the UK", () => {
    const uk = countryFilterValues("United Kingdom");
    expect(uk.includeBlank).toBe(true);
    for (const v of ["united kingdom", "uk", "gb", "england", "scotland", "wales"]) {
      expect(uk.values).toContain(v);
    }
    expect(countryFilterValues(" uk ").includeBlank).toBe(true);
  });

  it("matches other countries exactly, ignoring case, and never includes blanks", () => {
    expect(countryFilterValues("Ireland")).toEqual({ values: ["ireland"], includeBlank: false });
    expect(countryFilterValues(" Germany ").values).toEqual(["germany"]);
  });
});
