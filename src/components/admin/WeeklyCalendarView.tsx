import { useMemo } from "react";
import { ScheduleConflict } from "@/lib/scheduleConflicts";
import { cn } from "@/lib/utils";

interface ClassType {
  id: string;
  name: string;
  category: string;
}

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
}

interface ClassSchedule {
  id: string;
  class_type_id: string;
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  max_capacity: number | null;
  is_active: boolean;
  class_types?: ClassType;
  instructors?: Instructor | null;
}

interface WeeklyCalendarViewProps {
  schedules: ClassSchedule[];
  conflicts: ScheduleConflict[];
  onEditSchedule: (schedule: ClassSchedule) => void;
}

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const DAY_START = 5; // 5 AM
const DAY_END = 21; // 9 PM
const TOTAL_MINUTES = (DAY_END - DAY_START) * 60;
const HOUR_LABELS = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => {
  const h = DAY_START + i;
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
});

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

const CATEGORY_COLORS: Record<string, string> = {
  yoga: "bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200",
  pilates: "bg-violet-500/15 border-violet-500/40 text-violet-900 dark:text-violet-200",
  fitness: "bg-blue-500/15 border-blue-500/40 text-blue-900 dark:text-blue-200",
  cycling: "bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200",
  strength: "bg-red-500/15 border-red-500/40 text-red-900 dark:text-red-200",
  cardio: "bg-orange-500/15 border-orange-500/40 text-orange-900 dark:text-orange-200",
  dance: "bg-pink-500/15 border-pink-500/40 text-pink-900 dark:text-pink-200",
  meditation: "bg-teal-500/15 border-teal-500/40 text-teal-900 dark:text-teal-200",
};

const DEFAULT_COLOR = "bg-primary/10 border-primary/30 text-foreground";

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

export function WeeklyCalendarView({ schedules, conflicts, onEditSchedule }: WeeklyCalendarViewProps) {
  const conflictingIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      ids.add(c.scheduleA.id);
      ids.add(c.scheduleB.id);
    });
    return ids;
  }, [conflicts]);

  const schedulesByDay = useMemo(() => {
    const map: Record<number, ClassSchedule[]> = {};
    DAYS.forEach((d) => (map[d.value] = []));
    schedules.forEach((s) => {
      if (map[s.day_of_week]) map[s.day_of_week].push(s);
    });
    return map;
  }, [schedules]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px] grid grid-cols-[60px_repeat(7,1fr)] gap-0">
        {/* Header row */}
        <div className="h-10" />
        {DAYS.map((day) => (
          <div
            key={day.value}
            className="h-10 flex items-center justify-center text-sm font-semibold text-muted-foreground border-b border-l border-border"
          >
            {day.label}
          </div>
        ))}

        {/* Time grid */}
        <div className="relative">
          {HOUR_LABELS.map((label, i) => (
            <div
              key={i}
              className="h-16 flex items-start justify-end pr-2 text-xs text-muted-foreground -mt-2"
              style={{ marginTop: i === 0 ? 0 : undefined }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day) => (
          <div key={day.value} className="relative border-l border-border" style={{ height: `${HOUR_LABELS.length * 64}px` }}>
            {/* Hour grid lines */}
            {HOUR_LABELS.map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-border/50"
                style={{ top: `${(i / (HOUR_LABELS.length - 1)) * 100}%` }}
              />
            ))}

            {/* Schedule blocks */}
            {schedulesByDay[day.value]?.map((schedule) => {
              const startMin = timeToMinutes(schedule.start_time) - DAY_START * 60;
              const endMin = timeToMinutes(schedule.end_time) - DAY_START * 60;
              const top = (startMin / TOTAL_MINUTES) * 100;
              const height = ((endMin - startMin) / TOTAL_MINUTES) * 100;
              const category = schedule.class_types?.category?.toLowerCase() || "";
              const colorClass = CATEGORY_COLORS[category] || DEFAULT_COLOR;
              const hasConflict = conflictingIds.has(schedule.id);

              return (
                <div
                  key={schedule.id}
                  className={cn(
                    "absolute left-1 right-1 rounded-md border px-1.5 py-1 cursor-pointer transition-all hover:shadow-md overflow-hidden z-10",
                    colorClass,
                    !schedule.is_active && "opacity-40",
                    hasConflict && "ring-2 ring-destructive ring-offset-1 ring-offset-background"
                  )}
                  style={{ top: `${top}%`, height: `${height}%`, minHeight: "28px" }}
                  onClick={() => onEditSchedule(schedule)}
                  title={`${schedule.class_types?.name || "Class"} — ${formatTime12h(schedule.start_time)}–${formatTime12h(schedule.end_time)}`}
                >
                  <p className="text-xs font-semibold leading-tight truncate">
                    {schedule.class_types?.name || "—"}
                  </p>
                  <p className="text-[10px] leading-tight truncate opacity-80">
                    {schedule.instructors
                      ? `${schedule.instructors.first_name} ${schedule.instructors.last_name}`
                      : "No instructor"}
                  </p>
                  <p className="text-[10px] leading-tight truncate opacity-70">
                    {formatTime12h(schedule.start_time)}–{formatTime12h(schedule.end_time)}
                    {schedule.room ? ` · ${schedule.room}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
