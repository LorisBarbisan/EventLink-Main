import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LocationResult {
  display_name: string;
  name: string;
  country: string;
  country_code: string;
  formatted: string;
  lat: string;
  lon: string;
}

interface GlobalLocationInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string, locationData?: LocationResult) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  countryCode?: string; // restrict to a specific country
  "data-testid"?: string;
}

export function GlobalLocationInput({
  id,
  label,
  value,
  onChange,
  placeholder = "Start typing a city or location...",
  className,
  required,
  countryCode,
  "data-testid": testId,
}: GlobalLocationInputProps) {
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, LocationResult[]>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const cacheKey = `${q}:${countryCode || ""}`;
    if (cacheRef.current.has(cacheKey)) {
      setSuggestions(cacheRef.current.get(cacheKey)!);
      setOpen(true);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ query: q });
      if (countryCode) params.set("countryCode", countryCode);
      const res = await fetch(`/api/locations/search?${params.toString()}`);
      if (res.ok) {
        const data: LocationResult[] = await res.json();
        cacheRef.current.set(cacheKey, data);
        setSuggestions(data);
        setOpen(data.length > 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 300);
  };

  const handleSelect = (loc: LocationResult) => {
    setInputValue(loc.name);
    onChange(loc.name, loc);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && (
        <Label htmlFor={id} className="mb-1 block">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          data-testid={testId}
          value={inputValue}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-8"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {suggestions.map((loc, i) => (
            <li
              key={i}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(loc);
              }}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{loc.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
