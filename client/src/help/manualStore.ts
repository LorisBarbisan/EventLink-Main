import { useSyncExternalStore } from "react";

// Shared state for the Books manual pane. The pane lives in Layout, the open
// button and the current section live in BooksTab, and the hovered key comes
// from the help provider's delegated listener — a module store joins the three.

interface ManualState {
  open: boolean;
  /** Current Books section, or null when Books is not on screen. */
  section: string | null;
  /** Key of the annotated element under the pointer, after the hover delay. */
  hoverKey: string | null;
}

const STORAGE_KEY = "books.manual.open";

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let state: ManualState = { open: readOpen(), section: null, hoverKey: null };
const listeners = new Set<() => void>();

function update(patch: Partial<ManualState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const manualStore = {
  setOpen(open: boolean) {
    try {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* not persisted — the pane still works for this visit */
    }
    update({ open });
  },
  setSection(section: string | null) {
    if (section !== state.section) update({ section, hoverKey: null });
  },
  setHoverKey(hoverKey: string | null) {
    if (hoverKey !== state.hoverKey) update({ hoverKey });
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useManual(): ManualState {
  return useSyncExternalStore(subscribe, () => state);
}
