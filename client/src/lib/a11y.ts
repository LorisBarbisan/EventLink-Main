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
