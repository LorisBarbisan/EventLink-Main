import { describe, expect, it, vi, beforeEach } from "vitest";

// A direct offer is a private job that is also poster_type "guest" and
// moderation_status "pending". It must never be moderated for publication:
// approving would put it on the public board, rejecting would close a live
// private arrangement. These tests pin that at the endpoint.

const getJobById = vi.fn();
const moderateJob = vi.fn();

vi.mock("server/storage", () => ({
  storage: { getJobById, moderateJob },
}));

process.env.SESSION_SECRET ??= "test-secret";
process.env.JWT_SECRET ??= "test-secret";
// The db config throws at import without this; Neon serverless is lazy, so a
// placeholder is enough — nothing here connects.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const { moderateGuestJob } = await import("./admin.controller");

function run(job: unknown, body: Record<string, unknown> = { decision: "approved" }) {
  getJobById.mockResolvedValue(job);
  moderateJob.mockResolvedValue({ id: 1, status: "active" });
  const req: any = { params: { id: "1" }, body, user: { id: 99 } };
  const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
  return Promise.resolve(moderateGuestJob(req, res)).then(() => res);
}

describe("moderateGuestJob", () => {
  beforeEach(() => {
    getJobById.mockReset();
    moderateJob.mockReset();
  });

  it("refuses to moderate a private job (direct offer) with 409", async () => {
    const res = await run({ id: 1, status: "private" });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(moderateJob).not.toHaveBeenCalled();
  });

  it("404s when the job does not exist", async () => {
    const res = await run(undefined);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(moderateJob).not.toHaveBeenCalled();
  });

  it("moderates a public guest post normally", async () => {
    const res = await run({ id: 1, status: "pending_review" });
    expect(moderateJob).toHaveBeenCalledWith(1, "approved", 99, undefined);
    expect(res.json).toHaveBeenCalled();
  });

  it("rejects an invalid decision with 400 before touching the job", async () => {
    const res = await run({ id: 1, status: "pending_review" }, { decision: "nope" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(moderateJob).not.toHaveBeenCalled();
  });
});
