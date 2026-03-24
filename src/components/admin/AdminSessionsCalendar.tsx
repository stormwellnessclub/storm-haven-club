import { useMemo, useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, addWeeks, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Users, EyeOff, XCircle, Calendar as CalendarIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { computeOverlapColumns, timeToMinutes } from "@/lib/calendarOverlap";

interface SessionData {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_enrollment: number;
  is_cancelled: boolean;
  is_hidden: boolean;
  room: string | null;
  class_types: {
    id: string;
    name: string;
    category: string;
  } | null;
  instructors: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface AdminSessionsCalendarProps {
  onSelectSession?: (session: SessionData) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  pilates_cycling: "bg-violet-500/20 border-violet-500/50 text-violet-900 dark:text-violet-200",
  other: "bg-slate-500/20 border-slate-500/50 text-slate-900 dark:text-slate-200",
  aerobics: "bg-lime-500/20 border-lime-500/50 text-lime-900 dark:text-lime-200",
  yoga: "bg-emerald-500/20 border-emerald-500/50 text-emerald-900 dark:text-emerald-200",
  fitness: "bg-blue-500/20 border-blue-500/50 text-blue-900 dark:text-blue-200",
  cycling: "bg-amber-500/20 border-amber-500/50 text-amber-900 dark:text-amber-200",
};

const DEFAULT_COLOR = "bg-sky-500/20 border-sky-500/50 text-sky-900 dark:text-sky-200";

function getCategoryColor(category: string | undefined): string {
  if (!category) return DEFAULT_COLOR;
  return CATEGORY_COLORS[category.toLowerCase()] || DEFAULT_COLOR;
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

export function AdminSessionsCalendar({ onSelectSession }: AdminSessionsCalendarProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCancelled, setShowCancelled] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [calMode, setCalMode] = useState<"week" | "day">("week");
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // offset from start of current week

  const targetWeek = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(targetWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(targetWeek, { weekStartsOn: 0 });

  const selectedDayDate = addDays(weekStart, selectedDayOffset);

  const days = useMemo(() => {
    if (calMode === "day") {
      const date = selectedDayDate;
      return [{
        dayOfWeek: date.getDay(),
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        label: format(date, "EEEE"),
        dateLabel: format(date, "MMM d, yyyy"),
        isToday: format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
      }];
    }
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      return {
        dayOfWeek: i,
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        label: format(date, "EEE"),
        dateLabel: format(date, "M/d"),
        isToday: format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
      };
    });
  }, [weekStart, calMode, selectedDayDate]);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["admin-sessions-calendar", format(weekStart, "yyyy-MM-dd"), showCancelled, showHidden],
    queryFn: async () => {
      let query = supabase
        .from("class_sessions")
        .select(`
          id, session_date, start_time, end_time, max_capacity, current_enrollment,
          is_cancelled, is_hidden, room,
          class_types (id, name, category),
          instructors (id, first_name, last_name)
        `)
        .gte("session_date", format(weekStart, "yyyy-MM-dd"))
        .lte("session_date", format(weekEnd, "yyyy-MM-dd"))
        .order("start_time");

      if (!showCancelled) query = query.eq("is_cancelled", false);
      if (!showHidden) query = query.eq("is_hidden", false);

      const { data, error } = await query;
      if (error) throw error;
      return data as SessionData[];
    },
  });

  // Filter to visible days
  const visibleDateStrs = new Set(days.map(d => d.dateStr));
  const visibleSessions = sessions.filter(s => visibleDateStrs.has(s.session_date));

  const sessionsByDate = useMemo(() => {
    const map: Record<string, SessionData[]> = {};
    days.forEach((d) => (map[d.dateStr] = []));
    visibleSessions.forEach((s) => {
      if (map[s.session_date]) map[s.session_date].push(s);
    });
    return map;
  }, [visibleSessions, days]);

  const overlapsByDate = useMemo(() => {
    const result: Record<string, Map<string, { columnIndex: number; totalColumns: number }>> = {};
    days.forEach((d) => {
      const daySessions = sessionsByDate[d.dateStr] || [];
      result[d.dateStr] = computeOverlapColumns(
        daySessions.map((s) => ({
          id: s.id,
          startMinutes: timeToMinutes(s.start_time),
          endMinutes: timeToMinutes(s.end_time),
        }))
      );
    });
    return result;
  }, [sessionsByDate, days]);

  const ROW_HEIGHT = calMode === "day" ? 72 : 48;

  const { dayStart, dayEnd, hourLabels: hours } = useMemo(() => {
    let earliest = 21;
    let latest = 6;
    visibleSessions.forEach((s) => {
      const startH = Math.floor(timeToMinutes(s.start_time) / 60);
      const endH = Math.ceil(timeToMinutes(s.end_time) / 60);
      if (startH < earliest) earliest = startH;
      if (endH > latest) latest = endH;
    });
    const ds = Math.max(5, Math.min(earliest - 1, 9));
    const de = Math.min(22, Math.max(latest + 1, 15));
    const labels = Array.from({ length: de - ds + 1 }, (_, i) => hourLabel(ds + i));
    return { dayStart: ds, dayEnd: de, hourLabels: labels };
  }, [visibleSessions]);

  const totalMinutes = (dayEnd - dayStart) * 60;
  const gridHeight = hours.length * ROW_HEIGHT;

  useEffect(() => {
    if (!scrollRef.current || visibleSessions.length === 0) return;
    let earliestMin = Infinity;
    visibleSessions.forEach((s) => {
      const m = timeToMinutes(s.start_time);
      if (m < earliestMin) earliestMin = m;
    });
    const offsetMin = earliestMin - dayStart * 60;
    const scrollTop = Math.max(0, (offsetMin / totalMinutes) * gridHeight - 40);
    scrollRef.current.scrollTop = scrollTop;
  }, [visibleSessions, dayStart, totalMinutes, gridHeight]);

  const handleSessionClick = (session: SessionData) => {
    // Navigate directly to the full roster page
    navigate(`/admin/class-roster/${session.id}`);
    onSelectSession?.(session);
  };

  const numCols = calMode === "day" ? 1 : 7;
  const gridColsClass = calMode === "day" ? "grid-cols-[72px_1fr]" : "grid-cols-[56px_repeat(7,1fr)]";

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            if (calMode === "day") {
              setSelectedDayOffset(prev => prev - 1);
              if (selectedDayOffset <= 0) { setWeekOffset(w => w - 1); setSelectedDayOffset(6); }
            } else {
              setWeekOffset((w) => w - 1);
            }
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setWeekOffset(0); setSelectedDayOffset(new Date().getDay()); }}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => {
            if (calMode === "day") {
              setSelectedDayOffset(prev => prev + 1);
              if (selectedDayOffset >= 6) { setWeekOffset(w => w + 1); setSelectedDayOffset(0); }
            } else {
              setWeekOffset((w) => w + 1);
            }
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {calMode === "day" ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 ml-1">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDayDate, "EEEE, MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDayDate}
                  onSelect={(d) => {
                    if (!d) return;
                    const newWeekStart = startOfWeek(d, { weekStartsOn: 0 });
                    const diffWeeks = Math.round((newWeekStart.getTime() - startOfWeek(new Date(), { weekStartsOn: 0 }).getTime()) / (7 * 24 * 60 * 60 * 1000));
                    setWeekOffset(diffWeeks);
                    setSelectedDayOffset(d.getDay());
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          ) : (
            <span className="text-sm font-medium ml-2">
              {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Tabs value={calMode} onValueChange={(v) => {
            setCalMode(v as "week" | "day");
            if (v === "day") setSelectedDayOffset(new Date().getDay());
          }}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-3 h-7">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-7">Week</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1.5">
            <Checkbox id="show-cancelled" checked={showCancelled} onCheckedChange={(v) => setShowCancelled(!!v)} />
            <Label htmlFor="show-cancelled" className="text-xs cursor-pointer">Cancelled</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Checkbox id="show-hidden" checked={showHidden} onCheckedChange={(v) => setShowHidden(!!v)} />
            <Label htmlFor="show-hidden" className="text-xs cursor-pointer">Hidden</Label>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-auto border border-border rounded-lg bg-card"
          style={{ maxHeight: "75vh" }}
        >
          <div className={cn("min-w-[400px] grid gap-0", gridColsClass)}>
            {/* Header */}
            <div className={cn("sticky top-0 z-20 bg-card", calMode === "day" ? "h-12" : "h-10")} />
            {days.map((day) => (
              <div
                key={day.dateStr}
                className={cn(
                  "flex flex-col items-center justify-center font-semibold border-b border-l border-border sticky top-0 z-20 bg-card",
                  calMode === "day" ? "h-12 text-sm" : "h-10 text-xs",
                  day.isToday ? "text-primary bg-primary/5" : "text-muted-foreground"
                )}
              >
                <span>{day.label}</span>
                <span className={cn(
                  calMode === "day" ? "text-xs" : "text-[10px]",
                  day.isToday ? "font-bold" : "font-normal opacity-70"
                )}>
                  {day.dateLabel}
                </span>
              </div>
            ))}

            {/* Time axis */}
            <div className="relative" style={{ height: `${gridHeight}px` }}>
              {hours.map((label, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute left-0 right-0 flex items-start justify-end pr-1.5 text-muted-foreground",
                    calMode === "day" ? "text-xs" : "text-[10px]"
                  )}
                  style={{ top: `${i * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
                >
                  <span className="-mt-1.5">{label}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => (
              <div
                key={day.dateStr}
                className={cn("relative border-l border-border", day.isToday && "bg-primary/[0.02]")}
                style={{ height: `${gridHeight}px` }}
              >
                {hours.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "absolute left-0 right-0 border-t border-border/40",
                      i % 2 === 0 ? "bg-muted/20" : ""
                    )}
                    style={{ top: `${i * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
                  />
                ))}

                {sessionsByDate[day.dateStr]?.map((session) => {
                  const startMin = timeToMinutes(session.start_time) - dayStart * 60;
                  const endMin = timeToMinutes(session.end_time) - dayStart * 60;
                  const top = (startMin / totalMinutes) * 100;
                  const height = ((endMin - startMin) / totalMinutes) * 100;
                  const colorClass = getCategoryColor(session.class_types?.category);
                  const isFull = session.current_enrollment >= session.max_capacity;

                  const overlap = overlapsByDate[day.dateStr]?.get(session.id);
                  const colIndex = overlap?.columnIndex ?? 0;
                  const totalCols = overlap?.totalColumns ?? 1;
                  const PAD = 2;
                  const leftPct = (colIndex / totalCols) * 100;
                  const widthPct = (1 / totalCols) * 100;

                  const isDayView = calMode === "day";

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "absolute rounded-md border cursor-pointer transition-all hover:shadow-lg overflow-hidden z-10",
                        colorClass,
                        isDayView ? "px-3 py-1.5" : "px-1.5 py-0.5",
                        session.is_cancelled && "opacity-40 line-through",
                        session.is_hidden && !session.is_cancelled && "opacity-50"
                      )}
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        minHeight: isDayView ? "52px" : "28px",
                        left: `calc(${leftPct}% + ${PAD}px)`,
                        width: `calc(${widthPct}% - ${PAD * 2}px)`,
                      }}
                      onClick={() => handleSessionClick(session)}
                      title={`${session.class_types?.name || "Class"} — ${formatTime12h(session.start_time)}–${formatTime12h(session.end_time)} (${session.current_enrollment}/${session.max_capacity})`}
                    >
                      <p className={cn(
                        "font-semibold leading-tight truncate",
                        isDayView ? "text-sm" : "text-[11px]"
                      )}>
                        {session.class_types?.name || "—"}
                      </p>
                      <div className={cn(
                        "flex items-center gap-1 leading-tight opacity-80",
                        isDayView ? "text-xs mt-0.5" : "text-[10px]"
                      )}>
                        {isDayView && (
                          <span className="mr-1">{formatTime12h(session.start_time)} – {formatTime12h(session.end_time)}</span>
                        )}
                        <Users className={cn(isDayView ? "h-3 w-3" : "h-2.5 w-2.5")} />
                        <span className={cn(isFull && "text-destructive font-semibold")}>
                          {session.current_enrollment}/{session.max_capacity}
                        </span>
                        {session.is_cancelled && <XCircle className="h-2.5 w-2.5 text-destructive" />}
                        {session.is_hidden && !session.is_cancelled && <EyeOff className="h-2.5 w-2.5" />}
                      </div>
                      <p className={cn(
                        "leading-tight truncate opacity-70",
                        isDayView ? "text-xs" : "text-[10px]"
                      )}>
                        {session.instructors
                          ? `${session.instructors.first_name} ${session.instructors.last_name}`
                          : ""}
                        {session.room ? ` · ${session.room}` : ""}
                      </p>
                      {isDayView && isFull && (
                        <p className="text-xs text-destructive font-medium mt-0.5">Class Full</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {visibleSessions.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              No sessions found for this {calMode === "day" ? "day" : "week"}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
