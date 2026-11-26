import { describe, expect, it, vi, beforeEach } from "vitest";

// An account with live activity (active/paused jobs, or open bookings on either
// side) must not be hard-deleted — that would orphan or destroy live work. The
// endpoint refuses with 409 and a clear reason instead.

const getAccountDeletionBlockers = vi.fn();
const adminHardDeleteUser = vi.fn();

vi.mock("server/storage", () => ({
  storage: { getAccountDeletionBlockers, adminHardDeleteUser },
}));

process.env.SESSION_SECRET ??= "test-secret";
process.env.JWT_SECRET ??= "test-secret";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const { adminDeleteUser } = await import("./admin.controller");

function run(
  blockers: { activeJobs: number; openBookings: number },
  opts: { id?: string; adminId?: number } = {}
) {
  getAccountDeletionBlockers.mockResolvedValue(blockers);
  adminHardDeleteUser.mockResolvedValue(undefined);
  const req: any = { params: { id: opts.id ?? "7" }, user: { id: opts.adminId ?? 99 } };
  const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
  return Promise.resolve(adminDeleteUser(req, res)).then(() => res);
}

describe("adminDeleteUser", () => {
  beforeEach(() => {
    getAccountDeletionBlockers.mockReset();
    adminHardDeleteUser.mockReset();
  });

  it("refuses (409) when the account has active jobs", async () => {
    const res = await run({ activeJobs: 2, openBookings: 0 });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(adminHardDeleteUser).not.toHaveBeenCalled();
  });

  it("refuses (409) when the account has open bookings", async () => {
    const res = await run({ activeJobs: 0, openBookings: 1 });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(adminHardDeleteUser).not.toHaveBeenCalled();
  });

  it("deletes when there is no live activity", async () => {
    const res = await run({ activeJobs: 0, openBookings: 0 });
    expect(adminHardDeleteUser).toHaveBeenCalledWith(7);
    expect(res.json).toHaveBeenCalled();
  });

  it("refuses (400) deleting your own account, before checking blockers", async () => {
    const res = await run({ activeJobs: 0, openBookings: 0 }, { id: "99", adminId: 99 });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(getAccountDeletionBlockers).not.toHaveBeenCalled();
    expect(adminHardDeleteUser).not.toHaveBeenCalled();
  });
});
