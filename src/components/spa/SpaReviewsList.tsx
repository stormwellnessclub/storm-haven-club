import { useSpaReviewsList } from "@/hooks/useSpaReviews";
import { StarRating } from "@/components/reviews/StarRating";
import { format, parseISO } from "date-fns";

interface SpaReviewsListProps {
  serviceId?: string | null;
  emptyMessage?: string;
  limit?: number;
}

export function SpaReviewsList({ serviceId, emptyMessage, limit }: SpaReviewsListProps) {
  const { data: reviews = [], isLoading } = useSpaReviewsList(serviceId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading reviews...</p>;
  if (reviews.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
        {emptyMessage || "No reviews yet — be the first to share your experience."}
      </div>
    );
  }

  const list = limit ? reviews.slice(0, limit) : reviews;

  return (
    <div className="space-y-3">
      {list.map((r) => (
        <div key={r.id} className="border border-border rounded-md p-4 space-y-1.5 bg-card">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <StarRating rating={r.rating} size="sm" />
              <span className="text-sm font-medium">{r.reviewer_name}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {format(parseISO(r.created_at), "MMM d, yyyy")}
            </span>
          </div>
          {(r.service_name || r.therapist_name) && (
            <p className="text-xs text-muted-foreground">
              {r.service_name}
              {r.therapist_name ? ` · with ${r.therapist_name}` : ""}
            </p>
          )}
          {r.review_text && <p className="text-sm text-foreground">{r.review_text}</p>}
        </div>
      ))}
    </div>
  );
}
