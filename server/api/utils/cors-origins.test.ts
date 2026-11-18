import { describe, it, expect } from "vitest";
import { allowedOrigins, isAllowedOrigin } from "./cors-origins";

const prod = allowedOrigins({ NODE_ENV: "production", APP_URL: "https://eventlink.one/" });
const dev = allowedOrigins({ NODE_ENV: "development" });

describe("CORS allowlist", () => {
  it("allows the production domain and Railway deployments", () => {
    expect(isAllowedOrigin("https://eventlink.one", prod)).toBe(true);
    expect(isAllowedOrigin("https://eventlink-card-branch.up.railway.app", prod)).toBe(true);
  });

  it("refuses look-alikes and plain http", () => {
    expect(isAllowedOrigin("https://evil.up.railway.app.attacker.com", prod)).toBe(false);
    expect(isAllowedOrigin("http://eventlink-card-branch.up.railway.app", prod)).toBe(false);
    expect(isAllowedOrigin("https://eventlink.one.attacker.com", prod)).toBe(false);
  });

  it("allows localhost only outside production", () => {
    expect(isAllowedOrigin("http://localhost:5173", prod)).toBe(false);
    expect(isAllowedOrigin("http://localhost:5173", dev)).toBe(true);
  });

  it("contains no string with a wildcard — those never match", () => {
    for (const p of [...prod, ...dev]) {
      if (typeof p === "string") expect(p.includes("*"), p).toBe(false);
    }
  });
});
