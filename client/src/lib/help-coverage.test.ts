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

const files = sourceFiles(CLIENT).map((f) => readFileSync(f, "utf8"));
const source = files.join("\n");

// Keys declared in a field table and rendered through a property, e.g.
// { key: "utr", help: "books.business.utr" } … data-help={f.help}. Counted
// only from a file that renders data-help from a `.help` property, so a stray
// `help:` elsewhere doesn't pass for a marker.
const fieldTableMarkers = new Set(
  files
    .filter((text) => /data-help=\{[A-Za-z_$][\w$]*\.help\}/.test(text))
    .flatMap((text) => [...text.matchAll(/\bhelp:\s*["'`]([A-Za-z0-9_.]+)["'`]/g)].map((m) => m[1]))
);

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
  "tax.tradingAllowance":
    "the estimate never applies the £1,000 allowance; showing it needs it offered as an option",
  "form.profile.day_rate": "decision pending: the profile form has no day rate field",
  "jobs.filter.radius": "decision pending: job search has no distance filter",
};

describe("help coverage", () => {
  const keys = [...jobs, ...profile, ...dashboard, ...bookings, ...books, ...tax].map((e) => e.key);
  const reachable = (k: string) =>
    literalMarkers.has(k) ||
    fieldTableMarkers.has(k) ||
    computedPrefixes.some((p) => k.startsWith(p));

  it("every registry entry has a marker in the client", () => {
    const missing = keys.filter((k) => !reachable(k) && !(k in NOT_YET));
    expect(missing).toEqual([]);
  });

  it("nothing on the not-yet list has quietly been wired", () => {
    const stale = Object.keys(NOT_YET).filter((k) => !keys.includes(k) || reachable(k));
    expect(stale).toEqual([]);
  });
});
