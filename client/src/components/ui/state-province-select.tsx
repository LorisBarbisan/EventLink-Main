import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// US states + DC and Canadian provinces + territories. Values are the full
// names (stored in profile.state_province).
export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

export const CANADA_PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

/** Countries that require a state/province selection, with their config. */
export const STATE_PROVINCE_COUNTRIES: Record<
  string,
  { label: string; placeholder: string; searchPlaceholder: string; options: string[] }
> = {
  "United States": {
    label: "State",
    placeholder: "Select a state...",
    searchPlaceholder: "Search states...",
    options: US_STATES,
  },
  Canada: {
    label: "Province or Territory",
    placeholder: "Select a province or territory...",
    searchPlaceholder: "Search provinces...",
    options: CANADA_PROVINCES,
  },
};

/** Whether a given country needs a state/province field. */
export function countryNeedsStateProvince(country: string | undefined | null): boolean {
  return !!country && country in STATE_PROVINCE_COUNTRIES;
}

interface StateProvinceSelectProps {
  country: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

export function StateProvinceSelect({
  country,
  value,
  onChange,
  id,
  className,
}: StateProvinceSelectProps) {
  const config = STATE_PROVINCE_COUNTRIES[country];
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!config) return null;

  const filtered = search
    ? config.options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : config.options;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value || config.placeholder}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={config.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No results found.</li>
            ) : (
              filtered.map((o) => (
                <li
                  key={o}
                  role="option"
                  aria-selected={value === o}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                    value === o && "bg-accent/50"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(o);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="flex-1">{o}</span>
                  {value === o && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
