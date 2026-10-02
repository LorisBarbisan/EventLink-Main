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
  const [prompt, setPrompt] = useState<{ entry: HelpEntry; rect: DOMRect; auto?: boolean } | null>(
    null
  );

  // ---- annoyance-budget state (per page-load session) ----
  const sessionCount = useRef(0);
  const lastPromptAt = useRef(0);
  const pageShown = useRef(false);
  const pageEnterAt = useRef(Date.now());
  const lastKeystrokeAt = useRef(0);
  const scrollSincePage = useRef(0);
  const reachedFromValidation = useRef(false);
  // First-look sequence (visit 1): keys already glanced this session, whether a
  // sequence is running, and a cancel handle the signal listeners can call.
  const shownKeys = useRef<Set<string>>(new Set());
  const firstLookRunning = useRef(false);
  const cancelFirstLook = useRef<() => void>(() => {});
  const bubbleRef = useRef<HTMLDivElement>(null);
  // Struggle signal: how many times this route has been visited this page-load session.
  const navCounts = useRef<Map<string, number>>(new Map());
  // Validation-failure signal: throttle so repeated bounces don't spam.
  const lastValidationAt = useRef(0);

  const canFire = (): boolean => {
    const now = Date.now();
    if (sessionCount.current >= 3) return false; // ≤3 per session
    if (pageShown.current) return false; // ≤1 per page view
    if (now - lastPromptAt.current < 45_000) return false; // ≥45s apart
    if (now - lastKeystrokeAt.current < 2_000) return false; // not within 2s of typing
    if (now - pageEnterAt.current < 2_000) return false; // not in first 2s on a page
    if (reachedFromValidation.current) return false; // not after a validation failure
    if (firstLookRunning.current) return false; // don't overlap the first-look glances
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
      if (shownKeys.current.has(key)) return; // already shown this session (e.g. first-look)
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

  // First-look eligibility ignores visit counts (it IS the first visit) and is
  // limited to page-level or high-priority feature entries — a glance, not a tour.
  const firstLookEligible = (): Array<{ entry: HelpEntry; el: Element }> => {
    if (!registry) return [];
    const out: Array<{ entry: HelpEntry; el: Element }> = [];
    registry.forEach((raw, key) => {
      if (raw.priority === undefined) return;
      if (raw.scope !== "page" && (raw.priority ?? 0) < 8) return;
      const entry = getEntry(key);
      if (!entry) return;
      const st = keyStateRef.current.get(key);
      if (st?.completedAt || shownKeys.current.has(key)) return;
      const versionBumped = (entry.version ?? 1) > (st?.contentVersion ?? 0);
      if (!versionBumped) {
        const dismissed = st?.dismissedCount ?? 0;
        if (dismissed >= 2) return;
        if (dismissed === 1 && within90Days(st?.dismissedAt)) return;
      }
      const el = document.querySelector(`[data-help="${key}"]`);
      if (!el || !isVisible(el)) return;
      out.push({ entry, el });
    });
    out.sort((a, b) => (b.entry.priority ?? 0) - (a.entry.priority ?? 0));
    return out.slice(0, 3);
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

  // The validation-failure path is deliberately NOT gated by canFire(): it fires
  // *because* the user just typed and may be inside a dialog, and the field's help
  // is genuinely wanted at that moment. It keeps its own, gentler guards instead.
  const fireValidation = (entry: HelpEntry, el: Element): boolean => {
    const now = Date.now();
    if (bubbleRef.current) return false; // a prompt is already open — don't stack
    if (now - lastValidationAt.current < 20_000) return false; // ≥20s between bounces
    if (shownKeys.current.has(entry.key)) return false; // once per field per session
    const st = keyStateRef.current.get(entry.key);
    if ((st?.dismissedCount ?? 0) >= 2) return false; // dismissed for good — respect it
    lastValidationAt.current = now;
    lastPromptAt.current = now; // keep discovery spacing honest afterwards
    shownKeys.current.add(entry.key);
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

    // First-look (visit 1): up to three page / high-priority glances reveal in
    // sequence, 1.2s apart, each auto-dismissing after 4s. The whole sequence is
    // cancelled the moment the user clicks, types, or scrolls >200px (wired from
    // the signal effect via cancelFirstLook).
    const flTimers: number[] = [];
    let flCancelled = false;
    const stopFirstLook = () => {
      flCancelled = true;
      firstLookRunning.current = false;
      flTimers.forEach((t) => window.clearTimeout(t));
      setPrompt((p) => (p?.auto ? null : p));
    };
    cancelFirstLook.current = stopFirstLook;

    if (visits <= 1) {
      flTimers.push(
        window.setTimeout(() => {
          if (flCancelled) return;
          const list = firstLookEligible();
          if (list.length === 0) return;
          firstLookRunning.current = true;
          list.forEach((item, i) => {
            const showAt = i * 5_200; // 4s visible + 1.2s gap
            flTimers.push(
              window.setTimeout(() => {
                if (flCancelled || isOverlayOpen()) return;
                markSeen(item.entry.key);
                shownKeys.current.add(item.entry.key);
                setPrompt({
                  entry: item.entry,
                  rect: item.el.getBoundingClientRect(),
                  auto: true,
                });
              }, showAt)
            );
            flTimers.push(
              window.setTimeout(() => {
                setPrompt((p) => (p?.auto && p.entry.key === item.entry.key ? null : p));
                if (i === list.length - 1) firstLookRunning.current = false;
              }, showAt + 4_000)
            );
          });
        }, 2_200)
      );
    }

    // Reactive "settle" signal: a long dwell on the page without engaging.
    const settle = window.setTimeout(() => {
      if (scrollSincePage.current > 200) return; // they're reading/engaged
      const list = eligible();
      if (list[0]) fire(list[0].entry, list[0].el);
    }, 25_000);

    // Struggle signal: returning to the same page a third time this session,
    // suggesting they haven't found what they came for.
    navCounts.current.set(route, (navCounts.current.get(route) ?? 0) + 1);
    let repeat: number | undefined;
    if ((navCounts.current.get(route) ?? 0) >= 3) {
      repeat = window.setTimeout(() => {
        const list = eligible();
        if (list[0]) fire(list[0].entry, list[0].el);
      }, 3_000);
    }

    return () => {
      flCancelled = true;
      firstLookRunning.current = false;
      flTimers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(settle);
      if (repeat) window.clearTimeout(repeat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // ---- passive signal listeners (throttled, never sent to the server) ----
  useEffect(() => {
    const onKey = () => {
      lastKeystrokeAt.current = Date.now();
      cancelFirstLook.current(); // typing cancels the first-look glance sequence
    };
    let scrollLast = window.scrollY;
    const onScroll = () => {
      scrollSincePage.current += Math.abs(window.scrollY - scrollLast);
      scrollLast = window.scrollY;
      // A big scroll means they've moved on — cancel first-look and any glance.
      if (scrollSincePage.current > 200) {
        cancelFirstLook.current();
        setPrompt((p) => (p?.auto ? null : p));
      }
    };
    // A click anywhere but the bubble cancels first-look and dismisses a reactive prompt.
    const onDown = (e: Event) => {
      if (bubbleRef.current?.contains(e.target as Node)) return;
      cancelFirstLook.current();
      setPrompt((p) => {
        if (p && !p.auto) markDismissed(p.entry.key);
        return null;
      });
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

    // Validation-failure signal: when a form submit bounces, offer the help for
    // the first field that failed. react-hook-form flips the control's
    // aria-invalid on the next render, so we scan a beat after the submit event.
    let submitTimer: number | undefined;
    let valClear: number | undefined;
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLElement | null;
      if (!form || typeof form.querySelector !== "function") return;
      window.clearTimeout(submitTimer);
      submitTimer = window.setTimeout(() => {
        const invalid = form.querySelector('[aria-invalid="true"]');
        if (!invalid) return; // submit succeeded (or non-RHF form) — leave discovery alone
        // A real validation failure: keep unrelated discovery prompts quiet (§6) for
        // a short recovery window, but still offer the failed field's own help.
        reachedFromValidation.current = true;
        window.clearTimeout(valClear);
        valClear = window.setTimeout(() => {
          reachedFromValidation.current = false;
        }, 20_000);
        const anchor = form.querySelector('[aria-invalid="true"][data-help-field]');
        if (!anchor || !isVisible(anchor)) return;
        const key = anchor.getAttribute("data-help-field");
        if (!key) return;
        const entry = getEntry(key);
        if (!entry) return;
        fireValidation(entry, anchor);
      }, 180);
    };

    window.addEventListener("keydown", onKey, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("submit", onSubmit, true);
      window.clearTimeout(dwellTimer);
      window.clearTimeout(submitTimer);
      window.clearTimeout(valClear);
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
        ref={bubbleRef}
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
        {/* First-look glances auto-dismiss, so they carry no button. */}
        {!prompt.auto && (
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => close(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
