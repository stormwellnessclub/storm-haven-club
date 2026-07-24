import { useMemo, useRef, useEffect, useState } from "react";
import {
  format,
  parseISO,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  isBefore,
  isAfter,
} from "date-fns";
import { ScheduleConflict } from "@/lib/scheduleConflicts";
import { cn } from "@/lib/utils";
import { computeOverlapColumns, timeToMinutes } from "@/lib/calendarOverlap";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Lock, Plus, LayoutGrid, CalendarDays } from "lucide-react";


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

export interface CalendarPrefill {
  date: Date;
  dayOfWeek: number;
  time?: string; // "HH:mm"
  suggestedMode?: "ongoing" | "one_time";
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

/** Returns true when a schedule should render on a given calendar date. */
function scheduleAppliesOn(s: ClassSchedule, date: Date): boolean {
  const dow = date.getDay();
  if (s.day_of_week !== dow) return false;
  const dateStr = format(date, "yyyy-MM-dd");
  if (s.is_one_time) {
    return s.effective_from === dateStr;
  }
  if (s.effective_from && dateStr < s.effective_from) return false;
  if (s.effective_until && dateStr > s.effective_until) return false;
  return true;
}


interface WeeklyCalendarViewProps {
  schedules: ClassSchedule[];
  conflicts: ScheduleConflict[];
  onEditSchedule: (schedule: ClassSchedule) => void;
  /** Called when user clicks an empty slot / day to create a new schedule. */
  onCreateAtSlot?: (prefill: CalendarPrefill) => void;
  /** Called when user clicks an instructor name inside a chip. */
  onInstructorClick?: (instructorId: string) => void;
  /** Latest date currently open for public booking (inclusive). Dates after are locked. */
  bookingReleaseCutoff?: Date;
}

const ROW_HEIGHT = 48;
/** Time slot granularity in minutes for click-to-add on week view */
const SLOT_MIN = 30;

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

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function WeeklyCalendarView({
  schedules,
  conflicts,
  onEditSchedule,
  onCreateAtSlot,
  onInstructorClick,
  bookingReleaseCutoff,
}: WeeklyCalendarViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [view, setView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(today));

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

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

  // Filter schedules per calendar date (handles recurring, ranged, one-time)
  const schedulesByDate = useMemo(() => {
    const map: Record<string, ClassSchedule[]> = {};
    weekDates.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = schedules.filter((s) => scheduleAppliesOn(s, d));
    });
    return map;
  }, [schedules, weekDates]);

  // Compute overlap columns per date
  const overlapsByDate = useMemo(() => {
    const result: Record<string, Map<string, { columnIndex: number; totalColumns: number }>> = {};
    weekDates.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      const day = schedulesByDate[key] || [];
      result[key] = computeOverlapColumns(
        day.map((s) => ({
          id: s.id,
          startMinutes: timeToMinutes(s.start_time),
          endMinutes: timeToMinutes(s.end_time),
        }))
      );
    });
    return result;
  }, [schedulesByDate, weekDates]);

  useEffect(() => {
    if (view !== "week") return;
    if (!scrollRef.current || schedules.length === 0) return;
    let earliestMin = Infinity;
    schedules.forEach((s) => {
      const m = timeToMinutes(s.start_time);
      if (m < earliestMin) earliestMin = m;
    });
    const offsetMin = earliestMin - dayStart * 60;
    const scrollTop = Math.max(0, (offsetMin / totalMinutes) * (hourLabels.length * ROW_HEIGHT) - 40);
    scrollRef.current.scrollTop = scrollTop;
  }, [view, schedules, dayStart, totalMinutes, hourLabels.length]);

  const gridHeight = hourLabels.length * ROW_HEIGHT;

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`;
  const monthLabel = format(monthAnchor, "MMMM yyyy");
  const isThisWeek = isSameDay(weekStart, startOfWeek(today, { weekStartsOn: 1 }));
  const isThisMonth = isSameMonth(monthAnchor, today);

  const weekBeyondCutoff =
    !!bookingReleaseCutoff && isAfter(weekStart, bookingReleaseCutoff);

  // Handle click on empty area in a week-day column: compute time from y offset
  const handleDayColumnClick = (e: React.MouseEvent<HTMLDivElement>, date: Date) => {
    if (!onCreateAtSlot) return;
    // Ignore clicks that bubbled up from a class chip
    const target = e.target as HTMLElement;
    if (target.closest("[data-schedule-chip]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const fraction = Math.max(0, Math.min(1, y / rect.height));
    const rawMin = dayStart * 60 + fraction * totalMinutes;
    const snapped = Math.round(rawMin / SLOT_MIN) * SLOT_MIN;
    onCreateAtSlot({
      date,
      dayOfWeek: date.getDay(),
      time: minutesToHHMM(snapped),
      suggestedMode: isSameDay(date, today) || isAfter(date, today) ? "ongoing" : "ongoing",
    });
  };

  // ==================== MONTH VIEW ====================
  const monthGrid = useMemo(() => {
    if (view !== "month") return [] as Date[];
    const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthAnchor, view]);

  const monthSchedulesByDate = useMemo(() => {
    const map: Record<string, ClassSchedule[]> = {};
    monthGrid.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      map[key] = schedules
        .filter((s) => scheduleAppliesOn(s, d))
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    return map;
  }, [schedules, monthGrid]);

  return (
    <div className="space-y-3">
      {/* Header: nav + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              view === "week"
                ? setWeekStart((d) => addWeeks(d, -1))
                : setMonthAnchor((d) => addMonths(d, -1))
            }
            aria-label={view === "week" ? "Previous week" : "Previous month"}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={(view === "week" ? isThisWeek : isThisMonth) ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (view === "week") setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
              else setMonthAnchor(startOfMonth(today));
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              view === "week"
                ? setWeekStart((d) => addWeeks(d, 1))
                : setMonthAnchor((d) => addMonths(d, 1))
            }
            aria-label={view === "week" ? "Next week" : "Next month"}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-3 font-medium text-sm">
            {view === "week" ? weekLabel : monthLabel}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={view === "week" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setView("week")}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Week
            </Button>
            <Button
              variant={view === "month" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setView("month")}
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" />
              Month
            </Button>
          </div>
          {bookingReleaseCutoff && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Booking open through{" "}
              <span className="font-medium text-foreground">
                {format(bookingReleaseCutoff, "MMM d, yyyy")}
              </span>
            </div>
          )}
        </div>
      </div>

      {onCreateAtSlot && (
        <div className="text-xs text-muted-foreground italic">
          Tip: click any empty {view === "week" ? "time slot" : "day"} to add a class there.
        </div>
      )}

      {view === "week" && weekBeyondCutoff && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            This week is outside the current 4-week booking window. Members will see
            <span className="font-semibold"> "Schedule releases soon"</span> for these dates until it opens.
          </span>
        </div>
      )}

      {view === "week" ? (
        <div
          ref={scrollRef}
          className="overflow-auto border border-border rounded-lg bg-card"
          style={{ maxHeight: "70vh" }}
        >
          <div className="min-w-[820px] grid grid-cols-[56px_repeat(7,1fr)] gap-0">
            {/* Header row with real dates */}
            <div className="h-14 sticky top-0 z-20 bg-card" />
            {weekDates.map((date) => {
              const isToday = isSameDay(date, today);
              const locked =
                !!bookingReleaseCutoff && isAfter(date, bookingReleaseCutoff);
              const isPast = isBefore(date, today);
              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "h-14 flex flex-col items-center justify-center border-b border-l border-border sticky top-0 z-20 bg-card px-1",
                    isToday && "bg-primary/5"
                  )}
                >
                  <div
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {format(date, "EEE")}
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold leading-tight flex items-center gap-1",
                      isToday
                        ? "text-primary"
                        : isPast
                        ? "text-muted-foreground/60"
                        : "text-foreground"
                    )}
                  >
                    {format(date, "MMM d")}
                    {locked && <Lock className="h-3 w-3 text-amber-600" />}
                  </div>
                </div>
              );
            })}

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
            {weekDates.map((date) => {
              const key = format(date, "yyyy-MM-dd");
              const isToday = isSameDay(date, today);
              const locked =
                !!bookingReleaseCutoff && isAfter(date, bookingReleaseCutoff);
              const daySchedules = schedulesByDate[key] || [];
              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "relative border-l border-border",
                    isToday && "bg-primary/[0.03]",
                    onCreateAtSlot && "cursor-copy group/day"
                  )}
                  style={{ height: `${gridHeight}px` }}
                  onClick={(e) => handleDayColumnClick(e, date)}
                  title={onCreateAtSlot ? "Click to add a class at this time" : undefined}
                >
                  {/* Hour grid lines */}
                  {hourLabels.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "absolute left-0 right-0 border-t border-border/40 pointer-events-none",
                        i % 2 === 0 ? "bg-muted/20" : ""
                      )}
                      style={{ top: `${i * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
                    />
                  ))}

                  {/* Locked overlay: warn that this day is beyond booking window */}
                  {locked && (
                    <div className="absolute inset-0 pointer-events-none bg-amber-500/[0.04] border-l-2 border-amber-500/30" />
                  )}

                  {/* Schedule blocks */}
                  {daySchedules.map((schedule) => {
                    const startMin = timeToMinutes(schedule.start_time) - dayStart * 60;
                    const endMin = timeToMinutes(schedule.end_time) - dayStart * 60;
                    const top = (startMin / totalMinutes) * 100;
                    const height = ((endMin - startMin) / totalMinutes) * 100;
                    const colorClass = getCategoryColor(schedule.class_types?.category);
                    const hasConflict = conflictingIds.has(schedule.id);

                    const overlap = overlapsByDate[key]?.get(schedule.id);
                    const colIndex = overlap?.columnIndex ?? 0;
                    const totalCols = overlap?.totalColumns ?? 1;
                    const PAD = 2;
                    const leftPct = (colIndex / totalCols) * 100;
                    const widthPct = (1 / totalCols) * 100;

                    return (
                      <div
                        key={schedule.id + key}
                        data-schedule-chip
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSchedule(schedule);
                        }}
                        title={`${schedule.class_types?.name || "Class"} — ${formatTime12h(schedule.start_time)}–${formatTime12h(schedule.end_time)}`}
                      >
                        <p className="text-[11px] font-semibold leading-tight truncate">
                          {schedule.class_types?.name || "—"}
                        </p>
                        {schedule.instructors ? (
                          <button
                            type="button"
                            className="text-[10px] leading-tight truncate opacity-80 underline-offset-2 hover:underline text-left w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onInstructorClick && schedule.instructor_id) {
                                onInstructorClick(schedule.instructor_id);
                              }
                            }}
                          >
                            {schedule.instructors.first_name} {schedule.instructors.last_name}
                          </button>
                        ) : (
                          <p className="text-[10px] leading-tight truncate opacity-80">No instructor</p>
                        )}
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
              );
            })}
          </div>

          {schedules.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              No class schedules found. Add schedules to see them on the calendar.
            </div>
          )}
        </div>
      ) : (
        // ==================== MONTH VIEW ====================
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center py-2"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {monthGrid.map((date) => {
              const key = format(date, "yyyy-MM-dd");
              const isToday = isSameDay(date, today);
              const inMonth = isSameMonth(date, monthAnchor);
              const locked = !!bookingReleaseCutoff && isAfter(date, bookingReleaseCutoff);
              const daySchedules = monthSchedulesByDate[key] || [];
              const shown = daySchedules.slice(0, 3);
              const overflow = daySchedules.length - shown.length;

              return (
                <div
                  key={key}
                  className={cn(
                    "relative border-b border-l border-border min-h-[110px] p-1.5 flex flex-col gap-1",
                    !inMonth && "bg-muted/20 text-muted-foreground/60",
                    isToday && "bg-primary/5",
                    onCreateAtSlot && "cursor-copy hover:bg-primary/[0.04] transition-colors"
                  )}
                  onClick={(e) => {
                    if (!onCreateAtSlot) return;
                    const target = e.target as HTMLElement;
                    if (target.closest("[data-schedule-chip]")) return;
                    onCreateAtSlot({
                      date,
                      dayOfWeek: date.getDay(),
                      suggestedMode: "one_time",
                    });
                  }}
                  title={onCreateAtSlot ? "Click to add a one-off class on this day" : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isToday && "text-primary",
                        !inMonth && "opacity-60"
                      )}
                    >
                      {format(date, "d")}
                    </span>
                    <div className="flex items-center gap-1">
                      {locked && <Lock className="h-3 w-3 text-amber-600" />}
                      {onCreateAtSlot && (
                        <Plus className="h-3 w-3 text-muted-foreground/0 group-hover/day:text-muted-foreground opacity-0 hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {shown.map((s) => {
                      const colorClass = getCategoryColor(s.class_types?.category);
                      const hasConflict = conflictingIds.has(s.id);
                      return (
                        <button
                          key={s.id + key}
                          type="button"
                          data-schedule-chip
                          className={cn(
                            "text-left truncate rounded px-1 py-0.5 border text-[10px] leading-tight hover:shadow-sm",
                            colorClass,
                            !s.is_active && "opacity-40",
                            hasConflict && "ring-1 ring-destructive"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSchedule(s);
                          }}
                          title={`${s.class_types?.name || "Class"} · ${formatTime12h(s.start_time)}${
                            s.instructors ? ` · ${s.instructors.first_name} ${s.instructors.last_name}` : ""
                          }`}
                        >
                          <span className="font-semibold">{formatTime12h(s.start_time)}</span>{" "}
                          <span className="opacity-80">{s.class_types?.name || "—"}</span>
                        </button>
                      );
                    })}
                    {overflow > 0 && (
                      <span className="text-[10px] text-muted-foreground pl-1">+{overflow} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
