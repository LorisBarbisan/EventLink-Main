import { HelpPopover } from "./HelpPopover";
import { HelpTooltip } from "./HelpTooltip";
import { useHelp } from "./useHelp";

/**
 * Explicit, typed help wrapper — the default for new work.
 *
 *   <Help k="jobs.filter.radius"><RadiusSlider /></Help>
 *
 * `children` is cloned with the Radix trigger props (via `asChild`), so <Help>
 * adds no DOM node and cannot disturb layout. When help is disabled — logged
 * out, switched off, or no registry entry — it returns the child untouched with
 * zero listeners attached.
 */
export function Help({
  k,
  children,
  side = "top",
  disabled,
}: {
  k: string;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}) {
  const { entry, delayMs, enabled, markSeen } = useHelp(k);
  if (!enabled || disabled || !entry) return children;

  const rich = Boolean(entry.title || entry.learnMoreHref);
  return rich ? (
    <HelpPopover entry={entry} side={side} onOpen={markSeen}>
      {children}
    </HelpPopover>
  ) : (
    <HelpTooltip entry={entry} side={side} delayMs={delayMs} onOpen={markSeen}>
      {children}
    </HelpTooltip>
  );
}
