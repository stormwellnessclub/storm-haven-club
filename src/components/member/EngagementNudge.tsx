import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Sparkles } from "lucide-react";
import { useEngagementNudge } from "@/hooks/useEngagementNudge";
import { format, parseISO } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
import { AnimatedSection } from "@/components/AnimatedSection";

export function EngagementNudge() {
  const { shouldShow, className, sessionDate, sessionTime, isLoading } = useEngagementNudge();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || !shouldShow || dismissed) return null;

  const formattedDate = sessionDate
    ? format(parseISO(sessionDate), "EEEE")
    : null;
  const formattedTime = formatTime12h(sessionTime);

  const handleDismiss = () => {
    sessionStorage.setItem("nudge_dismissed", "1");
    setDismissed(true);
  };

  return (
    <AnimatedSection animation="fade-in">
      <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-primary/5 relative overflow-hidden">
        <CardContent className="pt-5 pb-5 pr-12">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-accent/10 shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-sm text-foreground">
                We'd love to see you back
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your favorite class — <span className="font-medium text-foreground">{className}</span> — has a spot open{" "}
                {formattedDate && (
                  <span className="font-medium text-foreground">
                    {formattedDate} at {formattedTime}
                  </span>
                )}
                .
              </p>
              <Button asChild size="sm" variant="gold" className="mt-1">
                <Link to="/schedule">Book Now</Link>
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    </AnimatedSection>
  );
}
