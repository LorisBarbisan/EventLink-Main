import { describe, it, expect } from "vitest";
import { escapeCell, buildCsv, penceToCsvDecimal, dateToCsvDate } from "./csv";

const BOM = "﻿";
const CRLF = "\r\n";

describe("escapeCell", () => {
  it("plain strings pass through unchanged", () => {
    expect(escapeCell("hello")).toBe("hello");
    expect(escapeCell("Sound Engineer")).toBe("Sound Engineer");
  });

  it("empty / null / undefined → empty string", () => {
    expect(escapeCell("")).toBe("");
    expect(escapeCell(null)).toBe("");
    expect(escapeCell(undefined)).toBe("");
  });

  it("wraps fields containing a comma", () => {
    expect(escapeCell("O'Brien, Sound & Light Ltd")).toBe('"O\'Brien, Sound & Light Ltd"');
  });

  it("doubles embedded double-quotes", () => {
    expect(escapeCell('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("wraps fields containing a newline", () => {
    expect(escapeCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("formula injection guard — = prefix", () => {
    expect(escapeCell("=SUM(A1)")).toBe("'=SUM(A1)");
  });

  it("formula injection guard — + prefix", () => {
    expect(escapeCell("+44 7700")).toBe("'+44 7700");
  });

  it("formula injection guard — - prefix (e.g. negative-looking text)", () => {
    expect(escapeCell("-ACME Ltd")).toBe("'-ACME Ltd");
  });

  it("formula injection guard — @ prefix", () => {
    expect(escapeCell("@user")).toBe("'@user");
  });

  it("a field beginning = that also contains a comma is both guarded and quoted", () => {
    const result = escapeCell("=cmd|calc,arg");
    expect(result.startsWith('"')).toBe(true);
    expect(result).toContain("'=cmd|calc,arg");
  });

  it("numbers are converted to strings", () => {
    expect(escapeCell(42)).toBe("42");
    expect(escapeCell(0)).toBe("0");
  });

  it("apostrophe in a client name is NOT treated as injection (only leading - matters for the guard)", () => {
    expect(escapeCell("O'Brien")).toBe("O'Brien");
  });
});

describe("buildCsv", () => {
  it("produces BOM + header + CRLF + rows + trailing CRLF", () => {
    const csv = buildCsv({
      headers: ["Date", "Description", "Amount"],
      rows: [["2026-04-06", "Sound gig", "450.00"]],
    });
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).split(CRLF);
    expect(lines[0]).toBe("Date,Description,Amount");
    expect(lines[1]).toBe("2026-04-06,Sound gig,450.00");
    // trailing CRLF means last element after split is empty
    expect(lines[lines.length - 1]).toBe("");
  });

  it("empty rows → just the header line", () => {
    const csv = buildCsv({ headers: ["A", "B"], rows: [] });
    const lines = csv.slice(1).split(CRLF);
    expect(lines[0]).toBe("A,B");
    // trailing newline only
    expect(lines.slice(1).join("")).toBe("");
  });

  it("accented characters survive (Théâtre Royal)", () => {
    const csv = buildCsv({
      headers: ["Venue"],
      rows: [["Théâtre Royal"]],
    });
    expect(csv).toContain("Théâtre Royal");
  });
});

describe("penceToCsvDecimal", () => {
  it("converts positive pence to decimal", () => {
    expect(penceToCsvDecimal(45000)).toBe("450.00");
    expect(penceToCsvDecimal(100)).toBe("1.00");
    expect(penceToCsvDecimal(1)).toBe("0.01");
    expect(penceToCsvDecimal(123456)).toBe("1234.56");
  });

  it("zero → 0.00", () => {
    expect(penceToCsvDecimal(0)).toBe("0.00");
  });

  it("negative pence → leading minus, no parentheses", () => {
    expect(penceToCsvDecimal(-5000)).toBe("-50.00");
  });

  it("null / undefined → empty string", () => {
    expect(penceToCsvDecimal(null)).toBe("");
    expect(penceToCsvDecimal(undefined)).toBe("");
  });

  it("no thousands separator, no currency symbol", () => {
    const result = penceToCsvDecimal(1000000);
    expect(result).not.toContain(",");
    expect(result).not.toContain("£");
    expect(result).toBe("10000.00");
  });
});

describe("dateToCsvDate", () => {
  it("ISO string → YYYY-MM-DD", () => {
    expect(dateToCsvDate("2026-04-06T00:00:00.000Z")).toBe("2026-04-06");
    expect(dateToCsvDate("2026-04-06")).toBe("2026-04-06");
  });

  it("Date object → YYYY-MM-DD", () => {
    expect(dateToCsvDate(new Date("2026-04-06T00:00:00Z"))).toBe("2026-04-06");
  });

  it("null / undefined → empty string", () => {
    expect(dateToCsvDate(null)).toBe("");
    expect(dateToCsvDate(undefined)).toBe("");
  });
});
