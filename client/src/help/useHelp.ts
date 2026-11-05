import { useContext } from "react";
import { HelpCtx } from "./HelpProvider";
import type { HelpMode } from "./types";

/**
 * Resolve help for a key. Safe to call anywhere — with no provider (logged out)
 * or help disabled, it returns a disabled, no-op result so callers degrade to
 * "no hint" rather than breaking.
 */
export function useHelp(k: string) {
  const ctx = useContext(HelpCtx);
  if (!ctx || !ctx.enabled) {
    return { entry: null, delayMs: 700, enabled: false, markSeen: () => {} };
  }
  const entry = ctx.getEntry(k);
  return {
    entry,
    delayMs: ctx.delayMs,
    enabled: Boolean(entry),
    markSeen: () => ctx.markSeen(k),
  };
}

/**
 * Returns a `complete(key)` callback. Call it from a feature's success handler
 * when the user actually uses the thing a discovery prompt describes — that
 * feature's prompt then never fires again. No-op without a provider.
 */
export function useHelpComplete(): (key: string) => void {
  const ctx = useContext(HelpCtx);
  return (key: string) => ctx?.markCompleted(key);
}

/**
 * Read and change the help mode for the settings toggle. Honoured instantly, no
 * reload. `available` is false when there is no provider (logged out).
 */
export function useHelpSettings(): {
  available: boolean;
  mode: HelpMode;
  setMode: (m: HelpMode) => void;
} {
  const ctx = useContext(HelpCtx);
  if (!ctx) return { available: false, mode: "off", setMode: () => {} };
  return { available: true, mode: ctx.mode, setMode: ctx.setMode };
}
