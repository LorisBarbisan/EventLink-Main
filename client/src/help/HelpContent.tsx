import type { HelpEntry } from "./types";

/**
 * Presentational speech-bubble content, shared by the tooltip, popover and the
 * delegated `data-help` bubble. Uses the existing popover theme tokens so it
 * reads correctly in both light and dark.
 */
export function HelpContent({ entry }: { entry: HelpEntry }) {
  return (
    <div className="max-w-[280px] space-y-1">
      {entry.title && <p className="text-sm font-medium leading-snug">{entry.title}</p>}
      <p className="text-sm leading-snug text-popover-foreground/90">{entry.body}</p>
      {entry.learnMoreHref && (
        <a
          href={entry.learnMoreHref}
          className="inline-block pt-0.5 text-xs font-medium text-primary hover:underline"
        >
          Learn more →
        </a>
      )}
    </div>
  );
}
