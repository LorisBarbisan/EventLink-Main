import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";

vi.mock("server/storage", () => ({
  storage: { getUser: vi.fn(async (id: number) => ({ id, email: "a@b.c", role: "freelancer" })) },
}));

// The env module refuses to load without a secret
process.env.SESSION_SECRET ??= "test-secret";
process.env.JWT_SECRET ??= "test-secret";

const { authenticateOptionalJWT } = await import("./auth.middleware");
const { JWT_SECRET } = await import("../config/env");

function run(authorization?: string) {
  const req: any = { headers: authorization ? { authorization } : {}, query: {} };
  const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
  const next = vi.fn();
  return authenticateOptionalJWT(req, res, next).then(() => ({ req, res, next }));
}

describe("authenticateOptionalJWT", () => {
  it("treats an expired sign-in as a guest instead of refusing the request", async () => {
    const expired = jwt.sign({ id: 7, exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET);
    const { req, res, next } = await run(`Bearer ${expired}`);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it("treats a malformed token as a guest", async () => {
    const { req, res, next } = await run("Bearer not-a-jwt");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it("still signs in a valid token", async () => {
    const good = jwt.sign({ id: 7 }, JWT_SECRET, { expiresIn: "1h" });
    const { req, next } = await run(`Bearer ${good}`);
    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe(7);
  });
});
