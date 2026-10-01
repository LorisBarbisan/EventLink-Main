import * as Popover from "@radix-ui/react-popover";
import { BUBBLE_CLASS } from "./bubbleClass";
import { HelpContent } from "./HelpContent";
import type { HelpEntry } from "./types";

/**
 * Rich hint — has a title, a link, or an action — so it must be a Popover
 * (click / tap), which is reachable by keyboard and works on touch. A tooltip
 * with a link in it is unreachable for keyboard users and invisible on a phone.
 */
export function HelpPopover({
  entry,
  children,
  side = "top",
  onOpen,
}: {
  entry: HelpEntry;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  onOpen?: () => void;
}) {
  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (open) onOpen?.();
      }}
    >
      <Popover.Trigger asChild {...(import.meta.env.DEV ? { "data-help-key": entry.key } : {})}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side={side} sideOffset={6} collisionPadding={8} className={BUBBLE_CLASS}>
          <HelpContent entry={entry} />
          <Popover.Arrow className="fill-popover" width={11} height={5} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
