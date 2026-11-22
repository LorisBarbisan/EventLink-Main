import { describe, expect, it } from "vitest";
import {
  businessIdErrors,
  companyNumberError,
  normaliseCompanyNumber,
  normaliseUtr,
  normaliseVatNumber,
  utrError,
  vatNumberError,
} from "./business-ids";

describe("UTR", () => {
  it("accepts 10 digits, with spaces or HMRC's trailing K", () => {
    expect(utrError("1234567890")).toBeNull();
    expect(utrError("12345 67890")).toBeNull();
    expect(normaliseUtr("12345 67890k")).toBe("1234567890");
  });

  it("rejects the wrong length or letters", () => {
    expect(utrError("12345678")).toMatch(/10 digits/); // the eight-digit one QA found
    expect(utrError("123456789012")).not.toBeNull();
    expect(utrError("12345A7890")).not.toBeNull();
  });

  it("treats blank as not given", () => {
    expect(utrError("")).toBeNull();
    expect(utrError("   ")).toBeNull();
    expect(normaliseUtr(" ")).toBeNull();
  });
});

describe("VAT number", () => {
  it("accepts GB and XI, branch and government forms", () => {
    for (const v of [
      "GB123456789",
      "gb 123 4567 89",
      "XI123456789",
      "GB123456789012",
      "GBGD001",
      "GBHA599",
    ])
      expect(vatNumberError(v), v).toBeNull();
  });

  it("adds GB to a bare 9 digits", () => {
    expect(normaliseVatNumber("123 456 789")).toBe("GB123456789");
  });

  it("rejects other shapes, including a company number", () => {
    for (const v of ["GB12345678", "FR12345678901", "01234567", "SC123456"])
      expect(vatNumberError(v), v).not.toBeNull();
  });
});

describe("company number", () => {
  it("accepts 8 digits or a two-letter prefix and 6 digits", () => {
    for (const v of ["01234567", "SC123456", "ni012345", "OC301234"])
      expect(companyNumberError(v), v).toBeNull();
  });

  it("pads a number typed without its leading zeros", () => {
    expect(normaliseCompanyNumber("1234567")).toBe("01234567");
  });

  it("rejects a VAT number in the company field, and other shapes", () => {
    for (const v of ["GB123456789", "123456789", "SC12345", "ABC12345"])
      expect(companyNumberError(v), v).not.toBeNull();
  });
});

describe("businessIdErrors", () => {
  it("names only the fields that are wrong", () => {
    expect(
      businessIdErrors({ utr: "12345678", company_number: "01234567", vat_number: null })
    ).toEqual({
      utr: "A UTR is 10 digits.",
    });
    expect(businessIdErrors({})).toEqual({});
  });
});
