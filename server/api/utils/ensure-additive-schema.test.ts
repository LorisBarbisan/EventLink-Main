import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * shared/schema.ts is the data model. The boot-time ensure script only repeats
 * what the numbered migrations already declare, as a safety net — it must
 * never be the only place a table exists.
 */
describe("ensure-additive-schema", () => {
  it("every table it creates is declared in shared/schema.ts", () => {
    const ensure = readFileSync(join(__dirname, "ensure-additive-schema.ts"), "utf8");
    const schema = readFileSync(join(__dirname, "../../../shared/schema.ts"), "utf8");
    const tables = [...ensure.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(0);
    const declared = new Set([...schema.matchAll(/pgTable\(\s*"(\w+)"/g)].map((m) => m[1]));
    const missing = tables.filter((t) => !declared.has(t));
    expect(missing).toEqual([]);
  });
});
