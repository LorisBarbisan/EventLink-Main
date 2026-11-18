import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { booksCohort, type BooksUsageRow } from "./books-usage";

const now = new Date("2026-11-18T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("booksCohort", () => {
  it("never started: no records", () => {
    expect(booksCohort(0, null, now)).toBe("never");
  });
  it("active: wrote something in the last 30 days", () => {
    expect(booksCohort(1, daysAgo(3), now)).toBe("active");
    expect(booksCohort(200, daysAgo(30), now)).toBe("active");
  });
  it("slowing: nothing for 30–90 days", () => {
    expect(booksCohort(40, daysAgo(31), now)).toBe("slowing");
    expect(booksCohort(2, daysAgo(90), now)).toBe("slowing");
  });
  it("lapsed vs tried it: 90+ days, split at five records", () => {
    expect(booksCohort(6, daysAgo(120), now)).toBe("lapsed");
    expect(booksCohort(5, daysAgo(120), now)).toBe("tried");
  });
});

// ── Privacy guards ───────────────────────────────────────────────────────────

describe("Books usage privacy", () => {
  it("a usage row holds only ids, names, numbers, dates, booleans and a cohort label", () => {
    const row: BooksUsageRow = {
      user_id: 1,
      name: "A Person",
      signed_up: "2026-01-01",
      counts: { earnings: 1, expenses: 2, mileage: 0, kit: 0, invoices: 0, imports: 0 },
      total_records: 3,
      first_activity: "2026-02-01",
      last_activity: "2026-11-01",
      workbook_downloaded: false,
      cohort: "active",
    };
    const allowed = new Set([
      "user_id",
      "name",
      "signed_up",
      "counts",
      "total_records",
      "first_activity",
      "last_activity",
      "workbook_downloaded",
      "cohort",
    ]);
    // Adding a field (say, "latest expense description") must be a deliberate
    // change to this list, not a convenience.
    expect(Object.keys(row).sort()).toEqual([...allowed].sort());
  });

  it("the usage service never selects content columns", () => {
    const src = readFileSync(
      join(__dirname, "../server/api/services/books-usage.service.ts"),
      "utf8"
    );
    const sqlText = src.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const forbidden of [
      "books_audit_log",
      "description",
      "amount",
      "notes",
      "snapshot",
      "summary",
      "line_items",
      "to_details",
      "SELECT *",
      ".*",
    ]) {
      expect(sqlText.includes(forbidden), forbidden).toBe(false);
    }
  });

  it("no admin code touches books_audit_log", () => {
    const roots = ["../server/api/routes", "../server/api/controllers", "../server/api/services"];
    for (const r of roots) {
      const dir = join(__dirname, r);
      for (const f of readdirSync(dir)) {
        if (!/admin|books-usage/i.test(f)) continue;
        const src = readFileSync(join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
        expect(src.includes("books_audit_log"), f).toBe(false);
      }
    }
  });
});
