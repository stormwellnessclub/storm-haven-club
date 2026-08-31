import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, Loader2, BarChart3, Layers, Plus, CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StudioDayGrid } from "@/components/admin/class-studio/StudioDayGrid";
import { SessionPanel } from "@/components/admin/class-studio/SessionPanel";
import { MonthPlanner } from "@/components/admin/class-studio/MonthPlanner";
import { TemplatesTab } from "@/components/admin/class-studio/TemplatesTab";
import { MetricsTab } from "@/components/admin/class-studio/MetricsTab";
import { QuickAddClassDialog, type QuickAddSeed } from "@/components/admin/class-studio/QuickAddClassDialog";
import {
  useStudioSessions, useStudioTemplates, useClassTypesLite, useInstructorsLite,
  useWaitlistCounts, useStudioMutations, type StudioSession,
} from "@/hooks/useClassStudio";
import { STUDIOS, formatTimeLabel, normalizeRoom, studioAccent, timeToMinutes } from "@/lib/studios";

const TABS = ["day", "week", "month", "templates", "metrics"] as const;
type TabKey = (typeof TABS)[number];

export default function ClassStudio() {
  const [params, setParams] = useSearchParams();

  const tab = (params.get("tab") as TabKey) || "day";
  const dateStr = params.get("date") || format(new Date(), "yyyy-MM-dd");
  const date = parseISO(dateStr);
  const studioFilter = params.get("studio") || "all";
  const instructorFilter = params.get("instructor") || "all";
  const showInactive = params.get("inactive") === "1";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const [selected, setSelected] = useState<StudioSession | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddSeed | null>(null);

  const range = useMemo(() => {
    if (tab === "month") {
      const m = startOfMonth(date);
      return { start: format(startOfWeek(m), "yyyy-MM-dd"), end: format(endOfWeek(endOfMonth(m)), "yyyy-MM-dd") };
    }
    if (tab === "week") {
      return {
        start: format(startOfWeek(date), "yyyy-MM-dd"),
        end: format(endOfWeek(date), "yyyy-MM-dd"),
      };
    }
    return { start: dateStr, end: dateStr };
  }, [tab, dateStr, date]);

  const { data: allSessions = [], isLoading } = useStudioSessions(range.start, range.end);
  const { data: templates = [] } = useStudioTemplates();
  const { data: classTypes = [] } = useClassTypesLite();
  const { data: instructors = [] } = useInstructorsLite();
  const { createSession, moveSession } = useStudioMutations();

  const sessions = useMemo(
    () =>
      allSessions.filter((s) => {
        if (!showInactive && (s.is_cancelled || s.is_hidden) && tab !== "month") return false;
        if (studioFilter !== "all" && normalizeRoom(s.room) !== studioFilter) return false;
        if (instructorFilter !== "all" && s.instructor_id !== instructorFilter) return false;
        return true;
      }),
    [allSessions, showInactive, studioFilter, instructorFilter, tab],
  );

  const { data: waitlistCounts = {} } = useWaitlistCounts(sessions.map((s) => s.id));

  const summary = useMemo(() => {
    // Summary always reflects everything scheduled in range (matching studio/instructor
    // filters) so hidden drafts are still surfaced even when the grid hides them.
    const scoped = allSessions.filter((s) => {
      if (studioFilter !== "all" && normalizeRoom(s.room) !== studioFilter) return false;
      if (instructorFilter !== "all" && s.instructor_id !== instructorFilter) return false;
      return true;
    });
    const live = scoped.filter((s) => !s.is_cancelled);
    const published = live.filter((s) => !s.is_hidden);
    const cap = published.reduce((a, s) => a + s.max_capacity, 0);
    const booked = published.reduce((a, s) => a + s.current_enrollment, 0);
    return {
      classes: live.length,
      fill: cap ? Math.round((booked / cap) * 100) : 0,
      waitlisted: Object.values(waitlistCounts).reduce((a, n) => a + n, 0),
      unstaffed: live.filter((s) => !s.instructor_id).length,
      drafts: live.filter((s) => s.is_hidden).length,
    };
  }, [allSessions, studioFilter, instructorFilter, waitlistCounts]);

  const shiftDate = (deltaDays: number) =>
    setParam("date", format(addDays(date, deltaDays), "yyyy-MM-dd"));

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Class Studio Portal</h1>
            <p className="text-sm text-muted-foreground">
              Plan, staff, fill and measure every studio in one place.
            </p>
          </div>
          <Button
            onClick={() =>
              setQuickAdd({ date: dateStr, room: studioFilter === "all" ? STUDIOS[0] : studioFilter, startMinutes: 6 * 60 })
            }
          >
            <Plus className="h-4 w-4 mr-2" /> Add class
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setParam("tab", v)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="day"><LayoutGrid className="h-4 w-4 mr-1.5" />Day grid</TabsTrigger>
            <TabsTrigger value="week"><CalendarRange className="h-4 w-4 mr-1.5" />Week</TabsTrigger>
            <TabsTrigger value="month"><CalendarDays className="h-4 w-4 mr-1.5" />Month planner</TabsTrigger>
            <TabsTrigger value="templates"><Layers className="h-4 w-4 mr-1.5" />Templates</TabsTrigger>
            <TabsTrigger value="metrics"><BarChart3 className="h-4 w-4 mr-1.5" />Metrics</TabsTrigger>
          </TabsList>

          {(tab === "day" || tab === "week") && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button variant="outline" size="icon" onClick={() => shiftDate(tab === "week" ? -7 : -1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setParam("date", format(new Date(), "yyyy-MM-dd"))}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => shiftDate(tab === "week" ? 7 : 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="font-medium ml-1">
                {tab === "week"
                  ? `${format(startOfWeek(date), "MMM d")} – ${format(endOfWeek(date), "MMM d, yyyy")}`
                  : format(date, "EEEE, MMMM d, yyyy")}
              </span>

              <div className="flex-1" />

              <Select value={studioFilter} onValueChange={(v) => setParam("studio", v)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All studios</SelectItem>
                  {STUDIOS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={instructorFilter} onValueChange={(v) => setParam("instructor", v)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All instructors</SelectItem>
                  {instructors.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showInactive} onCheckedChange={(c) => setParam("inactive", c ? "1" : "")} />
                Cancelled / hidden
              </label>
            </div>
          )}

          <TabsContent value="day" className="mt-4 space-y-3">
            {isLoading ? (
              <Loading />
            ) : (
              <>
                <SummaryBar summary={summary} />
                <Card>
                  <CardContent className="p-2">
                    <StudioDayGrid
                      sessions={sessions}
                      waitlistCounts={waitlistCounts}
                      onSelect={setSelected}
                      onMove={(s, mins, room) =>
                        moveSession.mutate({ session: s, newStartMinutes: mins, newRoom: room })
                      }
                      onCreate={(room, startMinutes) => setQuickAdd({ date: dateStr, room, startMinutes })}
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="week" className="mt-4 space-y-3">
            {isLoading ? (
              <Loading />
            ) : (
              <>
                <SummaryBar summary={summary} />
                <WeekGrid
                  weekStart={startOfWeek(date)}
                  sessions={sessions}
                  onSelect={setSelected}
                  onAdd={(d) => setQuickAdd({ date: d, room: studioFilter === "all" ? STUDIOS[0] : studioFilter, startMinutes: 6 * 60 })}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="month" className="mt-4">
            {isLoading ? (
              <Loading />
            ) : (
              <MonthPlanner
                month={startOfMonth(date)}
                onMonthChange={(d) => setParam("date", format(d, "yyyy-MM-dd"))}
                sessions={sessions}
                templates={templates}
                instructors={instructors}
                classTypes={classTypes}
                onSelect={setSelected}
              />
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <TemplatesTab templates={templates} />
          </TabsContent>

          <TabsContent value="metrics" className="mt-4">
            <MetricsTab />
          </TabsContent>
        </Tabs>
      </div>

      <SessionPanel
        session={selected ? sessions.find((s) => s.id === selected.id) ?? selected : null}
        onClose={() => setSelected(null)}
      />
      <QuickAddClassDialog
        seed={quickAdd}
        classTypes={classTypes}
        instructors={instructors}
        pending={createSession.isPending}
        onClose={() => setQuickAdd(null)}
        onCreate={async (payload) => {
          await createSession.mutateAsync(payload);
          setQuickAdd(null);
        }}
      />
    </AdminLayout>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function SummaryBar({
  summary,
}: {
  summary: { classes: number; fill: number; waitlisted: number; unstaffed: number; drafts: number };
}) {
  const items = [
    { label: "classes", value: summary.classes },
    { label: "fill", value: `${summary.fill}%` },
    { label: "waitlisted", value: summary.waitlisted },
    { label: "unstaffed", value: summary.unstaffed, alert: summary.unstaffed > 0 },
    { label: "drafts", value: summary.drafts },
  ];
  return (
    <Card>
      <CardContent className="flex flex-wrap gap-6 p-4">
        {items.map((i) => (
          <div key={i.label}>
            <p className={cn("text-xl font-semibold", i.alert && "text-destructive")}>{i.value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{i.label}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WeekGrid({
  weekStart, sessions, onSelect, onAdd,
}: {
  weekStart: Date;
  sessions: StudioSession[];
  onSelect: (s: StudioSession) => void;
  onAdd: (date: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const list = sessions
          .filter((s) => s.session_date === key)
          .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
        return (
          <Card key={key} className="min-h-[180px]">
            <CardContent className="p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{format(d, "EEE")}</p>
                  <p className="text-sm font-semibold">{format(d, "MMM d")}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => onAdd(key)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {list.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className={cn(
                    "w-full text-left rounded border border-border border-l-4 bg-card px-1.5 py-1",
                    studioAccent(s.room),
                    s.is_cancelled && "opacity-50 line-through",
                    s.is_hidden && !s.is_cancelled && "border-dashed",
                  )}
                >
                  <p className="text-[11px] font-medium truncate">
                    {formatTimeLabel(s.start_time)} {s.class_types?.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {s.instructors ? `${s.instructors.first_name} ${s.instructors.last_name}` : "Unstaffed"} ·{" "}
                    {s.current_enrollment}/{s.max_capacity}
                  </p>
                </button>
              ))}
              {list.length === 0 && <p className="text-[11px] text-muted-foreground">No classes</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
