import { describe, it, expect, vi, beforeEach } from "vitest";

// Re-confirming a booking that was previously cancelled must bring its earnings
// entry back. The cancel path archives the (un-invoiced) entry; seedEntryFromBooking
// — which only runs for active bookings — must un-archive that same set so the
// expected income reappears in the Earnings sheet. An invoiced entry is left alone.

const getEarningsEntryByBooking = vi.fn();
const findOrCreateClientByEmployer = vi.fn();
const findOrCreateClientByName = vi.fn();
const updateEarningsEntry = vi.fn();
const createEarningsEntry = vi.fn();
const linkJobApplicationEarning = vi.fn();

vi.mock("../../storage", () => ({
  storage: {
    getEarningsEntryByBooking,
    findOrCreateClientByEmployer,
    findOrCreateClientByName,
    updateEarningsEntry,
    createEarningsEntry,
    linkJobApplicationEarning,
  },
}));

// The job_applications mirror query is non-fatal; an empty result is enough.
vi.mock("../config/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  },
}));

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const { seedEntryFromBooking } = await import("./earnings.service");

const booking: any = {
  id: 14,
  freelancerId: 18,
  employerId: 682,
  agreedRate: "500",
  currency: "GBP",
  createdAt: new Date("2026-11-25T00:00:00Z"),
  status: "confirmed",
};
const job: any = {
  id: 1100,
  title: "Aster",
  company: "Stewart Johnes",
  recruiter_id: 682,
  currency: "GBP",
  event_date: "2026-11-25",
  end_date: null,
  status: "private",
  rate: "500",
};

describe("seedEntryFromBooking un-archives a re-confirmed booking's entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOrCreateClientByEmployer.mockResolvedValue({ id: 7 });
    findOrCreateClientByName.mockResolvedValue({ id: 7 });
    updateEarningsEntry.mockResolvedValue(undefined);
    createEarningsEntry.mockResolvedValue({ id: 39 });
  });

  it("un-archives an archived, expected, un-invoiced entry", async () => {
    getEarningsEntryByBooking.mockResolvedValue({
      id: 39,
      status: "expected",
      archived: true,
      invoice_id: null,
    });
    await seedEntryFromBooking(booking, job);
    expect(updateEarningsEntry).toHaveBeenCalledTimes(1);
    const payload = updateEarningsEntry.mock.calls[0][1];
    expect(payload.archived).toBe(false);
    expect(payload.archived_at).toBeNull();
  });

  it("leaves an archived but invoiced entry archived", async () => {
    getEarningsEntryByBooking.mockResolvedValue({
      id: 39,
      status: "expected",
      archived: true,
      invoice_id: 500,
    });
    await seedEntryFromBooking(booking, job);
    const payload = updateEarningsEntry.mock.calls[0][1];
    expect(payload.archived).toBeUndefined();
    expect(payload).not.toHaveProperty("archived_at");
  });

  it("does not touch archived on an already-visible entry", async () => {
    getEarningsEntryByBooking.mockResolvedValue({
      id: 39,
      status: "expected",
      archived: false,
      invoice_id: null,
    });
    await seedEntryFromBooking(booking, job);
    const payload = updateEarningsEntry.mock.calls[0][1];
    expect(payload.archived).toBeUndefined();
  });
});
