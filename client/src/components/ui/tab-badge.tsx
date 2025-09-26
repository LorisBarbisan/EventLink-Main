import { cn } from "@/lib/utils";

interface TabBadgeProps {
  count: number;
  className?: string;
  maxCount?: number;
}

export function TabBadge({ count, className, maxCount = 99 }: TabBadgeProps) {
  if (count === 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[1.25rem] h-5 px-1.5",
        "text-xs font-medium text-white",
        "bg-destructive rounded-full",
        "ml-2 border-2 border-background",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className
      )}
      data-testid={`badge-count-${count}`}
    >
      {displayCount}
    </span>
  );
}