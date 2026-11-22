import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { normaliseRecordWrite, normaliseCurrency } from "./record-writes";
import { isBooksCurrency, allowableExpensePence } from "./expense-totals";

describe("normaliseRecordWrite", () => {
  it("stamps archived_at when archiving, clears it when restoring", () => {
    const a = normaliseRecordWrite({ archived: true });
    expect(a.archived_at).toBeInstanceOf(Date);
    expect(normaliseRecordWrite({ archived: false }).archived_at).toBeNull();
    const given = new Date("2026-01-01");
    expect(normaliseRecordWrite({ archived: true, archived_at: given }).archived_at).toBe(given);
  });

  it("trims and upper-cases currency, and drops a blank one", () => {
    expect(normaliseRecordWrite({ currency: " gbp " }).currency).toBe("GBP");
    expect("currency" in normaliseRecordWrite({ currency: "  " })).toBe(false);
    expect(normaliseCurrency(" eur")).toBe("EUR");
  });

  it("leaves other fields alone", () => {
    expect(normaliseRecordWrite({ description: "x" } as never)).toEqual({ description: "x" });
  });
});

describe("a padded currency still counts", () => {
  it("' GBP ' is sterling", () => {
    expect(isBooksCurrency(" GBP ")).toBe(true);
    expect(
      allowableExpensePence(
        {
          net_amount_pence: 10000,
          vat_amount_pence: 2000,
          business_use_percent: 100,
          currency: " GBP ",
        },
        false
      )
    ).toBe(12000);
  });
});

// Backstop: any direct db write that archives earnings or expenses must stamp
// archived_at itself (storage's update functions do it automatically).
describe("archive writes", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return n === "scripts" ? [] : files(p);
      return p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
    });

  it("every .update(earnings_entries|expenses) that sets archived: true also sets archived_at", () => {
    const offenders: string[] = [];
    for (const f of files(join(__dirname, "..", "server"))) {
      const src = readFileSync(f, "utf8");
      const re = /\.update\((earnings_entries|expenses)\)([\s\S]{0,400}?)\.where\(/g;
      for (const m of src.matchAll(re)) {
        if (
          /archived:\s*true/.test(m[2]) &&
          !/archived_at/.test(m[2]) &&
          !/\.\.\.archive|set\((set|archive)\)/.test(m[2])
        ) {
          offenders.push(`${f.split(/[\\/]server[\\/]/)[1]}: ${m[2].trim().slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
