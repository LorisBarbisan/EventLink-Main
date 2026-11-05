import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";

// ============================================================
// The insurance login reminder — a deliberately RECURRING nudge.
//
// Unlike the discovery layer (one-shot, budgeted, dismiss-for-good), this is a
// standing reminder the business wants shown on every fresh dashboard visit:
// a brief, small cloud pointing at the header's Insurance Offers button. It is
// therefore intentionally exempt from the §6 annoyance budget. It still behaves:
// it shows once per app load (i.e. per login, not on every in-app navigation),
// auto-dismisses after a few seconds, and closes on any click.
//
// It anchors to whichever insurance button is actually on screen, so it only
// ever appears for users who have that button (UK freelancers) — no audience
// logic is duplicated here.
// ============================================================

const DASHBOARD_ROUTE = "/dashboard";
const VISIBLE_MS = 6_500;
const ANCHOR_SELECTOR =
  '[data-testid="button-insurance-offers"],[data-testid="button-insurance-offers-mobile"]';

function visibleAnchor(): Element | null {
  const candidates = Array.from(document.querySelectorAll(ANCHOR_SELECTOR));
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if ((el as HTMLElement).offsetParent === null) continue;
    return el;
  }
  return null;
}

export function InsuranceReminder({ route }: { route: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Once per app load (login). The provider stays mounted across route changes,
  // so this ref is only reset by a full reload — exactly "once per login".
  const shownRef = useRef(false);

  useEffect(() => {
    if (route !== DASHBOARD_ROUTE || shownRef.current) return;

    // The header renders a beat after the dashboard; poll briefly for the button
    // and give up quietly if it never appears (e.g. not a UK freelancer).
    let tries = 0;
    let hideTimer: number | undefined;
    const poll = window.setInterval(() => {
      tries += 1;
      const el = visibleAnchor();
      if (el) {
        window.clearInterval(poll);
        shownRef.current = true;
        setRect(el.getBoundingClientRect());
        hideTimer = window.setTimeout(() => setRect(null), VISIBLE_MS);
      } else if (tries >= 20) {
        window.clearInterval(poll); // ~6s of trying — button isn't here
      }
    }, 300);

    return () => {
      window.clearInterval(poll);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [route]);

  // While shown, keep the cloud pinned to the button and dismiss on any click.
  useEffect(() => {
    if (!rect) return;
    const reposition = () => {
      const el = visibleAnchor();
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const dismiss = () => setRect(null);
    window.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("resize", reposition, { passive: true });
    document.addEventListener("pointerdown", dismiss, true);
    return () => {
      window.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("pointerdown", dismiss, true);
    };
  }, [rect]);

  if (!rect) return null;

  // The button sits in the header, so the cloud always drops below it.
  const left = Math.min(Math.max(rect.left + rect.width / 2, 130), window.innerWidth - 130);

  return createPortal(
    <>
      <div
        style={{
          position: "fixed",
          left: rect.left - 3,
          top: rect.top - 3,
          width: rect.width + 6,
          height: rect.height + 6,
          borderRadius: 10,
          border: "2px solid hsl(var(--primary))",
          pointerEvents: "none",
          zIndex: 69,
        }}
        className="animate-pulse motion-reduce:animate-none"
      />
      <div
        role="status"
        style={{
          position: "fixed",
          left,
          top: rect.bottom + 10,
          transform: "translate(-50%, 0)",
          zIndex: 70,
          width: 240,
        }}
        className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg duration-150 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
      >
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold leading-tight">Insurance Offers</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cover deals for UK freelancers — worth a look.
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
