import { useClassReviewsForType } from "@/hooks/useClassReviews";
import { StarRating } from "./StarRating";
import { format, parseISO } from "date-fns";

interface ClassReviewsListProps {
  classTypeId: string;
}

export function ClassReviewsList({ classTypeId }: ClassReviewsListProps) {
  const { data: reviews = [], isLoading } = useClassReviewsForType(classTypeId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading reviews...</p>;
  if (reviews.length === 0) return <p className="text-sm text-muted-foreground">No reviews yet.</p>;

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div key={review.id} className="border border-border rounded-md p-3 space-y-1">
          <div className="flex items-center justify-between">
            <StarRating rating={review.rating} size="sm" />
            <span className="text-xs text-muted-foreground">
              {format(parseISO(review.created_at), "MMM d, yyyy")}
            </span>
          </div>
          {review.review_text && (
            <p className="text-sm text-foreground">{review.review_text}</p>
          )}
        </div>
      ))}
    </div>
  );
}
