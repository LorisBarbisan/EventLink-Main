import { useAuth } from "@/hooks/useAuth";
import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { HelpAuditOverlay } from "./HelpAuditOverlay";
import { HelpContent } from "./HelpContent";
import { getCachedRegistry, loadRegistry } from "./registry";
import type {
  HelpContext as HelpCtxData,
  HelpEntry,
  HelpKeyState,
  HelpMode,
  HelpOverride,
} from "./types";

interface HelpContextValue {
  enabled: boolean;
  mode: HelpMode;
  setMode: (m: HelpMode) => void;
  getEntry: (key: string) => HelpEntry | null;
  delayMs: number;
  markSeen: (key: string) => void;
  markDismissed: (key: string) => void;
  markCompleted: (key: string) => void;
}

export const HelpCtx = createContext<HelpContextValue | undefined>(undefined);

type HelpEvent =
  | { type: "seen"; key: string; count: number; version: number; at: string }
  | { type: "dismissed"; key: string; version: number; at: string }
  | { type: "completed"; key: string; at: string }
  | { type: "visit"; route: string; count: number; at: string };

// Per user × route pattern — "/jobs/412" and "/jobs/908" are the same page.
// wouter does not expose the matched pattern globally, so normalise id-like
// segments to ":id"; that collapses numeric ids and long tokens/slugs.
function routePattern(pathname: string): string {
  return (
    "/" +
    pathname
      .split("/")
      .filter(Boolean)
      .map((seg) => {
        if (/^\d+$/.test(seg)) return ":id";
        if (/^[0-9a-f-]{16,}$/i.test(seg)) return ":id";
        if (/^real-\d+$/.test(seg)) return ":id";
        return seg;
      })
      .join("/")
  ).replace(/^\/$/, "/");
}

// Eager on a first visit, reactive afterwards (epic §5.2).
function delayForVisits(visits: number): number {
  if (visits <= 1) return 150;
  if (visits <= 3) return 250;
  if (visits <= 9) return 500;
  return 700;
}

