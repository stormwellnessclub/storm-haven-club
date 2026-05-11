import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, ShoppingCart } from "lucide-react";
import { useUserCredits } from "@/hooks/useUserCredits";
import { Skeleton } from "@/components/ui/skeleton";

interface CreditsStripProps {
  onBuyMore: () => void;
  /** Path for the "Details" link; pass `null` to hide. Defaults to /member/credits. */
  detailsPath?: string | null;
}

/**
 * Compact strip showing the user's class credits + class-pass remaining counts,
 * with a primary "Buy more" action that opens an inline drawer.
 *
 * Designed to live at the top of the BookClass page so the user never has to
 * navigate elsewhere to check balance or top up.
 */
export function CreditsStrip({ onBuyMore, detailsPath = "/member/credits" }: CreditsStripProps) {
  const { data, isLoading } = useUserCredits();

  if (isLoading) {
    return (
      <div className="card-luxury p-4 flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
    );
  }

  const memberCredits = data?.classCredits?.credits_remaining ?? 0;
  const memberCreditsTotal = data?.classCredits?.credits_total ?? 0;
  const isMember = !!data?.isMember;

  // Sum up active class passes by category
  const activePasses = (data?.classPasses ?? []).filter((p) => p.status === "active");
  const totalPassRemaining = activePasses.reduce((sum, p) => sum + (p.classes_remaining ?? 0), 0);

  const totalAvailable = (isMember ? memberCredits : 0) + totalPassRemaining;
  const hasAny = totalAvailable > 0;

  return (
    <div className="card-luxury p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-gold">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          Your class balance
        </div>
        {hasAny ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {isMember && (
              <span className="text-sm">
                <span className="text-2xl font-light text-gold mr-1">{memberCredits}</span>
                <span className="text-muted-foreground">/ {memberCreditsTotal} member credits</span>
              </span>
            )}
            {activePasses.length > 0 && (
              <span className="text-sm">
                <span className="text-2xl font-light text-foreground mr-1">{totalPassRemaining}</span>
                <span className="text-muted-foreground">
                  class pass{totalPassRemaining === 1 ? "" : "es"} remaining
                </span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You don't have any class credits or passes yet. Buy one below to book a class.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button onClick={onBuyMore} variant="gold" size="sm" className="h-9">
          <ShoppingCart className="h-4 w-4 mr-1.5" />
          {hasAny ? "Buy more" : "Buy a pass"}
        </Button>
        <Button asChild variant="outline" size="sm" className="h-9 hidden sm:inline-flex">
          <Link to="/member/credits">Details</Link>
        </Button>
      </div>
    </div>
  );
}
