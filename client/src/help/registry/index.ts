import type { HelpEntry } from "../types";

// The registry is code-split per area and kept out of the initial bundle. It is
// loaded lazily (behind requestIdleCallback in the provider), so the page renders
// first and help becomes available a beat later.

let cached: Map<string, HelpEntry> | null = null;
let loading: Promise<Map<string, HelpEntry>> | null = null;

async function build(): Promise<Map<string, HelpEntry>> {
  const areas = await Promise.all([import("./jobs"), import("./profile"), import("./dashboard")]);
  const map = new Map<string, HelpEntry>();
  for (const mod of areas) {
    for (const entry of mod.default) {
      if (map.has(entry.key) && import.meta.env.DEV) {
        console.warn(`[help] duplicate registry key: ${entry.key}`);
      }
      map.set(entry.key, entry);
    }
  }
  return map;
}

export async function loadRegistry(): Promise<Map<string, HelpEntry>> {
  if (cached) return cached;
  if (!loading) {
    loading = build().then((map) => {
      cached = map;
      return map;
    });
  }
  return loading;
}

export function getCachedRegistry(): Map<string, HelpEntry> | null {
  return cached;
}
