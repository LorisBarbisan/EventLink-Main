import { describe, expect, it } from "vitest";
import { filterOptions, matchesSearch } from "./search";

const jobs = [
  {
    label: "Rigger — ExCeL London",
    sublabel: "Stage One Productions · 12 Nov 2026",
    keywords: ["INV-0119"],
  },
  { label: "Lighting tech", sublabel: "Smith Events · 3 Dec 2026", keywords: ["J-204", null] },
  { label: "Rigger — O2", sublabel: "Stage One Productions · 1 Oct 2026", keywords: [] },
];

describe("matchesSearch", () => {
  it("matches a reference by substring, not prefix", () => {
    expect(matchesSearch(jobs[0], "0119")).toBe(true);
    expect(matchesSearch(jobs[0], "119")).toBe(true);
  });

  it("is case-insensitive across label and sublabel", () => {
    expect(matchesSearch(jobs[0], "excel")).toBe(true);
    expect(matchesSearch(jobs[1], "SMITH")).toBe(true);
  });

  it("requires every term, which may sit in different fields", () => {
    expect(matchesSearch(jobs[0], "rigger stage")).toBe(true);
    expect(matchesSearch(jobs[2], "rigger excel")).toBe(false);
  });

  it("treats an empty or blank query as a match", () => {
    expect(matchesSearch(jobs[1], "")).toBe(true);
    expect(matchesSearch(jobs[1], "   ")).toBe(true);
  });

  it("ignores null keywords", () => {
    expect(matchesSearch(jobs[1], "null")).toBe(false);
  });
});

describe("filterOptions", () => {
  it("narrows without reordering", () => {
    expect(filterOptions(jobs, "rigger").map((j) => j.label)).toEqual([
      "Rigger — ExCeL London",
      "Rigger — O2",
    ]);
  });

  it("returns the same list for a blank query", () => {
    expect(filterOptions(jobs, " ")).toBe(jobs);
  });
});
