import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addMonths, endOfMonth, startOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { useStaffEvents } from "@/hooks/useEventsPortal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CLUB_TZ } from "@/lib/rituals";
import { cn } from "@/lib/utils";

const dayKey = (iso: string) => formatInTimeZone(new Date(iso), CLUB_TZ, "yyyy-MM-dd");

export default function EventsPortalCalendar() {
  const { data: events = [] } = useStaffEvents();
  const [cursor, setCursor] = useState(() => startOfMonth(toZonedTime(new Date(), CLUB_TZ)));

  const byDay = useMemo(() => {
    const map: Record<string, typeof events> = {};
    events.forEach((e) => {
      const k = dayKey(e.starts_at);
      (map[k] ||= [] as any).push(e);
    });
    return map;
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);

  return (
    <EventsPortalShell
      title="Calendar"
      description="Every gathering, month by month."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[10rem] text-center font-serif text-lg">
            {formatInTimeZone(cursor, CLUB_TZ, "MMMM yyyy")}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-px text-xs uppercase tracking-widest text-muted-foreground mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
            {days.map((d) => {
              const key = formatInTimeZone(d, CLUB_TZ, "yyyy-MM-dd");
              const items = byDay[key] ?? [];
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[104px] bg-card p-1.5 space-y-1",
                    !isSameMonth(d, cursor) && "opacity-50",
                  )}
                >
                  <div className="text-xs text-muted-foreground">{formatInTimeZone(d, CLUB_TZ, "d")}</div>
                  {items.map((e: any) => (
                    <Link
                      key={e.id}
                      to={`/events-portal/events/${e.slug}`}
                      className={cn(
                        "block rounded px-1.5 py-1 text-[11px] leading-tight truncate",
                        e.status === "draft"
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                      title={e.title}
                    >
                      {formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "h:mm a")} {e.title}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </EventsPortalShell>
  );
}
