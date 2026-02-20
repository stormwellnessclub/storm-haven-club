import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, User, Users, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { startOfWeek, addDays, addWeeks, format, isBefore, isAfter, isSameDay } from "date-fns";

type ClassEntry = {
  time: string;
  name: string;
  type: "signature" | "reformer-flow" | "reformer-sculpt";
};

const SOFT_LAUNCH_START = new Date(2026, 1, 20); // Feb 20
const SOFT_LAUNCH_END = new Date(2026, 2, 18);   // Mar 18

// Staggered start dates
const MORNING_START = new Date(2026, 1, 23);     // Feb 23 (Mon)
const SUNDAY_MORNING_START = new Date(2026, 2, 1); // Mar 1

function getClassesForDate(date: Date): ClassEntry[] {
  if (isBefore(date, SOFT_LAUNCH_START) || isAfter(date, SOFT_LAUNCH_END)) return [];

  const dow = date.getDay(); // 0=Sun
  const classes: ClassEntry[] = [];

  // Sunday mornings: from Mar 1
  if (dow === 0 && !isBefore(date, SUNDAY_MORNING_START)) {
    classes.push({ time: "10:00 AM", name: "Signature Flow", type: "signature" });
    classes.push({ time: "11:00 AM", name: "Reformer Sculpt", type: "reformer-sculpt" });
  }

  // Mon-Thu mornings: from Feb 23
  if (dow >= 1 && dow <= 4 && !isBefore(date, MORNING_START)) {
    classes.push({ time: "9:00 AM", name: "Signature Flow", type: "signature" });
    classes.push({ time: "10:00 AM", name: "Reformer Flow", type: "reformer-flow" });
  }

  // Friday
  if (dow === 5) {
    // Morning from Feb 23
    if (!isBefore(date, MORNING_START)) {
      classes.push({ time: "9:00 AM", name: "Signature Flow", type: "signature" });
      classes.push({ time: "10:00 AM", name: "Reformer Flow", type: "reformer-flow" });
    }
    // Evening from Feb 20 (always within soft launch)
    classes.push({ time: "8:00 PM", name: "Signature Flow", type: "signature" });
    classes.push({ time: "9:00 PM", name: "Reformer Flow", type: "reformer-flow" });
  }

  // Saturday evening only (no mornings)
  if (dow === 6) {
    classes.push({ time: "8:00 PM", name: "Signature Flow", type: "signature" });
    classes.push({ time: "9:00 PM", name: "Reformer Sculpt", type: "reformer-sculpt" });
  }

  return classes;
}

function TempClassCard({ entry }: { entry: ClassEntry }) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {entry.name}
            </h3>
            <Badge variant="secondary" className="text-xs mt-1">
              Pilates
            </Badge>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-primary">{entry.time}</span>
          </div>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>50 min</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Duha</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>Reformer Studio</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>8 spots</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button disabled variant="outline" size="sm" className="flex-1 opacity-50">
            Book
          </Button>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Opens soon
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function TempClassSchedule() {
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate the first full week that overlaps the soft launch
  const baseWeekStart = startOfWeek(SOFT_LAUNCH_START, { weekStartsOn: 0 });

  const weekStart = addWeeks(baseWeekStart, weekOffset);
  const weekEnd = addDays(weekStart, 6);

  // Determine valid range of week offsets
  const maxWeekStart = startOfWeek(SOFT_LAUNCH_END, { weekStartsOn: 0 });
  const totalWeeks = Math.round((maxWeekStart.getTime() - baseWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

  // Generate 7 day columns
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dow = date.getDay();
    return {
      date,
      dateStr: format(date, "yyyy-MM-dd"),
      dayName: format(date, "EEE"),
      dayNum: format(date, "d"),
      month: format(date, "MMM"),
      classes: getClassesForDate(date),
      isToday: isSameDay(date, new Date()),
      outOfRange: getClassesForDate(date).length === 0,
    };
  });

  return (
    <div className="space-y-6">
      {/* Soft Launch banner for this tab */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg py-4 px-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground">
              Reformer Pilates — Soft Launch
            </h3>
            <p className="text-sm text-muted-foreground">
              February 20 – March 18, 2026 · All classes 50 min · Booking opens soon
            </p>
            <Link to="/class-passes" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1">
              Purchase a class pass to be ready when booking opens
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekOffset((p) => Math.max(p - 1, 0))}
          disabled={weekOffset === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[180px] text-center">
          Week of {format(weekStart, "MMM d, yyyy")}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekOffset((p) => Math.min(p + 1, totalWeeks))}
          disabled={weekOffset >= totalWeeks}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {weekDays.map((day) => (
          <div
            key={day.dateStr}
            className={`space-y-3 ${day.outOfRange ? "opacity-40" : ""}`}
          >
            {/* Day header matching ClassCalendar */}
            <div
              className={`text-center p-2 rounded-lg ${
                day.isToday
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <div className="text-xs font-medium uppercase">{day.dayName}</div>
              <div className="text-lg font-bold">{day.dayNum}</div>
              <div className="text-xs">{day.month}</div>
            </div>

            {/* Classes */}
            <div className="space-y-2">
              {day.classes.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No classes
                </div>
              ) : (
                day.classes.map((cls, i) => (
                  <TempClassCard key={i} entry={cls} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        This is the soft launch schedule. The full class schedule with online booking will be available soon.
      </p>
    </div>
  );
}
