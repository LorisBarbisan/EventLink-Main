// Loaded first so module-scope reads work when this file is imported ahead of
// server/index.ts calling dotenv.config()
import "dotenv/config";

/**
 * The one public address of the site, for every link the server builds:
 * emails, QR codes, OAuth callbacks for Calendar, sitemaps. Read from
 * FRONTEND_URL, so staging's emails link to staging.
 *
 * BASE_URL is still read as a deprecated alias for one release; it warns.
 */
export const CANONICAL_SITE_URL = "https://eventlink.one";

function resolveSiteUrl(): string {
  const frontend = process.env.FRONTEND_URL?.trim();
  const legacy = process.env.BASE_URL?.trim();

  if (!frontend && legacy) {
    console.warn(
      `⚠️  BASE_URL is deprecated and will stop being read next release — set FRONTEND_URL instead (using BASE_URL=${legacy})`
    );
  }

  const url = (frontend || legacy || CANONICAL_SITE_URL).replace(/\/+$/, "");

  // A silent wrong default here breaks OAuth callbacks and every emailed link,
  // with no clue why. Say so loudly.
  if (process.env.NODE_ENV === "production" && !frontend) {
    console.warn(
      `\n${"⚠️ ".repeat(10)}\n` +
        `⚠️  FRONTEND_URL is not set. Every link and OAuth callback will use ${url}\n` +
        `⚠️  ${legacy ? "(from the deprecated BASE_URL)" : "(the built-in fallback)"}. Set FRONTEND_URL on this service.\n` +
        `${"⚠️ ".repeat(10)}\n`
    );
  }
  return url;
}

export const SITE_URL = resolveSiteUrl();
