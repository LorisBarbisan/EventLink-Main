/**
 * Every help entry must be reachable: some element in the client has to claim
 * its key (data-help, helpKey or <Help k=…>). An entry with no marker is
 * invisible, and 46 of them once piled up that way unnoticed.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import jobs from "../help/registry/jobs";
import profile from "../help/registry/profile";
import dashboard from "../help/registry/dashboard";
import bookings from "../help/registry/bookings";
import books from "../help/registry/books";
import tax from "../help/registry/tax";

const CLIENT = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "help" ? [] : sourceFiles(p);
    return /\.(tsx?|jsx?)$/.test(name) && !name.endsWith(".test.ts") ? [p] : [];
  });
}

const source = sourceFiles(CLIENT)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const literalMarkers = new Set(
  [...source.matchAll(/(?:data-help|helpKey|\bk)=\{?["'`]([A-Za-z0-9_.]+)["'`]/g)].map((m) => m[1])
);

// Keys built at render time from a prop, e.g. data-help={`bookings.status.${status}`}.
const computedPrefixes = [...source.matchAll(/data-help=\{`([A-Za-z0-9_.]+)\$\{/g)].map(
  (m) => m[1]
);

/**
 * Entries knowingly without a marker, each with the reason. Remove a line here
 * when its feature ships; add one only with a reason someone can act on.
 */
const NOT_YET: Record<string, string> = {
  "books.job.detail": "Job Record epic: the detail panel it describes is not built",
  "books.job.linkExpense": "Job Record epic, PR 2",
  "books.job.overtime": "Job Record epic",
  "tax.class2": "decision pending: split the NI line in the estimate, or retire",
  "tax.class4": "decision pending: split the NI line in the estimate, or retire",
  "tax.tradingAllowance": "decision pending: show it in the estimate, or retire",
  "form.profile.day_rate": "decision pending: the profile form has no day rate field",
  "books.import.columnMapping": "decision pending: import has no column-mapping step",
  "dashboard.tab.myJobs": "decision pending: duplicates dashboard.tab.freelancerApplications",
  "jobs.filter.radius": "decision pending: job search has no distance filter",
};

describe("help coverage", () => {
  const keys = [...jobs, ...profile, ...dashboard, ...bookings, ...books, ...tax].map((e) => e.key);
  const reachable = (k: string) =>
    literalMarkers.has(k) || computedPrefixes.some((p) => k.startsWith(p));

  it("every registry entry has a marker in the client", () => {
    const missing = keys.filter((k) => !reachable(k) && !(k in NOT_YET));
    expect(missing).toEqual([]);
  });

  it("nothing on the not-yet list has quietly been wired", () => {
    const stale = Object.keys(NOT_YET).filter((k) => !keys.includes(k) || reachable(k));
    expect(stale).toEqual([]);
  });
});
