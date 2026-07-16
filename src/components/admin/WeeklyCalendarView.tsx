import { useMemo, useRef, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ScheduleConflict } from "@/lib/scheduleConflicts";
import { cn } from "@/lib/utils";
import { computeOverlapColumns, timeToMinutes } from "@/lib/calendarOverlap";


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
  is_one_time?: boolean;
  effective_from?: string | null;
  effective_until?: string | null;
  class_types?: ClassType;
  instructors?: Instructor | null;
}

function formatDateBadge(d: string): string {
  try {
    return format(parseISO(d), "MMM d");
  } catch {
    return d;
  }
}

function scheduleBadge(s: ClassSchedule): string | null {
  if (s.is_one_time && s.effective_from) return `One-time · ${formatDateBadge(s.effective_from)}`;
  if (s.effective_from && s.effective_until) return `${formatDateBadge(s.effective_from)} – ${formatDateBadge(s.effective_until)}`;
  if (s.effective_until) return `Thru ${formatDateBadge(s.effective_until)}`;
  if (s.effective_from) return `From ${formatDateBadge(s.effective_from)}`;
  return null;
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

const ROW_HEIGHT = 48;

const CATEGORY_COLORS: Record<string, string> = {
  yoga: "bg-emerald-500/20 border-emerald-500/50 text-emerald-900 dark:text-emerald-200",
  pilates: "bg-violet-500/20 border-violet-500/50 text-violet-900 dark:text-violet-200",
  pilates_cycling: "bg-violet-500/20 border-violet-500/50 text-violet-900 dark:text-violet-200",
  fitness: "bg-blue-500/20 border-blue-500/50 text-blue-900 dark:text-blue-200",
  cycling: "bg-amber-500/20 border-amber-500/50 text-amber-900 dark:text-amber-200",
  strength: "bg-red-500/20 border-red-500/50 text-red-900 dark:text-red-200",
  cardio: "bg-orange-500/20 border-orange-500/50 text-orange-900 dark:text-orange-200",
  dance: "bg-pink-500/20 border-pink-500/50 text-pink-900 dark:text-pink-200",
  meditation: "bg-teal-500/20 border-teal-500/50 text-teal-900 dark:text-teal-200",
  reformer: "bg-indigo-500/20 border-indigo-500/50 text-indigo-900 dark:text-indigo-200",
  aerobics: "bg-lime-500/20 border-lime-500/50 text-lime-900 dark:text-lime-200",
  other: "bg-slate-500/20 border-slate-500/50 text-slate-900 dark:text-slate-200",
};

const DEFAULT_COLOR = "bg-sky-500/20 border-sky-500/50 text-sky-900 dark:text-sky-200";

function getCategoryColor(category: string | undefined): string {
  if (!category) return DEFAULT_COLOR;
  const lower = category.toLowerCase();
  if (CATEGORY_COLORS[lower]) return CATEGORY_COLORS[lower];
  const base = lower.split("_")[0];
  if (CATEGORY_COLORS[base]) return CATEGORY_COLORS[base];
  return DEFAULT_COLOR;
}

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

function hourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

export function WeeklyCalendarView({ schedules, conflicts, onEditSchedule }: WeeklyCalendarViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const conflictingIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      ids.add(c.scheduleA.id);
      ids.add(c.scheduleB.id);
    });
    return ids;
  }, [conflicts]);

  const { dayStart, dayEnd, hourLabels } = useMemo(() => {
    let earliest = 21;
    let latest = 6;
    schedules.forEach((s) => {
      const startH = Math.floor(timeToMinutes(s.start_time) / 60);
      const endH = Math.ceil(timeToMinutes(s.end_time) / 60);
      if (startH < earliest) earliest = startH;
      if (endH > latest) latest = endH;
    });
    const ds = Math.max(5, Math.min(earliest - 1, 9));
    const de = Math.min(22, Math.max(latest + 1, 15));
    const labels = Array.from({ length: de - ds + 1 }, (_, i) => hourLabel(ds + i));
    return { dayStart: ds, dayEnd: de, hourLabels: labels };
  }, [schedules]);

  const totalMinutes = (dayEnd - dayStart) * 60;

  const schedulesByDay = useMemo(() => {
    const map: Record<number, ClassSchedule[]> = {};
    DAYS.forEach((d) => (map[d.value] = []));
    schedules.forEach((s) => {
      if (map[s.day_of_week]) map[s.day_of_week].push(s);
    });
    return map;
  }, [schedules]);

  // Compute overlap columns per day
  const overlapsByDay = useMemo(() => {
    const result: Record<number, Map<string, { columnIndex: number; totalColumns: number }>> = {};
    DAYS.forEach((d) => {
      const daySchedules = schedulesByDay[d.value] || [];
      result[d.value] = computeOverlapColumns(
        daySchedules.map((s) => ({
          id: s.id,
          startMinutes: timeToMinutes(s.start_time),
          endMinutes: timeToMinutes(s.end_time),
        }))
      );
    });
    return result;
  }, [schedulesByDay]);

  useEffect(() => {
    if (!scrollRef.current || schedules.length === 0) return;
    let earliestMin = Infinity;
    schedules.forEach((s) => {
      const m = timeToMinutes(s.start_time);
      if (m < earliestMin) earliestMin = m;
    });
    const offsetMin = earliestMin - dayStart * 60;
    const scrollTop = Math.max(0, (offsetMin / totalMinutes) * (hourLabels.length * ROW_HEIGHT) - 40);
    scrollRef.current.scrollTop = scrollTop;
  }, [schedules, dayStart, totalMinutes, hourLabels.length]);

  const gridHeight = hourLabels.length * ROW_HEIGHT;

  return (
    <div
      ref={scrollRef}
      className="overflow-auto border border-border rounded-lg bg-card"
      style={{ maxHeight: "70vh" }}
    >
      <div className={`min-w-[700px] grid grid-cols-[56px_repeat(7,1fr)] gap-0`}>
        {/* Header row */}
        <div className="h-9 sticky top-0 z-20 bg-card" />
        {DAYS.map((day) => (
          <div
            key={day.value}
            className="h-9 flex items-center justify-center text-xs font-semibold text-muted-foreground border-b border-l border-border sticky top-0 z-20 bg-card"
          >
            {day.label}
          </div>
        ))}

        {/* Time grid */}
        <div className="relative" style={{ height: `${gridHeight}px` }}>
          {hourLabels.map((label, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 flex items-start justify-end pr-1.5 text-[10px] text-muted-foreground"
              style={{ top: `${i * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
            >
              <span className="-mt-1.5">{label}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day) => (
          <div
            key={day.value}
            className="relative border-l border-border"
            style={{ height: `${gridHeight}px` }}
          >
            {/* Hour grid lines */}
            {hourLabels.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "absolute left-0 right-0 border-t border-border/40",
                  i % 2 === 0 ? "bg-muted/20" : ""
                )}
                style={{ top: `${i * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
              />
            ))}

            {/* Schedule blocks with overlap columns */}
            {schedulesByDay[day.value]?.map((schedule) => {
              const startMin = timeToMinutes(schedule.start_time) - dayStart * 60;
              const endMin = timeToMinutes(schedule.end_time) - dayStart * 60;
              const top = (startMin / totalMinutes) * 100;
              const height = ((endMin - startMin) / totalMinutes) * 100;
              const colorClass = getCategoryColor(schedule.class_types?.category);
              const hasConflict = conflictingIds.has(schedule.id);

              const overlap = overlapsByDay[day.value]?.get(schedule.id);
              const colIndex = overlap?.columnIndex ?? 0;
              const totalCols = overlap?.totalColumns ?? 1;
              const PAD = 2; // px padding
              const leftPct = (colIndex / totalCols) * 100;
              const widthPct = (1 / totalCols) * 100;

              return (
                <div
                  key={schedule.id}
                  className={cn(
                    "absolute rounded-md border px-1.5 py-0.5 cursor-pointer transition-all hover:shadow-md overflow-hidden z-10",
                    colorClass,
                    !schedule.is_active && "opacity-40",
                    hasConflict && "ring-2 ring-destructive ring-offset-1 ring-offset-background"
                  )}
                  style={{
                    top: `${top}%`,
                    height: `${height}%`,
                    minHeight: "24px",
                    left: `calc(${leftPct}% + ${PAD}px)`,
                    width: `calc(${widthPct}% - ${PAD * 2}px)`,
                  }}
                  onClick={() => onEditSchedule(schedule)}
                  title={`${schedule.class_types?.name || "Class"} — ${formatTime12h(schedule.start_time)}–${formatTime12h(schedule.end_time)}`}
                >
                  <p className="text-[11px] font-semibold leading-tight truncate">
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
                  {scheduleBadge(schedule) && (
                    <p className="text-[9px] leading-tight truncate mt-0.5 font-semibold uppercase tracking-wide opacity-90">
                      {scheduleBadge(schedule)}
                    </p>
                  )}
                </div>
              );
            })}

          </div>
        ))}
      </div>

      {schedules.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          No class schedules found. Add schedules to see them on the calendar.
        </div>
      )}
    </div>
  );
}