function token(): string | null {
  try {
    return localStorage.getItem("auth_token");
  } catch {
    return null;
  }
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();

  const [mode, setModeState] = useState<HelpMode>("full");
  const [registry, setRegistry] = useState<Map<string, HelpEntry> | null>(getCachedRegistry());
  const overridesRef = useRef<Map<string, HelpOverride>>(new Map());
  const [delayMs, setDelayMs] = useState(700);

  // Interaction state is write-mostly for the passive layer; keep it in refs so
  // recording a hover never triggers a re-render.
  const keyStateRef = useRef<Map<string, HelpKeyState>>(new Map());
  const routeVisitsRef = useRef<Map<string, number>>(new Map());

  const pendingSeenRef = useRef<Map<string, { count: number; version: number }>>(new Map());
  const pendingOtherRef = useRef<HelpEvent[]>([]);

  const enabled = !!user && mode !== "off";
  const storageKey = user ? `help:v1:${user.id}` : null;

  // ---- localStorage persistence (the fast path, available synchronously) ----
  const persist = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          mode,
          keyState: Object.fromEntries(keyStateRef.current),
          routeVisits: Object.fromEntries(routeVisitsRef.current),
        })
      );
    } catch {
      /* private mode / quota — help degrades to no persistence, never breaks */
    }
  }, [storageKey, mode]);

  // ---- event queue flush ----
  const flush = useCallback((keepalive = false) => {
    const events: HelpEvent[] = [];
    pendingSeenRef.current.forEach(({ count, version }, key) => {
      events.push({ type: "seen", key, count, version, at: new Date().toISOString() });
    });
    pendingSeenRef.current.clear();
    events.push(...pendingOtherRef.current);
    pendingOtherRef.current = [];
    if (events.length === 0) return;

    const t = token();
    if (!t) return;
    try {
      void fetch("/api/help/events", {
        method: "POST",
        keepalive,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ events }),
      });
    } catch {
      /* best-effort; localStorage remains the source of truth locally */
    }
  }, []);

  // ---- hydrate from localStorage, then merge server truth ----
  useEffect(() => {
    if (!user || !storageKey) return;
    // Fast path: localStorage first so the delay tier is right on first render.
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.mode) setModeState(parsed.mode);
        keyStateRef.current = new Map(Object.entries(parsed.keyState ?? {}));
        routeVisitsRef.current = new Map(Object.entries(parsed.routeVisits ?? {}));
      }
    } catch {
      /* ignore */
    }

    // Load the registry off the critical path.
    const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
    idle(() => {
      loadRegistry()
        .then(setRegistry)
        .catch(() => {});
    });

    // Server is cross-device truth; merge it over the local fast path.
    const t = token();
    if (t) {
      const auth = { Authorization: `Bearer ${t}` };
      fetch("/api/help/state", { headers: auth })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          if (data.mode) setModeState(data.mode);
          for (const [key, s] of Object.entries<any>(data.entries ?? {})) {
            const local = keyStateRef.current.get(key);
            keyStateRef.current.set(key, {
              seenCount: Math.max(local?.seenCount ?? 0, s.seenCount ?? 0),
              lastSeenAt: s.lastSeenAt ?? local?.lastSeenAt ?? null,
              dismissedCount: Math.max(local?.dismissedCount ?? 0, s.dismissedCount ?? 0),
              dismissedAt: s.dismissedAt ?? local?.dismissedAt ?? null,
              completedAt: s.completedAt ?? local?.completedAt ?? null,
              contentVersion: s.contentVersion ?? local?.contentVersion ?? 1,
            });
          }
          for (const [route, count] of Object.entries<number>(data.routes ?? {})) {
            routeVisitsRef.current.set(
              route,
              Math.max(routeVisitsRef.current.get(route) ?? 0, count)
            );
          }
          persist();
        })
        .catch(() => {});

      fetch("/api/help/content", { headers: auth })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.overrides) return;
          overridesRef.current = new Map(data.overrides.map((o: HelpOverride) => [o.key, o]));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---- route visit tracking + delay tier ----
  useEffect(() => {
    if (!user) return;
    const pattern = routePattern(location);
    const next = (routeVisitsRef.current.get(pattern) ?? 0) + 1;
    routeVisitsRef.current.set(pattern, next);
    setDelayMs(delayForVisits(next));
    pendingOtherRef.current.push({
      type: "visit",
      route: pattern,
      count: next,
      at: new Date().toISOString(),
    });
    persist();
    flush(); // flush on route change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, user?.id]);

  // ---- periodic flush + flush on tab hide (auth-safe keepalive fetch) ----
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => flush(), 10_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    window.addEventListener("pagehide", () => flush(true));
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---- entry resolution (audience / tier / showWhen + override merge) ----
  const getEntry = useCallback(
    (key: string): HelpEntry | null => {
      const reg = registry;
      if (!reg) return null;
      const base = reg.get(key);
      if (!base) return null;

      const role = user?.role as HelpCtxData["role"] | undefined;
      if (base.audience && role && !base.audience.includes(role)) return null;

      const userTier = ((user as any)?.subscription_tier ?? "free") as "free" | "pro";
      if (base.tier === "pro" && userTier !== "pro") return null;

      if (
        base.showWhen &&
        !base.showWhen({ role, tier: userTier, route: routePattern(location) })
      ) {
        return null;
      }

      const ov = overridesRef.current.get(key);
      if (ov) {
        return {
          ...base,
          title: ov.title ?? base.title,
          body: ov.body ?? base.body,
          learnMoreHref: ov.learn_more_href ?? base.learnMoreHref,
          version: ov.version ?? base.version,
        };
      }
      return base;
    },
    [registry, user, location]
  );

  const markSeen = useCallback(
    (key: string) => {
      const prev = keyStateRef.current.get(key);
      const version = getEntry(key)?.version ?? 1;
      const next: HelpKeyState = {
        seenCount: (prev?.seenCount ?? 0) + 1,
        lastSeenAt: new Date().toISOString(),
        dismissedCount: prev?.dismissedCount ?? 0,
        dismissedAt: prev?.dismissedAt ?? null,
        completedAt: prev?.completedAt ?? null,
        contentVersion: version,
      };
      keyStateRef.current.set(key, next);
      // Deduplicate: many hovers of one key collapse into one event with a count.
      pendingSeenRef.current.set(key, { count: next.seenCount, version });
      persist();
    },
    [getEntry, persist]
  );

  const markDismissed = useCallback(
    (key: string) => {
      const prev = keyStateRef.current.get(key);
      const version = getEntry(key)?.version ?? 1;
      keyStateRef.current.set(key, {
        seenCount: prev?.seenCount ?? 0,
        lastSeenAt: prev?.lastSeenAt ?? null,
        dismissedCount: (prev?.dismissedCount ?? 0) + 1,
        dismissedAt: prev?.dismissedAt ?? new Date().toISOString(),
        completedAt: prev?.completedAt ?? null,
        contentVersion: version,
      });
      pendingOtherRef.current.push({
        type: "dismissed",
        key,
        version,
        at: new Date().toISOString(),
      });
      persist();
    },
    [getEntry, persist]
  );

  const markCompleted = useCallback(
    (key: string) => {
      const prev = keyStateRef.current.get(key);
      if (prev?.completedAt) return;
      keyStateRef.current.set(key, {
        seenCount: prev?.seenCount ?? 0,
        lastSeenAt: prev?.lastSeenAt ?? null,
        dismissedCount: prev?.dismissedCount ?? 0,
        dismissedAt: prev?.dismissedAt ?? null,
        completedAt: new Date().toISOString(),
        contentVersion: prev?.contentVersion ?? 1,
      });
      pendingOtherRef.current.push({ type: "completed", key, at: new Date().toISOString() });
      persist();
    },
    [persist]
  );

  const setMode = useCallback(
    (m: HelpMode) => {
      setModeState(m);
      persist();
      const t = token();
      if (t) {
        void fetch("/api/help/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ mode: m }),
        }).catch(() => {});
      }
    },
    [persist]
  );

  const value: HelpContextValue = {
    enabled,
    mode,
    setMode,
    getEntry,
    delayMs,
    markSeen,
    markDismissed,
    markCompleted,
  };

  return (
    <HelpCtx.Provider value={value}>
      {children}
      {enabled && <DataHelpBubble getEntry={getEntry} onSeen={markSeen} delayMs={delayMs} />}
      {import.meta.env.DEV && <HelpAuditOverlay registry={registry} />}
    </HelpCtx.Provider>
  );
}

