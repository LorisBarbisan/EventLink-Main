import { describe, expect, it } from "vitest";
import { profileFont, PROFILE_FONTS } from "./profile-fonts";
import { DEFAULT_SECTIONS, reconcileSectionOrder } from "./profile-sections";

describe("reconcileSectionOrder", () => {
  it("uses the default order when nothing is stored", () => {
    expect(reconcileSectionOrder(undefined)).toEqual([...DEFAULT_SECTIONS]);
    expect(reconcileSectionOrder(null)).toEqual([...DEFAULT_SECTIONS]);
    expect(reconcileSectionOrder([])).toEqual([...DEFAULT_SECTIONS]);
  });

  it("keeps an old four-item order and appends calendar, so a save can't drop it", () => {
    expect(reconcileSectionOrder(["contacts", "about", "references", "documents"])).toEqual([
      "contacts",
      "about",
      "references",
      "documents",
      "calendar",
    ]);
  });

  it("keeps calendar where the freelancer put it", () => {
    expect(
      reconcileSectionOrder(["about", "calendar", "references", "documents", "contacts"])
    ).toEqual(["about", "calendar", "references", "documents", "contacts"]);
  });

  it("drops unknown and duplicate entries", () => {
    expect(reconcileSectionOrder(["about", "files", "about", 7, "calendar"])).toEqual([
      "about",
      "calendar",
      "references",
      "documents",
      "contacts",
    ]);
  });

  it("ignores a stored value that isn't a list", () => {
    expect(reconcileSectionOrder("about")).toEqual([...DEFAULT_SECTIONS]);
  });
});

describe("profileFont", () => {
  it("resolves known keys", () => {
    expect(profileFont("playfair").stack).toBe("'Playfair Display', serif");
  });

  it("falls back to Modern for missing or unknown keys, never undefined", () => {
    expect(profileFont(undefined)).toBe(PROFILE_FONTS.inter);
    expect(profileFont("comic-sans")).toBe(PROFILE_FONTS.inter);
    expect(profileFont("toString")).toBe(PROFILE_FONTS.inter);
  });

  it("gives every font a stylesheet, Modern included", () => {
    for (const f of Object.values(PROFILE_FONTS)) expect(f.url).toMatch(/^https:\/\/fonts\./);
  });
});
