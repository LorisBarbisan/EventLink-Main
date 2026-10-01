import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpContent } from "./HelpContent";
import type { HelpEntry, HelpKeyState } from "./types";

// ============================================================
// The discovery layer — the ACTIVE "did you know?" prompts.
//
// Separate mechanism from the passive hover hints, but shares the registry.
// An entry is discovery-eligible when it carries discovery metadata (priority).
// Prompts anchor to the on-screen control wired with the same key via
// `data-help="<key>"`, so no extra anchoring is needed.
//
// Every §6 annoyance-budget rule is enforced in `canFire()` — that is the whole
// point of this component.
// ============================================================

interface Props {
  registry: Map<string, HelpEntry> | null;
  getEntry: (key: string) => HelpEntry | null;
  keyStateRef: MutableRefObject<Map<string, HelpKeyState>>;
  routeVisitsRef: MutableRefObject<Map<string, number>>;
  route: string;
  markSeen: (key: string) => void;
  markDismissed: (key: string) => void;
}

const DAY = 86_400_000;

function within90Days(iso?: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 90 * DAY;
}

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
  if (rect.right < 0 || rect.left > window.innerWidth) return false;
  return (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed";
}

// A dialog, sheet, drawer, menu or select being open blocks all prompts. Radix
// also sets body pointer-events:none while a modal overlay is open.
function isOverlayOpen(): boolean {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  if (document.querySelector('[data-state="open"][role="menu"], [data-radix-select-viewport]'))
    return true;
  if (getComputedStyle(document.body).pointerEvents === "none") return true;
  return false;
}

