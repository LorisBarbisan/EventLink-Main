import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UKLocation {
  display_name: string
  name: string
  county?: string
  postcode?: string
  city?: string
  town?: string
  village?: string
  formatted: string
  lat: string
  lon: string
}

interface UKLocationInputProps {
  id?: string
  label?: string
  value: string
  onChange: (value: string, locationData?: UKLocation) => void
  placeholder?: string
  className?: string
  required?: boolean
  'data-testid'?: string
}

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i

export function UKLocationInput({
  id,
  label,
  value,
  onChange,
  placeholder = "Start typing a UK location...",
  className,
  required,
  'data-testid': testId
}: UKLocationInputProps) {
  const [suggestions, setSuggestions] = useState<UKLocation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const [hasValidSelection, setHasValidSelection] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Check if input looks like a postcode
  const isPostcodeInput = (input: string) => {
    const cleaned = input.replace(/\s/g, '').toUpperCase()
    return cleaned.length >= 2 && /^[A-Z]{1,2}[0-9]/.test(cleaned)
  }

  // Validate UK postcode format
  const isValidUKPostcode = (postcode: string) => {
    return UK_POSTCODE_REGEX.test(postcode.trim())
  }

  // Format location for display and storage
  const formatLocation = (location: UKLocation): string => {
    const parts = []
    
    // Add city/town/village
    if (location.city) parts.push(location.city)
    else if (location.town) parts.push(location.town)
    else if (location.village) parts.push(location.village)
    else if (location.name && !location.postcode) parts.push(location.name)
    
    // Add county if available
    if (location.county && !parts.includes(location.county)) {
      parts.push(location.county)
    }
    
    // Add postcode if available
    if (location.postcode) {
      parts.push(location.postcode)
    }
    
    return parts.join(', ')
  }

  // Search UK locations using Nominatim API
  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/locations/search?q=${encodeURIComponent(query)}`
      )

      if (!response.ok) {
        throw new Error('Location service unavailable')
      }

      const data = await response.json()
      
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
          formatted: '',
          lat: item.lat,
          lon: item.lon
        }),
        lat: item.lat,
        lon: item.lon
      }))

      setSuggestions(locations)
      setShowSuggestions(true)
    } catch (err) {
      console.error('Location search error:', err)
      setError('Location service unavailable. You can still enter manually.')
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle input change with debouncing
  const handleInputChange = (newValue: string) => {
    onChange(newValue)
    setHasValidSelection(false)
    setError(null)

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce search requests
    debounceRef.current = setTimeout(() => {
      searchLocations(newValue)
    }, 300)
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (location: UKLocation) => {
    const formattedValue = location.formatted
    onChange(formattedValue, location)
    setHasValidSelection(true)
    setShowSuggestions(false)
    setSuggestions([])
    setSelectedIndex(-1)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Validate on blur
  const handleBlur = () => {
    // Small delay to allow click on suggestions
    setTimeout(() => {
      setShowSuggestions(false)
      setSelectedIndex(-1)
      
      // Only validate if user entered something and it's not from a valid selection
      if (value.trim() && !hasValidSelection) {
        // Check if it looks like a postcode
        if (isPostcodeInput(value) && !isValidUKPostcode(value)) {
          setError('Please enter a valid UK postcode')
        } else if (value.length >= 3 && suggestions.length === 0 && !isLoading) {
          setError('Location not found. Please check spelling or try a different format')
        }
      }
    }, 150)
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div className="relative w-full">
      {label && (
        <Label htmlFor={id} className="mb-1 block">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
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
            if (suggestions.length > 0) setShowSuggestions(true)
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
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
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
        <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg dark:bg-gray-800 dark:border-gray-700"
        >
          {suggestions.map((location, index) => (
            <button
              key={`${location.lat}-${location.lon}-${index}`}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-start gap-2",
                selectedIndex === index && "bg-gray-100 dark:bg-gray-700"
              )}
              onClick={() => handleSuggestionSelect(location)}
              data-testid={`suggestion-${index}`}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {location.formatted}
                </div>
                {location.display_name !== location.formatted && (
                  <div className="text-xs text-muted-foreground truncate">
                    {location.display_name}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}