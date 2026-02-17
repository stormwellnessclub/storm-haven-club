import { useState } from "react";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SOFT_LAUNCH_END = new Date('2026-02-23T00:00:00');
const STORAGE_KEY = 'soft-launch-banner-dismissed';

const softLaunchHours = [
  { days: "Monday – Thursday", hours: "7:00 AM – 10:00 PM" },
  { days: "Friday", hours: "7:00 AM – 8:00 PM" },
  { days: "Saturday – Sunday", hours: "7:00 AM – 6:00 PM" },
];

export function SoftLaunchHoursBanner() {
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  });

  const isActive = new Date() < SOFT_LAUNCH_END;

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
            <Clock className="h-4 w-4 text-gold" />
          </div>
          <div className="space-y-2">
            <div>
              <h3 className="font-serif text-sm font-semibold text-foreground">
                Soft Launch Hours
              </h3>
              <p className="text-xs text-muted-foreground">
                February 16 – 22, 2026
              </p>
            </div>
            <div className="space-y-1">
              {softLaunchHours.map((item) => (
                <div
                  key={item.days}
                  className="flex justify-between gap-6 text-sm"
                >
                  <span className="text-foreground/80">{item.days}</span>
                  <span className="font-medium text-foreground whitespace-nowrap">
                    {item.hours}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic">
              Regular hours begin after Feb 22, 2026.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
