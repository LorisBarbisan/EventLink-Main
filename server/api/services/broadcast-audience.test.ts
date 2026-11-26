import { describe, expect, it, vi, beforeEach } from "vitest";

const getAllUsers = vi.fn();
const getDemoUserIds = vi.fn();
const getSystemUpdatesOptedOutUserIds = vi.fn();

vi.mock("server/storage", () => ({
  storage: { getAllUsers, getDemoUserIds, getSystemUpdatesOptedOutUserIds },
}));

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const { resolveBroadcastAudience } = await import("./broadcast-audience.service");

type U = {
  id: number;
  role: string;
  email_verified: boolean;
  email_suppressed_at: Date | null;
  last_login_at: Date | null;
};

function user(id: number, over: Partial<U> = {}): U {
  return {
    id,
    role: "freelancer",
    email_verified: true,
    email_suppressed_at: null,
    last_login_at: new Date(),
    ...over,
  };
}

describe("resolveBroadcastAudience", () => {
  beforeEach(() => {
    getAllUsers.mockReset();
    getDemoUserIds.mockReset();
    getSystemUpdatesOptedOutUserIds.mockReset();
  });

  it("subtracts demo, unverified, suppressed and opted-out for an announcement", async () => {
    getAllUsers.mockResolvedValue({
      users: [
        user(1), // clean → email
        user(2, { email_verified: false }), // unverified
        user(3, { email_suppressed_at: new Date() }), // suppressed
        user(4), // demo (via set)
        user(5), // opted out (via set)
        user(6, { role: "admin" }), // admin → excluded
        user(99), // the sender → excluded
      ],
      total: 7,
    });
    getDemoUserIds.mockResolvedValue([4]);
    getSystemUpdatesOptedOutUserIds.mockResolvedValue([5]);

    const { breakdown, emailRecipients, inAppRecipients } = await resolveBroadcastAudience({
      adminId: 99,
      category: "announcement",
    });

    expect(breakdown.matching).toBe(5); // 7 minus admin minus sender
    expect(breakdown.demo).toBe(1);
    expect(breakdown.unverified).toBe(1);
    expect(breakdown.suppressed).toBe(1);
    expect(breakdown.optedOut).toBe(1);
    expect(breakdown.willReceiveEmail).toBe(1); // only user 1
    expect(breakdown.willReceiveInApp).toBe(0); // announcements don't go in-app
    expect(emailRecipients.map((u) => u.id)).toEqual([1]);
    expect(inAppRecipients).toEqual([]);
  });

  it("ignores the toggle for service/legal and sends in-app to everyone non-demo", async () => {
    getAllUsers.mockResolvedValue({
      users: [user(1), user(5), user(4)],
      total: 3,
    });
    getDemoUserIds.mockResolvedValue([4]);
    getSystemUpdatesOptedOutUserIds.mockResolvedValue([5]);

    const { breakdown } = await resolveBroadcastAudience({ adminId: 99, category: "service" });

    expect(breakdown.optedOut).toBe(0); // not gated
    expect(breakdown.willReceiveEmail).toBe(2); // users 1 and 5 (opted-out still gets service)
    expect(breakdown.willReceiveInApp).toBe(2); // non-demo
  });
});
