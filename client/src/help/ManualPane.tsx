import { BookOpen, Lock, X } from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { HelpCtx } from "./HelpProvider";
import { manualStore, useManual } from "./manualStore";
import type { HelpEntry } from "./types";

const OVERVIEW_LABEL = "What this section is for";

function humanise(key: string): string {
  const last = key.split(".").pop() ?? key;
  const words = last.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Opens and closes the manual pane. Desktop only, like the pane itself. */
export function ManualToggle() {
  const { open } = useManual();
  return (
    <button
      type="button"
      aria-pressed={open}
      onClick={() => manualStore.setOpen(!open)}
      className={`hidden shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors lg:inline-flex ${
        open
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <BookOpen className="h-4 w-4" />
      How to
    </button>
  );
}

export function ManualPane() {
  const { open, section, hoverKey } = useManual();
  const help = useContext(HelpCtx);
  const registry = help?.registry ?? null;
  const getEntry = help?.getEntry;

  const scrollRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const [frozen, setFrozen] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const headingKey = section ? `books.section.${section}` : null;

  // A section's manual is its heading entry followed by every entry sharing the
  // section's key prefix, in manualOrder then registry order.
  const chapters = useMemo<HelpEntry[]>(() => {
    if (!registry || !getEntry || !section || !headingKey) return [];
    const prefix = `books.${section}.`;
    const rest = Array.from(registry.keys())
      .filter((k) => k.startsWith(prefix))
      .map((k) => getEntry(k))
      .filter((e): e is HelpEntry => e !== null)
      .map((e, i) => ({ e, i }))
      .sort(
        (a, b) =>
          (a.e.detail?.manualOrder ?? Infinity) - (b.e.detail?.manualOrder ?? Infinity) || a.i - b.i
      )
      .map(({ e }) => e);
    const heading = getEntry(headingKey);
    return heading ? [heading, ...rest] : rest;
  }, [registry, getEntry, section, headingKey]);

  const chapterKeys = useMemo(() => new Set(chapters.map((c) => c.key)), [chapters]);

  const scrollToKey = (key: string) => {
    const container = scrollRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-manual-anchor="${CSS.escape(key)}"]`);
    if (!container || !el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({
      top: el.offsetTop - container.offsetTop - 8,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  // New section: back to idle, at the top.
  useEffect(() => {
    setFrozen(false);
    setCurrentKey(null);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [section]);

  // Following: move to the hovered key's chapter. A key with no chapter here
  // leaves the pane where it was (dimmed, below).
  useEffect(() => {
    if (frozen || !hoverKey || !chapterKeys.has(hoverKey)) return;
    setCurrentKey(hoverKey);
    setFlashKey(hoverKey);
    scrollToKey(hoverKey);
    const t = window.setTimeout(() => setFlashKey(null), 1200);
    return () => window.clearTimeout(t);
  }, [hoverKey, frozen, chapterKeys]);

  // A click on the page toggles the freeze; Escape always resumes following.
  const active = open && !!section;
  useEffect(() => {
    if (!active) return;
    const onDown = (e: Event) => {
      const target = e.target as Element | null;
      if (target && paneRef.current?.contains(target)) return;
      if (target?.closest?.("[data-manual-toggle]")) return;
      setFrozen((f) => !f);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFrozen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [active]);

  if (!active || !headingKey) return null;

  const heading = chapters.find((c) => c.key === headingKey);
  const dimmed = !frozen && !!hoverKey && !chapterKeys.has(hoverKey);
  const titleOf = (c: HelpEntry) =>
    c.key === headingKey ? OVERVIEW_LABEL : (c.title ?? humanise(c.key));

  return (
    <aside
      ref={paneRef}
      data-manual-pane
      aria-label="How to"
      className="sticky top-0 hidden h-screen w-[380px] shrink-0 flex-col self-start border-l bg-background lg:flex"
    >
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="text-base font-semibold">{heading?.title ?? humanise(headingKey)}</h2>
        <button
          type="button"
          aria-label="Close How to"
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          onClick={() => manualStore.setOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {frozen && (
        <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-5 py-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Holding this page
          </span>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setFrozen(false)}
          >
            Resume following
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-5 py-4 transition-opacity ${dimmed ? "opacity-50" : ""}`}
      >
        {chapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {registry ? "Nothing has been written for this section yet." : "Loading…"}
          </p>
        ) : (
          <>
            <nav aria-label="Contents" className="mb-4 space-y-0.5 border-b pb-4">
              {chapters.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-current={currentKey === c.key ? "true" : undefined}
                  className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
                    currentKey === c.key
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setCurrentKey(c.key);
                    setFrozen(true);
                    scrollToKey(c.key);
                  }}
                >
                  {titleOf(c)}
                </button>
              ))}
            </nav>

            <div className="space-y-6 pb-[60vh]">
              {chapters.map((c) => (
                <section
                  key={c.key}
                  data-manual-anchor={c.key}
                  className={`-mx-2 rounded-md px-2 py-1 transition-colors duration-700 ${
                    flashKey === c.key ? "bg-primary/10" : ""
                  }`}
                >
                  <h3 className="mb-1.5 text-sm font-semibold">{titleOf(c)}</h3>
                  <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
                    <p>{c.body}</p>
                    {c.detail?.paragraphs?.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                  <ManualList label="You can" items={c.detail?.canDo} />
                  <ManualList label="You can't" items={c.detail?.cannotDo} />
                  {!!c.detail?.seeAlso?.length && (
                    <div className="mt-3 text-sm">
                      <p className="font-medium">See also</p>
                      <ul className="mt-1 space-y-0.5">
                        {c.detail.seeAlso.map((k) => {
                          const target = chapters.find((x) => x.key === k);
                          const other = target ?? getEntry?.(k);
                          if (!other) return null;
                          const label =
                            other.key === headingKey
                              ? OVERVIEW_LABEL
                              : (other.title ?? humanise(other.key));
                          return (
                            <li key={k}>
                              {target ? (
                                <button
                                  type="button"
                                  className="text-primary hover:underline"
                                  onClick={() => {
                                    setCurrentKey(k);
                                    setFrozen(true);
                                    scrollToKey(k);
                                  }}
                                >
                                  {label}
                                </button>
                              ) : (
                                <span className="text-muted-foreground">{label}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function ManualList({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3 text-sm">
      <p className="font-medium">{label}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground/90">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
