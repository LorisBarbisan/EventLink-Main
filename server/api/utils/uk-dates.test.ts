import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * "Today" and "the date this happened" must be UK calendar dates: use ukToday()
 * and ukDate() from shared/job-dates. toISOString().slice(0, 10) is the UTC
 * date, which between midnight and 01:00 in BST is still yesterday — enough
 * to date an invoice or a payment in the previous tax year.
 *
 * The files below use it deliberately, for values that genuinely are UTC.
 */
const ALLOWED = new Set([
  "api/routes/seo.route.ts", // sitemap lastmod: W3C dates, UTC is fine
  "api/services/import-parse-utils.ts", // Excel serial → date: defined in UTC
  "api/services/import-parser.service.ts", // spreadsheet cell dates arrive as UTC midnight
  "api/services/outlookCalendar.service.ts", // retired integration
  // The calendar grid builds its own dates at UTC midnight (Date.UTC) and
  // formats them back in UTC — a closed loop, never "today".
  "client/components/PublicAvailability.tsx",
]);

const ROOT = join(__dirname, "../..");
const SHARED = join(__dirname, "../../../shared");
const CLIENT = join(__dirname, "../../../client/src");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    if (statSync(p).isDirectory()) return n === "node_modules" ? [] : walk(p);
    return /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });

describe("UK calendar dates (server, shared and browser)", () => {
  it("no UTC 'today' or timestamp→date outside the allowed files", () => {
    const offenders: string[] = [];
    // server/ and shared/ (shared code runs on the server too: tax years live there)
    const files = [
      ...walk(ROOT).map((f) => [f, relative(ROOT, f)] as const),
      ...walk(SHARED).map((f) => [f, "shared/" + relative(SHARED, f)] as const),
      // the browser pre-fills the dates the server then stores
      ...walk(CLIENT).map((f) => [f, "client/" + relative(CLIENT, f)] as const),
    ];
    for (const [file, relRaw] of files) {
      const rel = relRaw.split("\\").join("/");
      if (ALLOWED.has(rel)) continue;
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (/^\s*(\*|\/\/)/.test(line)) return; // comments may name the pattern
          if (/toISOString\(\)\.(slice\(0, ?10\)|split\(["']T["']\)\[0\])/.test(line))
            offenders.push(`${rel}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
