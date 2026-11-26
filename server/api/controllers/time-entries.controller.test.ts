import { describe, expect, it, vi, beforeEach } from "vitest";

// Overtime settings are saved with (entry id, freelancer id). Both are numbers,
// so a swap compiles, matches no row, and used to answer 204 as if it saved.

const updateEarningsEntryOvertimeSettings = vi.fn();

vi.mock("server/storage", () => ({
  storage: { updateEarningsEntryOvertimeSettings },
}));

process.env.SESSION_SECRET ??= "test-secret";
process.env.JWT_SECRET ??= "test-secret";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const { updateOvertimeSettings } = await import("./time-entries.controller");

function run(body: Record<string, unknown>, matched = true) {
  updateEarningsEntryOvertimeSettings.mockResolvedValue(matched);
  const req: any = { params: { entryId: "412" }, body, user: { id: 18 } };
  const res: any = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
    send: vi.fn(() => res),
  };
  return Promise.resolve(updateOvertimeSettings(req, res)).then(() => res);
}

describe("updateOvertimeSettings", () => {
  beforeEach(() => updateEarningsEntryOvertimeSettings.mockReset());

  it("updates the entry from the URL for the signed-in freelancer", async () => {
    const res = await run({ standard_hours_per_day: 10, overtime_rate_pence: 1875 });
    expect(updateEarningsEntryOvertimeSettings).toHaveBeenCalledWith(412, 18, {
      standard_hours_per_day: 10,
      overtime_rate_pence: 1875,
    });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("clears a setting sent as empty", async () => {
    await run({ standard_hours_per_day: "", overtime_rate_pence: null });
    expect(updateEarningsEntryOvertimeSettings).toHaveBeenCalledWith(412, 18, {
      standard_hours_per_day: null,
      overtime_rate_pence: null,
    });
  });

  it("answers 404 when no entry of theirs matched, instead of claiming it saved", async () => {
    const res = await run({ standard_hours_per_day: 10 }, false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).not.toHaveBeenCalled();
  });
});
