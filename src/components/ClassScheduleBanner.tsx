import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const SCHEDULE_BANNER_END = new Date('2026-03-19T00:00:00');
const STORAGE_KEY = 'class-schedule-banner-dismissed';

export function ClassScheduleBanner() {
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  });

  const isActive = new Date() < SCHEDULE_BANNER_END;

  if (!isActive || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="bg-gold/10 border-b border-gold/30">
      <div className="max-w-3xl mx-auto px-4 py-4 relative">
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 text-foreground/60 hover:text-foreground"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex items-start gap-3 pr-8">
          <div className="mt-0.5 rounded-full bg-gold/20 p-2 shrink-0">
            <CalendarDays className="h-4 w-4 text-gold" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif text-sm font-semibold text-foreground">
              Reformer Pilates Schedule Is Now Live
            </h3>
            <p className="text-xs text-muted-foreground">
              Feb 20 – Mar 18, 2026 · Book your spot now
            </p>
            <Link
              to="/schedule"
              className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:text-gold/80 transition-colors"
            >
              View Schedule →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
