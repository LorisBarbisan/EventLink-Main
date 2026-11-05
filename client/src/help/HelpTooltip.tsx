import * as Tooltip from "@radix-ui/react-tooltip";
import { BUBBLE_CLASS } from "./bubbleClass";
import { HelpContent } from "./HelpContent";
import type { HelpEntry } from "./types";

/**
 * Short, text-only field hint. Opens on hover AND keyboard focus, closes on
 * Escape (Radix handles the aria-describedby contract). Never used for content
 * with a link or button — that is a HelpPopover.
 */
export function HelpTooltip({
  entry,
  children,
  side = "top",
  delayMs = 300,
  onOpen,
}: {
  entry: HelpEntry;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  delayMs?: number;
  onOpen?: () => void;
}) {
  return (
    <Tooltip.Root
      delayDuration={delayMs}
      onOpenChange={(open) => {
        if (open) onOpen?.();
      }}
    >
      <Tooltip.Trigger asChild {...(import.meta.env.DEV ? { "data-help-key": entry.key } : {})}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={6} collisionPadding={8} className={BUBBLE_CLASS}>
          <HelpContent entry={entry} />
          <Tooltip.Arrow className="fill-popover" width={11} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