// ---- The `data-help` delegated bubble (retrofit / anchor path) ----
// One set of listeners for the whole app resolves the key of any element
// carrying `data-help`. It behaves like a hover-card: it waits the delay tier
// before appearing, opens once per element (not on every mouse move), stays put
// while the pointer moves into it so links/buttons are reachable, and counts a
// "seen" only once per open.
function DataHelpBubble({
  getEntry,
  onSeen,
  delayMs,
}: {
  getEntry: (key: string) => HelpEntry | null;
  onSeen: (key: string) => void;
  delayMs: number;
}) {
  const [active, setActive] = useState<{ entry: HelpEntry; rect: DOMRect; key: string } | null>(
    null
  );
  const bubbleRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  // The element the bubble is currently open/opening for — used so re-hovering
  // the same control doesn't re-open or re-count.
  const anchorRef = useRef<Element | null>(null);

  useEffect(() => {
    const clearOpen = () => window.clearTimeout(openTimer.current);
    const clearClose = () => window.clearTimeout(closeTimer.current);

    const scheduleClose = () => {
      clearOpen();
      clearClose();
      closeTimer.current = window.setTimeout(() => {
        anchorRef.current = null;
        setActive(null);
      }, 220);
    };

    const openFor = (el: Element) => {
      const key = el.getAttribute("data-help");
      if (!key) return;
      if (anchorRef.current === el) {
        clearClose(); // already open/opening for this element — just cancel any close
        return;
      }
      const entry = getEntry(key);
      if (!entry) return;
      anchorRef.current = el;
      clearClose();
      clearOpen();
      openTimer.current = window.setTimeout(
        () => {
          setActive({ entry, rect: el.getBoundingClientRect(), key });
          onSeen(key); // count once, when it actually appears
        },
        Math.max(80, delayMs)
      );
    };

    const onOver = (e: Event) => {
      const target = e.target as Element | null;
      if (bubbleRef.current && target && bubbleRef.current.contains(target)) {
        clearClose();
        return;
      }
      const el = target?.closest?.("[data-help]");
      if (el) openFor(el);
      else if (!anchorRef.current) scheduleClose();
    };

    const onOut = (e: Event) => {
      const to = (e as MouseEvent).relatedTarget as Node | null;
      // Keep open while moving within the anchor, or into the bubble.
      if (to && anchorRef.current?.contains(to)) return;
      if (to && bubbleRef.current?.contains(to)) {
        clearClose();
        return;
      }
      scheduleClose();
    };

    const onFocus = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.("[data-help]");
      if (el) openFor(el);
    };
    const onBlur = () => scheduleClose();

    // A click on the control (not inside the bubble) dismisses the hint.
    const onDown = (e: Event) => {
      const target = e.target as Node | null;
      if (target && bubbleRef.current?.contains(target)) return;
      clearOpen();
      clearClose();
      anchorRef.current = null;
      setActive(null);
    };
    const onScroll = () => {
      clearOpen();
      anchorRef.current = null;
      setActive(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        anchorRef.current = null;
        setActive(null);
      }
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      clearOpen();
      clearClose();
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [getEntry, onSeen, delayMs]);

  if (!active) return null;

  const { rect, entry } = active;
  // Place above the element; flip below when there isn't room. Never covers it.
  const below = rect.top < 140;
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
    top: below ? rect.bottom + 6 : rect.top - 6,
    transform: below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
    zIndex: 60,
  };

  return (
    <div
      ref={bubbleRef}
      role="tooltip"
      style={style}
      onMouseEnter={() => window.clearTimeout(closeTimer.current)}
      className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md duration-150 animate-in fade-in-0 motion-reduce:animate-none"
    >
      <HelpContent entry={entry} />
    </div>
  );
}
