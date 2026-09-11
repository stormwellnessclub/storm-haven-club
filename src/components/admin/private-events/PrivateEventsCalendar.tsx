import { useMemo, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, startOfWeek, addDays, isSameMonth, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STAGE_TONE } from "@/lib/privateEvents";
import type { PrivateEvent } from "@/hooks/usePrivateEvents";

export function PrivateEventsCalendar({
  events,
  onOpenEvent,
}: {
  events: PrivateEvent[];
  onOpenEvent: (id: string) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
    return cells;
  }, [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, PrivateEvent[]>();
    for (const e of events) {
      if (!e.event_date) continue;
      const list = map.get(e.event_date) ?? [];
      list.push(e);
      map.set(e.event_date, list);
    }
    return map;
  }, [events]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{format(month, "MMMM yyyy")}</CardTitle>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = byDate.get(key) ?? [];
            return (
              <div
                key={key}
                className={`min-h-[92px] bg-background p-1 ${isSameMonth(day, month) ? "" : "opacity-40"} ${
                  isSameDay(day, new Date()) ? "ring-1 ring-inset ring-primary" : ""
                }`}
              >
                <div className="mb-1 text-xs text-muted-foreground">{format(day, "d")}</div>
                <div className="space-y-1">
                  {dayEvents.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onOpenEvent(e.id)}
                      className={`w-full truncate rounded px-1 py-0.5 text-left text-[11px] ${STAGE_TONE[e.stage] ?? "bg-muted"}`}
                      title={`${e.title} · ${e.stage}`}
                    >
                      {e.start_time ? `${e.start_time.slice(0, 5)} ` : ""}{e.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
