import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  setRating?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showCount?: boolean;
  count?: number;
}

export function StarRating({ 
  rating, 
  setRating, 
  readonly = false, 
  size = 'md',
  className,
  showCount = false,
  count
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number>(0);
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const handleClick = (value: number) => {
    if (!readonly && setRating) {
      setRating(value);
    }
  };

  const handleMouseEnter = (value: number) => {
    if (!readonly) {
      setHoverRating(value);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(0);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={cn(
              "transition-colors",
              !readonly && "hover:scale-110 cursor-pointer",
              readonly && "cursor-default"
            )}
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onMouseLeave={handleMouseLeave}
            disabled={readonly}
            data-testid={`star-${star}`}
          >
            <Star
              className={cn(
                sizeClasses[size],
                "transition-colors",
                star <= displayRating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 hover:text-yellow-300"
              )}
            />
          </button>
        ))}
      </div>
      
      {showCount && count !== undefined && (
        <span className="text-sm text-muted-foreground ml-2">
          ({count} {count === 1 ? 'rating' : 'ratings'})
        </span>
      )}
      
      {rating > 0 && !showCount && (
        <span className="text-sm text-muted-foreground ml-1">
          {rating}/5
        </span>
      )}
    </div>
  );
}

interface RatingDisplayProps {
  average: number;
  count: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export function RatingDisplay({ 
  average, 
  count, 
  size = 'md', 
  className,
  showText = true 
}: RatingDisplayProps) {
  if (count === 0) {
    return (
      <div className={cn("inline-flex items-center gap-2 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-800", className)}>
        <StarRating rating={0} readonly size={size} />
        {showText && (
          <span className="text-sm text-muted-foreground font-medium">No ratings yet</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2 px-2 py-1 rounded-md bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200/50 dark:border-yellow-700/50", className)}>
      <StarRating rating={Math.round(average)} readonly size={size} />
      {showText && (
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
            {average.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            ({count} {count === 1 ? 'rating' : 'ratings'})
          </span>
        </div>
      )}
    </div>
  );
}