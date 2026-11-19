import type { KeyboardEvent, MouseEvent } from "react";

/**
 * Props that make a non-button element behave like a button for keyboard and
 * screen-reader users: focusable, announced as a button, activated by Enter
 * or Space. Use only when the element contains no other interactive element
 * (a control inside a control is invalid); otherwise use a real <button>.
 */
export function pressable(
  onActivate: (e: MouseEvent | KeyboardEvent) => void,
  opts: { role?: "button" | "radio" | "tab" | "link"; label?: string } = {}
) {
  return {
    role: opts.role ?? "button",
    tabIndex: 0,
    "aria-label": opts.label,
    onClick: (e: MouseEvent) => onActivate(e),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate(e);
      }
    },
  } as const;
}

/**
 * Keyboard-only activation, for the readable part of a row whose whole
 * surface already handles the mouse click (and which also holds other
 * controls, so the row itself can't be a button). Focusable, announced as a
 * button, Enter/Space call fn; no onClick, so a mouse click isn't doubled.
 */
export function keyActivate(fn: () => void, opts: { label?: string; expanded?: boolean } = {}) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": opts.label,
    "aria-expanded": opts.expanded,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        fn();
      }
    },
  } as const;
}
