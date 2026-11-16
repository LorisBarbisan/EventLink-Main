import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterOptions } from "@/lib/search";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  /** Dimmer second line, also searched. */
  sublabel?: string;
  /** Extra text to match on that isn't shown: references, emails, serials. */
  keywords?: (string | null | undefined)[];
  icon?: ReactNode;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Shown above the results and never filtered out — e.g. "Not linked". */
  pinned?: SearchableOption[];
  /** Hide pinned options while a search is typed. */
  hidePinnedWhileSearching?: boolean;
  /** Below this many options the search box is not shown. */
  minOptionsForSearch?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Type to search",
  emptyLabel = "No matches",
  pinned = [],
  hidePinnedWhileSearching = false,
  minOptionsForSearch = 8,
  disabled,
  id,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const showSearch = options.length >= minOptionsForSearch;

  // Filtering narrows the list; it never reorders it.
  const filtered = useMemo(() => filterOptions(options, search), [options, search]);
  const visiblePinned = search && hidePinnedWhileSearching ? [] : pinned;
  const items = [...visiblePinned, ...filtered];

  // An empty value shows the placeholder, even when a pinned option carries "".
  const selected = value ? [...pinned, ...options].find((o) => o.value === value) : undefined;

  useEffect(() => {
    if (!open) return;
    setSearch("");
    const i = [...pinned, ...options].findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && search) setActive(0);
  }, [search, open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(items.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) choose(item.value);
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
            triggerClassName
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (showSearch ? searchRef.current : listRef.current)?.focus();
        }}
        onKeyDown={onKeyDown}
      >
        {showSearch && (
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              role="searchbox"
              aria-controls={listId}
              aria-activedescendant={items[active] ? optionId(active) : undefined}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={showSearch ? -1 : 0}
          aria-activedescendant={!showSearch && items[active] ? optionId(active) : undefined}
          className="max-h-72 overflow-y-auto py-1 outline-none"
        >
          {items.map((o, i) => {
            const isPinned = i < visiblePinned.length;
            const isSelected = o.value === value;
            return (
              <li
                key={`${isPinned ? "p" : "o"}-${o.value}`}
                id={optionId(i)}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm",
                  i === active && "bg-accent text-accent-foreground",
                  isPinned && "text-muted-foreground",
                  isPinned && i === visiblePinned.length - 1 && filtered.length > 0 && "border-b"
                )}
              >
                {o.icon}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.sublabel && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.sublabel}
                    </span>
                  )}
                </span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
