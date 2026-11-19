import { describe, it, expect } from "vitest";
import {
  buildPublicAvailability,
  datesBetween,
  withPublicAvailability,
} from "./public-availability";

const window = { from: "2026-11-19", to: "2027-02-17" };

describe("buildPublicAvailability", () => {
  const out = buildPublicAvailability({
    ...window,
    marks: [
      {
        date: "2026-11-20",
        status: "available",
        updated_at: "2026-11-10T09:00:00Z",
        note: "Maria's birthday — do not book",
      } as never,
      { date: "2026-11-21", status: "tentative", updated_at: "2026-11-15T09:00:00Z" },
      { date: "2026-11-22", status: "unavailable", updated_at: null },
      { date: "2026-11-01", status: "available", updated_at: "2026-11-18T09:00:00Z" }, // past: out of window
    ],
    bookedDates: ["2026-11-20", "2026-11-25"],
  });

  it("never carries a note, or any key beyond date and state", () => {
    for (const d of out.days) expect(Object.keys(d).sort()).toEqual(["date", "state"]);
    expect(JSON.stringify(out)).not.toContain("birthday");
    expect(JSON.stringify(out)).not.toContain("note");
  });

  it("maps the three states and keeps tentative as its own", () => {
    expect(out.days.find((d) => d.date === "2026-11-21")?.state).toBe("tentative");
    expect(out.days.find((d) => d.date === "2026-11-22")?.state).toBe("busy");
  });

  it("a confirmed booking shows as busy, even over the freelancer's own 'available'", () => {
    expect(out.days.find((d) => d.date === "2026-11-20")?.state).toBe("busy");
    expect(out.days.find((d) => d.date === "2026-11-25")?.state).toBe("busy");
  });

  it("unmarked dates are absent, not free; past dates are excluded", () => {
    expect(out.days.find((d) => d.date === "2026-11-23")).toBeUndefined();
    expect(out.days.find((d) => d.date === "2026-11-01")).toBeUndefined();
  });

  it("updated_at is the latest of the freelancer's own marks in the window", () => {
    expect(out.updated_at).toBe("2026-11-15T09:00:00.000Z");
  });
});

describe("withPublicAvailability", () => {
  const availability = buildPublicAvailability({ ...window, marks: [], bookedDates: [] });

  it("setting off: no availability key at all, and the setting hidden from others", () => {
    const r = withPublicAvailability(
      { user_id: 1, show_calendar_publicly: false },
      { isOwner: false, availability }
    );
    expect("public_availability" in r).toBe(false);
    expect("show_calendar_publicly" in r).toBe(false);
  });

  it("setting on: attached", () => {
    const r = withPublicAvailability(
      { user_id: 1, show_calendar_publicly: true },
      { isOwner: false, availability }
    );
    expect(r.public_availability?.from).toBe(window.from);
  });

  it("the owner still sees their own setting", () => {
    const r = withPublicAvailability(
      { user_id: 1, show_calendar_publicly: false },
      { isOwner: true, availability: null }
    );
    expect(r.show_calendar_publicly).toBe(false);
  });
});

describe("datesBetween", () => {
  it("is inclusive and crosses month ends", () => {
    expect(datesBetween("2026-11-29", "2026-12-01")).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
    ]);
  });
});
