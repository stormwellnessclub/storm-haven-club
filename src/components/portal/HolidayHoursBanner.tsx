import { CalendarHeart } from "lucide-react";

// Thanksgiving 2026 hours. Hides itself after Friday Nov 27 (Detroit time).
const HIDE_AFTER = new Date("2026-11-28T05:00:00Z");

export function HolidayHoursBanner() {
  if (new Date() >= HIDE_AFTER) return null;
  return (
    <div className="flex items-start gap-3 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
      <CalendarHeart className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
      <p>
        <span className="font-medium">Holiday hours:</span> Thanksgiving (Thu, Nov 26) 8 AM – 1 PM · Friday (Nov 27) 8 AM – 8 PM.
        Happy Thanksgiving from all of us.
      </p>
    </div>
  );
}
