import { describe, it, expect } from "vitest";
import { isUkCountry, isCountryUnset } from "./uk-country";

describe("uk-country", () => {
  it("recognises UK variants", () => {
    expect(isUkCountry("United Kingdom")).toBe(true);
    expect(isUkCountry(" scotland ")).toBe(true);
    expect(isUkCountry("Ireland")).toBe(false);
  });

  it("treats an empty or blank country as unanswered, like a missing one", () => {
    expect(isCountryUnset(null)).toBe(true);
    expect(isCountryUnset(undefined)).toBe(true);
    expect(isCountryUnset("")).toBe(true);
    expect(isCountryUnset("  ")).toBe(true);
    expect(isCountryUnset("France")).toBe(false);
  });
});
