import { describe, it, expect } from "vitest";
import { jobLastDay } from "./job-dates";
import { AUTO_COMPLETE_AFTER_DAYS } from "./hiring";

// The day-after prompt and the 7-day fallback both key off jobLastDay.
describe("completion timing", () => {
  const job = { event_date: "2026-11-10", duration_type: "days", days: 3 };
  const addDays = (iso: string, n: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  it("prompt the day after the last day, auto-complete 7 days after it", () => {
    const last = jobLastDay(job)!;
    expect(last).toBe("2026-11-12");
    expect(addDays(last, 1)).toBe("2026-11-13");
    expect(addDays(last, AUTO_COMPLETE_AFTER_DAYS)).toBe("2026-11-19");
  });
});
