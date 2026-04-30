import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, X, ArrowRight } from "lucide-react";
import { format, parseISO, parse } from "date-fns";
import {
  readClassDraft,
  clearClassDraft,
  readKidsCareDraft,
  clearKidsCareDraft,
} from "@/lib/bookingDraft";

interface ResumeBookingBannerProps {
  kind: "class" | "kids-care";
  /** Called when the user taps Resume. Receives the relevant draft payload. */
  onResume: (draft: any) => void;
}

/**
 * Small dismissible banner shown on schedule / bookings pages when a user
 * has an in-progress booking draft. Tapping Resume re-opens the booking sheet
 * at the saved step. Tapping the X clears the draft.
 *
 * Polls draft state on mount and after `onResume` so the banner stays in
 * sync without needing a global store.
 */
export function ResumeBookingBanner({ kind, onResume }: ResumeBookingBannerProps) {
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    setDraft(kind === "class" ? readClassDraft() : readKidsCareDraft());
  }, [kind]);

  if (!draft) return null;

  const handleResume = () => {
    onResume(draft);
  };

  const handleDismiss = () => {
    if (kind === "class") clearClassDraft();
    else clearKidsCareDraft();
    setDraft(null);
  };

  let summary = "";
  if (kind === "class" && draft.sessionDate) {
    try {
      summary = format(parseISO(draft.sessionDate), "EEE, MMM d");
    } catch {
      summary = "your class";
    }
  } else if (kind === "kids-care") {
    if (draft.date) {
      try {
        summary = format(parseISO(draft.date), "EEE, MMM d");
      } catch {
        summary = "Kids Care";
      }
    } else {
      summary = "Kids Care";
    }
    if (draft.startTime) {
      try {
        const t = parse(draft.startTime, "HH:mm:ss", new Date());
        summary += ` · ${format(t, "h:mm a")}`;
      } catch {
        /* ignore */
      }
    }
  }

  const heading = kind === "class" ? "Resume your booking" : "Resume Kids Care booking";

  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4 flex items-start gap-3">
      <div className="rounded-md bg-primary/10 p-2 hidden sm:flex">
        {kind === "class" ? (
          <Calendar className="h-5 w-5 text-primary" />
        ) : (
          <Clock className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{heading}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          You left off on {summary || "your booking"}. Pick up where you stopped.
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" onClick={handleResume} className="min-h-[40px]">
          Resume
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDismiss}
          className="min-h-[40px] min-w-[40px]"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
