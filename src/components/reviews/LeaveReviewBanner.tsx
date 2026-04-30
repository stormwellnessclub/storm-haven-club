import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeaveReviewBannerProps {
  count: number;
  onLeaveReview: () => void;
  /**
   * When provided, renders a dismiss (X) button. The banner persists dismissal
   * in localStorage keyed by `storm.reviewBanner.dismissedCount` — it re-appears
   * automatically when a NEW unreviewed class accumulates beyond the dismissed
   * count, so we surface fresh prompts without nagging.
   */
  dismissible?: boolean;
}

const DISMISS_KEY = "storm.reviewBanner.dismissedCount";

function readDismissedCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Premium banner shown above the bookings tabs / dashboards when the member or
 * non-member has at least one past class they haven't reviewed yet. Uses the
 * deep smoked-umber gradient with cream typography and a soft gold accent.
 */
export function LeaveReviewBanner({ count, onLeaveReview, dismissible = false }: LeaveReviewBannerProps) {
  const [dismissedCount, setDismissedCount] = useState<number>(() => readDismissedCount());

  // Re-read on mount in case it changed in another tab.
  useEffect(() => {
    setDismissedCount(readDismissedCount());
  }, []);

  if (count <= 0) return null;
  // If user has dismissed when count was N, hide until count grows past N.
  if (dismissible && count <= dismissedCount) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(count));
    } catch {
      /* ignore storage errors */
    }
    setDismissedCount(count);
  };

  const subhead =
    count === 1
      ? "One class is waiting for your reflection. Share what moved you — your words guide the next member's practice."
      : `You have ${count} classes waiting for your reflection. Share what moved you — every review elevates the next member's practice.`;

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[hsl(var(--gold)/0.25)] shadow-[var(--shadow-elevated)]"
      style={{ backgroundImage: "var(--gradient-dark)" }}
    >
      {/* Decorative sparkle, low opacity */}
      <Sparkles
        className="absolute -right-6 -top-6 h-32 w-32 text-[hsl(var(--gold-light))] opacity-[0.10] rotate-12 pointer-events-none"
        aria-hidden
      />

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss review reminder"
          className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full text-[hsl(var(--cream)/0.55)] hover:text-[hsl(var(--cream))] hover:bg-[hsl(var(--cream)/0.08)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:gap-8 md:p-7">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--gold-light))]" aria-hidden />
            <span className="text-[11px] uppercase tracking-[0.2em] font-medium text-[hsl(var(--gold-light))]">
              A moment of reflection
            </span>
            {count > 1 && (
              <span className="ml-auto md:ml-2 inline-flex items-center rounded-full border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.10)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--gold-light))]">
                {count} pending
              </span>
            )}
          </div>

          <h3 className="font-serif text-2xl md:text-[1.65rem] leading-tight tracking-tight text-[hsl(var(--cream))]">
            Your voice shapes the Storm experience
          </h3>

          <p className="mt-2 text-sm md:text-[15px] leading-relaxed text-[hsl(var(--cream)/0.78)] max-w-2xl">
            {subhead}
          </p>
        </div>

        <div className="shrink-0 md:pl-2">
          <Button
            size="lg"
            onClick={onLeaveReview}
            className="group bg-[hsl(var(--cream))] text-[hsl(var(--charcoal))] hover:bg-[hsl(var(--cream))]/90 border border-[hsl(var(--cream))] shadow-[var(--shadow-gold)] rounded-md px-6 h-11"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Leave a Review
            <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
