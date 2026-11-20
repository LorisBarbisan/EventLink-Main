import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { bookingNeedsEarningsEntry } from "../utils/booking-earnings";

describe("which bookings belong in the freelancer's books", () => {
  it("confirmed, briefed and completed do; enquired and cancelled don't", () => {
    expect(bookingNeedsEarningsEntry("confirmed")).toBe(true);
    expect(bookingNeedsEarningsEntry("briefed")).toBe(true);
    expect(bookingNeedsEarningsEntry("completed")).toBe(true);
    expect(bookingNeedsEarningsEntry("enquired")).toBe(false);
    expect(bookingNeedsEarningsEntry("cancelled")).toBe(false);
    expect(bookingNeedsEarningsEntry(null)).toBe(false);
  });
});

describe("a hire seeds the earnings entry after its transaction", () => {
  // A hire onto a job whose last day has passed goes straight to "completed",
  // so no later transition would ever seed it. The seed must be in the hire.
  const src = readFileSync(join(__dirname, "hire.service.ts"), "utf8");
  it("calls seedEntryForBookingId outside the transaction callback", () => {
    const txEnd = src.indexOf("  });", src.indexOf("db.transaction("));
    const seedAt = src.indexOf("seedEntryForBookingId(synced.bookingId)");
    expect(txEnd).toBeGreaterThan(0);
    expect(seedAt).toBeGreaterThan(txEnd);
  });
});
