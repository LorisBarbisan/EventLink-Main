import { describe, it, expect, vi } from "vitest";

// The /manage-business FAQ schema and copy must be server-rendered for non-JS
// crawlers (Bing, Perplexity, AI engines) — the same path as the /faq fix. If it
// were injected client-side only, those engines would see none of it.

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.SESSION_SECRET ??= "test-secret";
process.env.JWT_SECRET ??= "test-secret";

const { ogTagMiddleware } = await import("./ogTags");

function render(path: string, userAgent: string) {
  let body = "";
  let status = 0;
  const res: any = {
    status: (s: number) => {
      status = s;
      return res;
    },
    set: () => res,
    end: (html: string) => {
      body = html;
      return res;
    },
  };
  const req: any = { path, headers: { "user-agent": userAgent, host: "eventlink.one" } };
  const next = vi.fn();
  ogTagMiddleware(req, res, next);
  return { body, status, next };
}

describe("/manage-business crawler prerender", () => {
  it("serves the FAQPage JSON-LD and both answers to a crawler", () => {
    const { body, status, next } = render("/manage-business", "Googlebot/2.1");
    expect(status).toBe(200);
    expect(next).not.toHaveBeenCalled();
    expect(body).toContain('"@type":"FAQPage"');
    expect(body).toContain("Does EventLink submit my Making Tax Digital updates to HMRC?");
    expect(body).toContain("What mileage rate does EventLink use?");
    // The mileage figure must match the rate the app applies (migration 0030).
    expect(body).toContain("55p a mile for the first 10,000 business miles");
    expect(body).toContain("MTD-Ready Bookkeeping for Freelance Event Professionals | EventLink");
    expect(body).toContain("Get your books Making Tax Digital-ready");
  });

  it("passes non-crawler traffic through to the SPA", () => {
    const { next } = render("/manage-business", "Mozilla/5.0 (a real browser)");
    expect(next).toHaveBeenCalled();
  });
});