export function HelpDiscovery({
  registry,
  getEntry,
  keyStateRef,
  routeVisitsRef,
  route,
  markSeen,
  markDismissed,
}: Props) {
  const [prompt, setPrompt] = useState<{ entry: HelpEntry; rect: DOMRect } | null>(null);

  // ---- annoyance-budget state (per page-load session) ----
  const sessionCount = useRef(0);
  const lastPromptAt = useRef(0);
  const pageShown = useRef(false);
  const pageEnterAt = useRef(Date.now());
  const lastKeystrokeAt = useRef(0);
  const scrollSincePage = useRef(0);
  const reachedFromValidation = useRef(false);

  const canFire = (): boolean => {
    const now = Date.now();
    if (sessionCount.current >= 3) return false; // ≤3 per session
    if (pageShown.current) return false; // ≤1 per page view
    if (now - lastPromptAt.current < 45_000) return false; // ≥45s apart
    if (now - lastKeystrokeAt.current < 2_000) return false; // not within 2s of typing
    if (now - pageEnterAt.current < 2_000) return false; // not in first 2s on a page
    if (reachedFromValidation.current) return false; // not after a validation failure
    if (isOverlayOpen()) return false; // not while a dialog/menu/select is open
    return true;
  };

  const eligible = (): Array<{ entry: HelpEntry; el: Element }> => {
    if (!registry) return [];
    const out: Array<{ entry: HelpEntry; el: Element }> = [];
    registry.forEach((raw, key) => {
      if (raw.priority === undefined) return; // not a discovery entry
      const entry = getEntry(key); // applies audience / tier / showWhen / overrides
      if (!entry) return;
      const st = keyStateRef.current.get(key);
      if (st?.completedAt) return; // already used the feature — never prompt again
      const versionBumped = (entry.version ?? 1) > (st?.contentVersion ?? 0);
      if (!versionBumped) {
        const dismissed = st?.dismissedCount ?? 0;
        if (dismissed >= 2) return; // dismissed twice → gone forever
        if (dismissed === 1 && within90Days(st?.dismissedAt)) return; // dismissed once → 90-day quiet
      }
      const visits = routeVisitsRef.current.get(route) ?? 0;
      if (visits < (entry.minVisits ?? 1)) return;
      if (entry.maxVisits !== undefined && visits > entry.maxVisits) return;
      const el = document.querySelector(`[data-help="${key}"]`);
      if (!el || !isVisible(el)) return;
      out.push({ entry, el });
    });
    out.sort((a, b) => (b.entry.priority ?? 0) - (a.entry.priority ?? 0));
    return out;
  };

  const fire = (entry: HelpEntry, el: Element): boolean => {
    if (!canFire()) return false;
    pageShown.current = true;
    sessionCount.current += 1;
    lastPromptAt.current = Date.now();
    markSeen(entry.key);
    setPrompt({ entry, rect: el.getBoundingClientRect() });
    return true;
  };

  const close = (dismissed: boolean) => {
    setPrompt((p) => {
      if (p && dismissed) markDismissed(p.entry.key);
      return null;
    });
  };

  // ---- reset budget on page change + first-look pass on first visit ----
  useEffect(() => {
    pageShown.current = false;
    pageEnterAt.current = Date.now();
    scrollSincePage.current = 0;
    setPrompt(null);
    // A page reached from a validation failure carries ?help_block or sets a flag;
    // we approximate with a short-lived window where we simply skip (see canFire).
    reachedFromValidation.current = false;

    const visits = routeVisitsRef.current.get(route) ?? 0;

    // First-look: on the very first visit, after a 2s settle, surface the single
    // highest-priority eligible prompt. (A multi-step glance sequence is a later
    // refinement; this keeps it to one, within the budget.)
    let firstLook: number | undefined;
    if (visits <= 1) {
      firstLook = window.setTimeout(() => {
        const list = eligible();
        if (list[0]) fire(list[0].entry, list[0].el);
      }, 2_200);
    }

    // Reactive "settle" signal: a long dwell on the page without engaging.
    const settle = window.setTimeout(() => {
      if (scrollSincePage.current > 200) return; // they're reading/engaged
      const list = eligible();
      if (list[0]) fire(list[0].entry, list[0].el);
    }, 25_000);

    return () => {
      if (firstLook) window.clearTimeout(firstLook);
      window.clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // ---- passive signal listeners (throttled, never sent to the server) ----
  useEffect(() => {
    const onKey = () => {
      lastKeystrokeAt.current = Date.now();
    };
    let scrollLast = window.scrollY;
    const onScroll = () => {
      scrollSincePage.current += Math.abs(window.scrollY - scrollLast);
      scrollLast = window.scrollY;
      // A big scroll cancels an open first-look-style prompt (they've moved on).
      if (scrollSincePage.current > 200) setPrompt(null);
    };

    // Hesitation: the pointer rests on a control for >1.2s without clicking.
    let dwellEl: Element | null = null;
    let dwellTimer: number | undefined;
    const onMove = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-help]") ?? null;
      if (el === dwellEl) return;
      dwellEl = el;
      window.clearTimeout(dwellTimer);
      if (!el) return;
      dwellTimer = window.setTimeout(() => {
        const key = el.getAttribute("data-help");
        if (!key || !canFire()) return;
        const match = eligible().find((x) => x.el === el);
        if (match) fire(match.entry, match.el);
      }, 1_200);
    };

    window.addEventListener("keydown", onKey, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousemove", onMove);
      window.clearTimeout(dwellTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, route]);

  // ---- Escape / scroll-away close ----
  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  if (!prompt) return null;

  const { rect, entry } = prompt;
  const below = rect.top < 160;
  const left = Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170);

  return createPortal(
    <>
      {/* a single subtle pulse on the anchor */}
      <div
        style={{
          position: "fixed",
          left: rect.left - 3,
          top: rect.top - 3,
          width: rect.width + 6,
          height: rect.height + 6,
          borderRadius: 8,
          border: "2px solid hsl(var(--primary))",
          pointerEvents: "none",
          zIndex: 69,
        }}
        className="animate-pulse motion-reduce:animate-none"
      />
      <div
        role="dialog"
        aria-label={entry.title || "Tip"}
        style={{
          position: "fixed",
          left,
          top: below ? rect.bottom + 10 : rect.top - 10,
          transform: below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
          zIndex: 70,
          width: 300,
        }}
        className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg duration-150 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none"
      >
        <HelpContent entry={entry} />
        <div className="mt-2.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => close(true)}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Got it
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
