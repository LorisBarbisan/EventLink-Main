import { describe, it, expect } from "vitest";
import { jobHasFinished, jobLastDay } from "./job-dates";

describe("jobLastDay", () => {
  it("single day: the start date", () => {
    expect(jobLastDay({ event_date: "2026-11-18" })).toBe("2026-11-18");
  });
  it("an explicit end date wins", () => {
    expect(
      jobLastDay({
        event_date: "2026-11-18",
        end_date: "2026-11-20",
        duration_type: "days",
        days: 5,
      })
    ).toBe("2026-11-20");
  });
  it("a duration in days: start + days − 1, across a month end", () => {
    expect(jobLastDay({ event_date: "2026-11-29", duration_type: "days", days: 3 })).toBe(
      "2026-12-01"
    );
  });
  it("hours or time durations don't extend it", () => {
    expect(jobLastDay({ event_date: "2026-11-18", duration_type: "hours", days: 3 })).toBe(
      "2026-11-18"
    );
  });
  it("nothing usable: null", () => {
    expect(jobLastDay({ event_date: null })).toBeNull();
    expect(jobLastDay({ event_date: "not a date" })).toBeNull();
  });
});

describe("jobHasFinished", () => {
  const threeDay = { event_date: "2026-11-17", duration_type: "days", days: 3 };
  it("a three-day job hired into on day two is not finished", () => {
    expect(jobHasFinished(threeDay, "2026-11-18")).toBe(false);
    expect(jobHasFinished(threeDay, "2026-11-19")).toBe(false);
  });
  it("finished the day after its last day", () => {
    expect(jobHasFinished(threeDay, "2026-11-20")).toBe(true);
  });
});
