import { Star } from "lucide-react";
import { useCafeRatingSummaries } from "@/hooks/useCafeReviews";

interface Props {
  itemId: string;
  size?: "sm" | "md";
  className?: string;
}

export function CafeRatingBadge({ itemId, size = "sm", className = "" }: Props) {
  const { data } = useCafeRatingSummaries();
  const summary = data?.[itemId];
  if (!summary || summary.review_count === 0) return null;

  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1 font-cafe-mono ${textSize} tracking-widest uppercase text-cafe-burgundy ${className}`}
      aria-label={`${summary.avg_rating.toFixed(1)} out of 5, ${summary.review_count} review${summary.review_count === 1 ? "" : "s"}`}
    >
      <Star className={`${iconSize} fill-cafe-terracotta text-cafe-terracotta`} strokeWidth={1.5} />
      <span className="tabular-nums">{summary.avg_rating.toFixed(1)}</span>
      <span className="text-cafe-burgundy/50">({summary.review_count})</span>
    </span>
  );
}
