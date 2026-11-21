import { describe, it, expect } from "vitest";
import { canonicalRedirect } from "./canonical-host";

const SITE = "https://eventlink.one";

describe("canonical host redirect", () => {
  it("sends app.eventlink.one to the apex, keeping path and query", () => {
    expect(canonicalRedirect("GET", "app.eventlink.one", "/reference/abc?x=1", SITE)).toBe(
      "https://eventlink.one/reference/abc?x=1"
    );
    expect(canonicalRedirect("HEAD", "APP.eventlink.one", "/", SITE)).toBe(
      "https://eventlink.one/"
    );
  });

  it("leaves webhooks and other writes where they landed", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
      expect(
        canonicalRedirect(m, "app.eventlink.one", "/api/calendar/webhook/google", SITE)
      ).toBeNull();
  });

  it("leaves the site's own host and unknown hosts alone", () => {
    expect(canonicalRedirect("GET", "eventlink.one", "/", SITE)).toBeNull();
    expect(canonicalRedirect("GET", "eventlink-card-branch.up.railway.app", "/", SITE)).toBeNull();
  });

  it("never loops if the legacy host is configured as the site", () => {
    expect(
      canonicalRedirect("GET", "app.eventlink.one", "/", "https://app.eventlink.one")
    ).toBeNull();
  });
});
