import { describe, it, expect } from "vitest";
import { matchesDeclaredType } from "./file-signature";
import { tokensMatch } from "./token-compare";

describe("matchesDeclaredType", () => {
  it("accepts real PDF, PNG and JPEG headers", () => {
    expect(matchesDeclaredType(Buffer.from("%PDF-1.7\n"), "application/pdf")).toBe(true);
    expect(
      matchesDeclaredType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
        "image/png"
      )
    ).toBe(true);
    expect(matchesDeclaredType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
  });

  it("refuses HTML declared as a PDF, and unknown types", () => {
    expect(matchesDeclaredType(Buffer.from("<html><script>"), "application/pdf")).toBe(false);
    expect(matchesDeclaredType(Buffer.from("%PDF"), "text/html")).toBe(false);
  });
});

describe("tokensMatch", () => {
  it("fails closed when either token is missing", () => {
    expect(tokensMatch(null, "abc")).toBe(false);
    expect(tokensMatch("abc", null)).toBe(false);
    expect(tokensMatch("", "")).toBe(false);
  });
  it("matches only identical tokens", () => {
    expect(tokensMatch("abc", "abc")).toBe(true);
    expect(tokensMatch("abd", "abc")).toBe(false);
    expect(tokensMatch("ab", "abc")).toBe(false);
  });
});
