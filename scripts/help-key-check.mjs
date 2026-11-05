#!/usr/bin/env node
// ============================================================
// CI guard for the contextual help system. Greps the client source for
// explicit help keys (data-help="…", <Help k="…">, useHelp("…")) and fails the
// build if any references a key with no registry entry. Without this the
// registry rots within a quarter.
//
// Form-derived keys (form.<namespace>.<field>) are dynamic and intentionally
// not checked here.
//
//   node scripts/help-key-check.mjs
// ============================================================

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLIENT_SRC = join(ROOT, "client", "src");
const REGISTRY_DIR = join(CLIENT_SRC, "help", "registry");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules") continue;
      walk(p, out);
    } else if ([".ts", ".tsx"].includes(extname(name))) {
      out.push(p);
    }
  }
  return out;
}

// 1. Collect the valid keys from the registry area files.
const registryKeys = new Set();
for (const f of readdirSync(REGISTRY_DIR)) {
  if (!f.endsWith(".ts") || f === "index.ts") continue;
  const text = readFileSync(join(REGISTRY_DIR, f), "utf8");
  for (const m of text.matchAll(/^\s*key:\s*"([^"]+)"/gm)) registryKeys.add(m[1]);
}

if (registryKeys.size === 0) {
  console.error("help-key-check: found no registry keys — is the registry present?");
  process.exit(1);
}

// 2. Scan the client source for explicit key references.
const patterns = [
  /data-help="([^"]+)"/g,
  /<Help\b[^>]*?\bk="([^"]+)"/g,
  /useHelp\(\s*"([^"]+)"\s*\)/g,
];

const missing = [];
const usedKeys = new Set();
for (const file of walk(CLIENT_SRC)) {
  const text = readFileSync(file, "utf8");
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const key = m[1];
      // Skip non-literal matches: template expressions (`${key}`) and doc
      // placeholders (`<key>`) that appear in the help internals themselves.
      if (!/^[a-z][\w.-]*$/i.test(key)) continue;
      if (key.startsWith("form.")) continue; // dynamic form coverage
      usedKeys.add(key);
      if (!registryKeys.has(key)) {
        missing.push({ file: file.replace(ROOT, ""), key });
      }
    }
  }
}

// 3. Report orphan registry entries (informational, non-fatal).
const orphans = [...registryKeys].filter(
  (k) => !usedKeys.has(k) && !k.startsWith("form.") && !k.startsWith("dashboard.") && !k.startsWith("jobs.") && !k.startsWith("profile.")
);

if (missing.length > 0) {
  console.error("\n❌ help-key-check: keys referenced with no registry entry:\n");
  for (const { file, key } of missing) console.error(`   ${key}   (${file})`);
  console.error(`\n${missing.length} missing key(s). Add registry entries or fix the keys.\n`);
  process.exit(1);
}

console.log(`✅ help-key-check: ${usedKeys.size} referenced key(s) all resolve. ${registryKeys.size} in registry.`);
if (orphans.length > 0) {
  console.log(`ℹ️  ${orphans.length} registry key(s) not referenced by an explicit wrapper (may be form/discovery keys).`);
}
process.exit(0);
