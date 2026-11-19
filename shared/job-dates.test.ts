import { describe, it, expect } from "vitest";
import {
  addDays,
  daysBetween,
  endOfFollowingMonth,
  jobHasFinished,
  jobLastDay,
  parseCalendarDate,
  ukDate,
  ukToday,
} from "./job-dates";

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

describe("calendar dates without Date objects", () => {
  it("a three-day job starting on the BST→GMT weekend ends on 27 October", () => {
    expect(jobLastDay({ event_date: "2026-10-25", duration_type: "days", days: 3 })).toBe(
      "2026-10-27"
    );
    // and across the spring-forward weekend
    expect(jobLastDay({ event_date: "2027-03-28", duration_type: "days", days: 2 })).toBe(
      "2027-03-29"
    );
  });

  it("addDays crosses months, years and leap days", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-04-05", "2026-04-06")).toBe(1);
  });

  it("rejects malformed or impossible dates", () => {
    expect(parseCalendarDate("2026-13-45")).toBeNull();
    expect(parseCalendarDate("2026-02-30")).toBeNull();
    expect(parseCalendarDate("next Tuesday")).toBeNull();
    expect(parseCalendarDate("2026-11-19T10:00:00Z")).toBe("2026-11-19");
  });
});

// The completion check either side of midnight London on changeover day, with
// the process in UTC and in Europe/London: the answer must not depend on it.
describe("completion is the same whatever the server's zone", () => {
  const job = { event_date: "2026-10-25" }; // single day, the BST→GMT changeover
  const cases: Array<[string, string, boolean]> = [
    ["2026-10-25T22:30:00Z", "2026-10-25", false], // 22:30 GMT, still the 25th in London
    ["2026-10-26T00:30:00Z", "2026-10-26", true], // 00:30 GMT on the 26th
    ["2026-10-24T23:30:00Z", "2026-10-25", false], // 00:30 BST on the 25th (UTC still the 24th)
  ];
  for (const tz of ["UTC", "Europe/London"]) {
    it(`with TZ=${tz}`, () => {
      const prev = process.env.TZ;
      process.env.TZ = tz;
      try {
        for (const [instant, londonDay, finished] of cases) {
          const today = ukToday(new Date(instant));
          expect(today).toBe(londonDay);
          expect(jobHasFinished(job, today)).toBe(finished);
        }
      } finally {
        process.env.TZ = prev;
      }
    });
  }
});

describe("UK dates from instants", () => {
  it("an invoice raised at 00:30 BST on 6 April is dated 6 April, not 5 April", () => {
    expect(ukDate("2026-04-05T23:30:00Z")).toBe("2026-04-06");
    expect(ukDate(new Date("2026-04-05T23:30:00Z"))).toBe("2026-04-06");
  });
  it("in GMT the UK date is the UTC date", () => {
    expect(ukDate("2026-01-15T23:30:00Z")).toBe("2026-01-15");
  });
  it("end of the following month", () => {
    expect(endOfFollowingMonth("2026-01-31")).toBe("2026-02-28");
    expect(endOfFollowingMonth("2027-12-05")).toBe("2028-01-31");
    expect(endOfFollowingMonth("2027-11-05")).toBe("2027-12-31");
    expect(endOfFollowingMonth("2028-01-10")).toBe("2028-02-29");
  });
});
