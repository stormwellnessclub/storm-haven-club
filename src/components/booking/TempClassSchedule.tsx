import { Badge } from "@/components/ui/badge";
import { CircleDot, Clock, CalendarDays } from "lucide-react";

type ClassEntry = { time: string; name: string; type: "signature" | "reformer-flow" | "reformer-sculpt" };

const TEMP_SCHEDULE: { day: string; classes: ClassEntry[] }[] = [
  {
    day: "Monday",
    classes: [
      { time: "9:00 AM", name: "Signature Flow", type: "signature" },
      { time: "10:00 AM", name: "Reformer Flow", type: "reformer-flow" },
    ],
  },
  {
    day: "Tuesday",
    classes: [
      { time: "9:00 AM", name: "Signature Flow", type: "signature" },
      { time: "10:00 AM", name: "Reformer Flow", type: "reformer-flow" },
    ],
  },
  {
    day: "Wednesday",
    classes: [
      { time: "9:00 AM", name: "Signature Flow", type: "signature" },
      { time: "10:00 AM", name: "Reformer Flow", type: "reformer-flow" },
    ],
  },
  {
    day: "Thursday",
    classes: [
      { time: "9:00 AM", name: "Signature Flow", type: "signature" },
      { time: "10:00 AM", name: "Reformer Flow", type: "reformer-flow" },
    ],
  },
  {
    day: "Friday",
    classes: [
      { time: "9:00 AM", name: "Signature Flow", type: "signature" },
      { time: "10:00 AM", name: "Reformer Flow", type: "reformer-flow" },
      { time: "8:00 PM", name: "Signature Flow", type: "signature" },
      { time: "9:00 PM", name: "Reformer Flow", type: "reformer-flow" },
    ],
  },
  {
    day: "Saturday",
    classes: [
      { time: "10:00 AM", name: "Signature Flow", type: "signature" },
      { time: "11:00 AM", name: "Reformer Sculpt", type: "reformer-sculpt" },
      { time: "8:00 PM", name: "Signature Flow", type: "signature" },
      { time: "9:00 PM", name: "Reformer Flow", type: "reformer-flow" },
    ],
  },
  {
    day: "Sunday",
    classes: [],
  },
];

const CLASS_COLORS: Record<ClassEntry["type"], string> = {
  signature: "bg-primary/15 text-primary border-primary/30",
  "reformer-flow": "bg-accent/15 text-accent border-accent/30",
  "reformer-sculpt": "bg-destructive/15 text-destructive border-destructive/30",
};

export function TempClassSchedule() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <CircleDot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reformer Pilates — Soft Launch Schedule</h2>
          <p className="text-sm text-muted-foreground">Instructor: <span className="font-medium text-foreground">Duha</span></p>
        </div>
      </div>

      {/* Date range banner */}
      <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm">
        <CalendarDays className="h-4 w-4 text-accent" />
        <span className="font-medium text-foreground">February 20 – March 18, 2026</span>
        <span className="text-muted-foreground">• All classes 50 min</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        <Badge className={`${CLASS_COLORS.signature} border`}>Signature Flow</Badge>
        <Badge className={`${CLASS_COLORS["reformer-flow"]} border`}>Reformer Flow</Badge>
        <Badge className={`${CLASS_COLORS["reformer-sculpt"]} border`}>Reformer Sculpt</Badge>
      </div>

      {/* Schedule cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMP_SCHEDULE.map((entry) => (
          <div key={entry.day} className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold text-foreground mb-3">{entry.day}</h3>
            {entry.classes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No classes scheduled</p>
            ) : (
              <div className="space-y-2">
                {entry.classes.map((cls, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground w-[72px] flex-shrink-0">{cls.time}</span>
                    <Badge variant="outline" className={`${CLASS_COLORS[cls.type]} border text-xs`}>
                      {cls.name}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        This is a temporary soft launch schedule. The full class schedule with booking will be available soon.
      </p>
    </div>
  );
}
