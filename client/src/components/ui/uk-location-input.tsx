import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UKLocation {
  display_name: string;
  name: string;
  county?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  formatted: string;
  lat: string;
  lon: string;
}

interface UKLocationInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string, locationData?: UKLocation) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  "data-testid"?: string;
}

export function UKLocationInput({
  id,
  label,
  value,
  onChange,
  placeholder = "Start typing a location...",
  className,
  required,
  "data-testid": testId,
}: UKLocationInputProps) {
  const [suggestions, setSuggestions] = useState<UKLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [hasValidSelection, setHasValidSelection] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const cacheRef = useRef<Map<string, UKLocation[]>>(new Map());
  const lastQueryRef = useRef<string>("");

  // Format location for display and storage
  const formatLocation = (location: UKLocation): string => {
    const parts = [];

    // Add city/town/village
    if (location.city) parts.push(location.city);
    else if (location.town) parts.push(location.town);
    else if (location.village) parts.push(location.village);
    else if (location.name && !location.postcode) parts.push(location.name);

    // Add county if available
    if (location.county && !parts.includes(location.county)) {
      parts.push(location.county);
    }

    // Add postcode if available
    if (location.postcode) {
      parts.push(location.postcode);
    }

    return parts.join(", ");
  };

  // Search UK locations using API with client-side caching
  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();

    // Check client-side cache first
    const cached = cacheRef.current.get(normalizedQuery);
    if (cached) {
      setSuggestions(cached);
      setShowSuggestions(true);
      return;
    }

    // Avoid duplicate requests for the same query
    if (lastQueryRef.current === normalizedQuery) {
      return;
    }
    lastQueryRef.current = normalizedQuery;

    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`/api/locations/search?query=${encodeURIComponent(query)}`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error("Server error - location service temporarily unavailable");
        } else if (response.status === 400) {
          throw new Error("Invalid search query");
        } else {
          throw new Error("Location service unavailable");
        }
      }

      const data = await response.json();

      // Validate response format
      if (!Array.isArray(data)) {
        throw new Error("Invalid response format");
      }

      const locations: UKLocation[] = data.map((item: any) => ({
        display_name: item.display_name,
        name: item.name,
        county: item.address?.county,
        postcode: item.address?.postcode,
        city: item.address?.city,
        town: item.address?.town,
        village: item.address?.village,
        formatted: formatLocation({
          display_name: item.display_name,
          name: item.name,
          county: item.address?.county,
          postcode: item.address?.postcode,
          city: item.address?.city,
          town: item.address?.town,
          village: item.address?.village,
          formatted: "",
          lat: item.lat,
          lon: item.lon,
        }),
        lat: item.lat,
        lon: item.lon,
      }));

      // Cache the results
      cacheRef.current.set(normalizedQuery, locations);

      // Limit cache size to prevent memory issues
      if (cacheRef.current.size > 100) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) {
          cacheRef.current.delete(firstKey);
        }
      }

      setSuggestions(locations);
      setShowSuggestions(true);
    } catch (err) {
      console.error("Location search error:", err);
      setError("Location service unavailable. You can still enter manually.");
      setSuggestions([]);
    } finally {
      setIsLoading(false);
      lastQueryRef.current = "";
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setHasValidSelection(false);
    setError(null);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search requests - increased to 500ms for better performance
    debounceRef.current = setTimeout(() => {
      searchLocations(newValue);
    }, 500);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (location: UKLocation) => {
    const formattedValue = location.formatted;
    onChange(formattedValue, location);
    setHasValidSelection(true);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Validate on blur
  const handleBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is inside the suggestions dropdown
    const relatedTarget = e.relatedTarget as Node | null;
    if (suggestionsRef.current && relatedTarget && suggestionsRef.current.contains(relatedTarget)) {
      return;
    }

    // Delay to allow click on suggestions to complete
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);

      // Only validate if user entered something and it's not from a valid selection
      if (
        value.trim() &&
        !hasValidSelection &&
        value.length >= 3 &&
        suggestions.length === 0 &&
        !isLoading
      ) {
        setError("Location not found. Please check spelling or try a different format");
      }
    }, 300);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full">
      {label && (
        <Label htmlFor={id} className="mb-1 block">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </Label>
      )}

      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder={placeholder}
          className={cn(
            "pr-10",
            error && "border-red-500 focus:border-red-500",
            hasValidSelection && "border-green-500",
            className
          )}
          data-testid={testId}
          autoComplete="off"
        />

        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : hasValidSelection ? (
            <MapPin className="h-4 w-4 text-green-500" />
          ) : error ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {suggestions.map((location, index) => (
            <button
              key={`${location.lat}-${location.lon}-${index}`}
              type="button"
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700",
                selectedIndex === index && "bg-gray-100 dark:bg-gray-700"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionSelect(location)}
              data-testid={`suggestion-${index}`}
            >
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{location.formatted}</div>
                {location.display_name !== location.formatted && (
                  <div className="truncate text-xs text-muted-foreground">
                    {location.display_name}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
