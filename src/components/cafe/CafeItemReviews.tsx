import { useState } from "react";
import { Star, BadgeCheck, MessageSquarePlus } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  CafeReview,
  useCafeItemReviews,
  useCafeRatingSummaries,
  useReviewPhotoUrl,
} from "@/hooks/useCafeReviews";
import { CafeReviewForm } from "./CafeReviewForm";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  menuItemId: string;
  itemName: string;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${
            n <= rating ? "fill-cafe-terracotta text-cafe-terracotta" : "text-cafe-burgundy/25"
          }`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function ReviewPhoto({ path }: { path: string }) {
  const url = useReviewPhotoUrl(path);
  if (!url) return null;
  return (
    <img
      src={url}
      alt="Member's photo"
      className="mt-2 h-32 w-32 object-cover border border-cafe-line/60 rounded"
      loading="lazy"
    />
  );
}

function ReviewCard({ r }: { r: CafeReview }) {
  return (
    <li className="py-3 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-cafe-serif text-sm uppercase tracking-tight text-cafe-burgundy">
              {r.reviewer_display_name}
            </span>
            {r.is_verified_purchase && (
              <span
                className="inline-flex items-center gap-1 font-cafe-mono text-[8px] tracking-[0.2em] uppercase text-cafe-terracotta"
                title="Ordered at the Café"
              >
                <BadgeCheck className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StarRow rating={r.rating} />
            <span className="font-cafe-mono text-[9px] tracking-widest uppercase text-cafe-burgundy/40">
              {formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
      {r.tags && r.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.tags.map((t) => (
            <span
              key={t}
              className="font-cafe-mono text-[9px] tracking-widest uppercase text-cafe-burgundy/70 border border-cafe-line rounded-full px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {r.comment && (
        <p className="mt-2 text-sm text-cafe-burgundy/85 leading-relaxed">{r.comment}</p>
      )}
      {r.photo_path && <ReviewPhoto path={r.photo_path} />}
    </li>
  );
}

function RatingDistribution({ reviews }: { reviews: CafeReview[] }) {
  if (reviews.length === 0) return null;
  const counts = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => r.rating === n).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);
  return (
    <div className="space-y-1.5 min-w-[140px]">
      {counts.map(({ n, count }) => (
        <div key={n} className="flex items-center gap-2">
          <span className="font-cafe-mono text-[10px] tracking-widest text-cafe-burgundy/60 w-4 tabular-nums">
            {n}
          </span>
          <div className="flex-1 h-1.5 bg-cafe-line/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-cafe-terracotta"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="font-cafe-mono text-[10px] tabular-nums text-cafe-burgundy/50 w-6 text-right">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CafeItemReviews({ menuItemId, itemName }: Props) {
  const { user } = useAuth();
  const { data: reviews = [], isLoading } = useCafeItemReviews(menuItemId);
  const { data: summaries } = useCafeRatingSummaries();
  const summary = summaries?.[menuItemId];
  const [showForm, setShowForm] = useState(false);

  const defaultName =
    (user?.user_metadata as any)?.first_name ||
    user?.email?.split("@")[0] ||
    "";
  const defaultEmail = user?.email || "";

  return (
    <div className="pt-2">
      <div className="flex items-center gap-3 mb-4">
        <span className="h-px flex-1 bg-cafe-line/70" />
        <span className="font-cafe-mono text-[9px] tracking-[0.3em] uppercase text-cafe-burgundy/70">
          Reviews
        </span>
        <span className="h-px flex-1 bg-cafe-line/70" />
      </div>

      {summary && summary.review_count > 0 ? (
        <div className="flex items-center gap-6 mb-5">
          <div className="text-center">
            <div className="font-cafe-serif text-4xl text-cafe-burgundy tabular-nums leading-none">
              {summary.avg_rating.toFixed(1)}
            </div>
            <div className="mt-1.5 flex justify-center">
              <StarRow rating={Math.round(summary.avg_rating)} />
            </div>
            <div className="mt-1 font-cafe-mono text-[9px] tracking-widest uppercase text-cafe-burgundy/50">
              {summary.review_count} review{summary.review_count === 1 ? "" : "s"}
            </div>
          </div>
          <RatingDistribution reviews={reviews} />
        </div>
      ) : (
        !isLoading && (
          <p className="text-sm text-cafe-burgundy/70 mb-4 italic">
            Be the first to review {itemName}.
          </p>
        )
      )}

      {!showForm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="border-cafe-line text-cafe-burgundy hover:bg-cafe-burgundy hover:text-cafe-cream"
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Write a review
        </Button>
      ) : (
        <CafeReviewForm
          menuItemId={menuItemId}
          itemName={itemName}
          defaultDisplayName={defaultName}
          defaultEmail={defaultEmail}
          onCancel={() => setShowForm(false)}
          onSubmitted={() => setShowForm(false)}
        />
      )}

      {reviews.length > 0 && (
        <ul className="mt-6 divide-y divide-cafe-line/60">
          {reviews.map((r) => (
            <ReviewCard key={r.id} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
