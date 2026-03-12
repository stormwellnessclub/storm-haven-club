import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  count?: number;
}

const sizeMap = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-6 w-6" };

export function StarRating({ rating, onRate, size = "md", showValue, count }: StarRatingProps) {
  const iconClass = sizeMap[size];
  const interactive = !!onRate;

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onRate?.(star)}
            className={cn(
              "p-0 border-0 bg-transparent transition-colors",
              interactive && "cursor-pointer hover:scale-110"
            )}
          >
            <Star
              className={cn(
                iconClass,
                star <= rating
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/30"
              )}
            />
          </button>
        ))}
      </div>
      {showValue && rating > 0 && (
        <span className="text-sm font-medium text-foreground ml-1">{rating.toFixed(1)}</span>
      )}
      {count !== undefined && (
        <span className="text-xs text-muted-foreground ml-0.5">({count})</span>
      )}
    </div>
  );
}
