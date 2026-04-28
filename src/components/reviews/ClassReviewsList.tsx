import { useState } from "react";
import { useClassReviewsForType, useAdminUpdateReviewVisibility } from "@/hooks/useClassReviews";
import { StarRating } from "./StarRating";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";
import { format, parseISO } from "date-fns";

interface ClassReviewsListProps {
  classTypeId: string;
  /** If true, shows hidden reviews and admin Hide/Unhide controls */
  isAdmin?: boolean;
  /** Initial number of reviews to display (default 5). Ignored when isAdmin. */
  initialLimit?: number;
}

export function ClassReviewsList({ classTypeId, isAdmin = false, initialLimit = 5 }: ClassReviewsListProps) {
  const { data: reviews = [], isLoading } = useClassReviewsForType(classTypeId, { includeHidden: isAdmin });
  const updateVisibility = useAdminUpdateReviewVisibility();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading reviews...</p>;
  if (reviews.length === 0) {
    if (isAdmin) return <p className="text-sm text-muted-foreground">No reviews yet.</p>;
    return (
      <div className="border border-dashed border-border rounded-md p-4 text-center space-y-1">
        <p className="text-sm font-medium">Be the first to review this class</p>
        <p className="text-xs text-muted-foreground">Book and attend, then share your experience.</p>
      </div>
    );
  }

  const visibleReviews = isAdmin || showAll ? reviews : reviews.slice(0, initialLimit);
  const hiddenCount = reviews.length - visibleReviews.length;

  return (
    <div className="space-y-3">
      {visibleReviews.map((review) => (
        <div
          key={review.id}
          className={`border border-border rounded-md p-3 space-y-1 ${
            !review.is_visible ? "bg-muted/40 opacity-70" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} size="sm" />
              <span className="text-sm font-medium">{review.reviewer_name}</span>
              {!review.is_visible && (
                <Badge variant="secondary" className="text-xs">Hidden</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {format(parseISO(review.created_at), "MMM d, yyyy")}
            </span>
          </div>
          {review.review_text && (
            <p className="text-sm text-foreground">{review.review_text}</p>
          )}
          {isAdmin && (
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={updateVisibility.isPending}
                onClick={() =>
                  updateVisibility.mutate({ reviewId: review.id, isVisible: !review.is_visible })
                }
              >
                {review.is_visible ? (
                  <>
                    <EyeOff className="h-3 w-3 mr-1" />
                    Hide from members
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Make visible
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      ))}

      {!isAdmin && hiddenCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="w-full">
          Show all {reviews.length} reviews
        </Button>
      )}
    </div>
  );
}
