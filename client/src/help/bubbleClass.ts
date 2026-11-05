// Shared speech-bubble styling for the tooltip and popover primitives. Built on
// the existing popover theme tokens so it reads correctly in both themes, with a
// 150ms fade+rise that is removed under prefers-reduced-motion.
export const BUBBLE_CLASS =
  "z-50 max-w-[288px] rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md outline-none " +
  "duration-150 animate-in fade-in-0 slide-in-from-bottom-1 " +
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 " +
  "motion-reduce:animate-none motion-reduce:slide-in-from-bottom-0";
