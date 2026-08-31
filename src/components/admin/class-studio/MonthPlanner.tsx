import { useMemo, useState } from "react";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO,
  startOfMonth, startOfWeek,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ChevronLeft, ChevronRight, CopyPlus, Loader2, Send, Trash2, UserCog, XCircle,
} from "lucide-react";
import { formatTimeLabel, normalizeRoom, studioAccent, timeToMinutes } from "@/lib/studios";
import {
  useStudioMutations, type StudioSession, type StudioTemplate,
} from "@/hooks/useClassStudio";

interface Props {
  month: Date;
  onMonthChange: (d: Date) => void;
  sessions: StudioSession[];
  templates: StudioTemplate[];
  instructors: any[];
  classTypes: any[];
  onSelect: (s: StudioSession) => void;
}

export function MonthPlanner({
  month, onMonthChange, sessions, templates, instructors, classTypes, onSelect,
}: Props) {
  const {
    createSession, moveSession, publishDrafts, bulkAssignInstructor, massCancelRange,
    copyWeekForward, deleteDraft,
  } = useStudioMutations();

  const [dragPayload, setDragPayload] = useState<
    { kind: "template"; id: string } | { kind: "session"; id: string } | null
  >(null);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  });

  const byDate = useMemo(() => {
    const m = new Map<string, StudioSession[]>();
    sessions.forEach((s) => {
      const list = m.get(s.session_date) || [];
      list.push(s);
      m.set(s.session_date, list);
    });
    m.forEach((list) => list.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return m;
  }, [sessions]);

  const draftCount = sessions.filter((s) => s.is_hidden && !s.is_cancelled).length;

  const palette = useMemo(
    () =>
      templates
        .filter((t) => t.is_active && !t.is_one_time)
        .filter((t, i, arr) =>
          arr.findIndex(
            (o) => o.class_type_id === t.class_type_id && o.start_time === t.start_time && o.room === t.room,
          ) === i,
        ),
    [templates],
  );

  const coverage = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; classes: number; conflicts: number }>();
    let unstaffed = 0;
    const live = sessions.filter((s) => !s.is_cancelled);
    live.forEach((s) => {
      if (!s.instructor_id || !s.instructors) {
        unstaffed += 1;
        return;
      }
      const key = s.instructor_id;
      const cur = map.get(key) || {
        name: `${s.instructors.first_name} ${s.instructors.last_name}`,
        minutes: 0,
        classes: 0,
        conflicts: 0,
      };
      cur.minutes += timeToMinutes(s.end_time) - timeToMinutes(s.start_time);
      cur.classes += 1;
      map.set(key, cur);
    });
    // overlap detection per instructor per day
    const byInstructorDay = new Map<string, StudioSession[]>();
    live.forEach((s) => {
      if (!s.instructor_id) return;
      const k = `${s.instructor_id}|${s.session_date}`;
      byInstructorDay.set(k, [...(byInstructorDay.get(k) || []), s]);
    });
    byInstructorDay.forEach((list, k) => {
      const sorted = list.sort((a, b) => a.start_time.localeCompare(b.start_time));
      for (let i = 1; i < sorted.length; i++) {
        if (timeToMinutes(sorted[i].start_time) < timeToMinutes(sorted[i - 1].end_time)) {
          const id = k.split("|")[0];
          const entry = map.get(id);
          if (entry) entry.conflicts += 1;
        }
      }
    });
    const rows = [...map.values()].sort((a, b) => b.minutes - a.minutes);
    const maxMinutes = Math.max(1, ...rows.map((r) => r.minutes));
    return { rows, unstaffed, maxMinutes };
  }, [sessions]);

  const handleDrop = async (dateStr: string) => {
    if (!dragPayload) return;
    const payload = dragPayload;
    setDragPayload(null);
    if (payload.kind === "template") {
      const t = templates.find((x) => x.id === payload.id);
      if (!t) return;
      await createSession.mutateAsync({
        class_type_id: t.class_type_id,
        instructor_id: t.instructor_id,
        session_date: dateStr,
        start_time: t.start_time,
        end_time: t.end_time,
        room: t.room,
        max_capacity: t.max_capacity,
        is_hidden: true,
      });
    } else {
      const s = sessions.find((x) => x.id === payload.id);
      if (!s || s.session_date === dateStr) return;
      await moveSession.mutateAsync({ session: s, newDate: dateStr });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[210px_1fr_260px]">
      {/* Template palette */}
      <Card className="order-2 lg:order-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Class templates</CardTitle>
          <p className="text-xs text-muted-foreground">Drag onto a day to schedule</p>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-1.5">
              {palette.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragPayload({ kind: "template", id: t.id })}
                  className={cn(
                    "cursor-grab rounded-md border border-border border-l-4 bg-card px-2 py-1.5",
                    studioAccent(t.room),
                  )}
                >
                  <p className="text-xs font-medium truncate">{t.class_types?.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {formatTimeLabel(t.start_time)} · {normalizeRoom(t.room)}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {t.instructors ? `${t.instructors.first_name} ${t.instructors.last_name}` : "Unstaffed"}
                  </p>
                </div>
              ))}
              {palette.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">No active recurring templates yet.</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Calendar */}
      <div className="order-1 lg:order-2 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold min-w-[150px] text-center">{format(month, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          <CopyWeekDialog
            month={month}
            onCopy={(sourceStart, sourceEnd, weeks) =>
              copyWeekForward.mutate({ sourceStart, sourceEnd, weeks })
            }
            pending={copyWeekForward.isPending}
          />
          <BulkInstructorDialog
            month={month}
            instructors={instructors}
            classTypes={classTypes}
            onApply={(args) => bulkAssignInstructor.mutate(args)}
            pending={bulkAssignInstructor.isPending}
          />
          <MassCancelDialog
            month={month}
            onApply={(args) => massCancelRange.mutate(args)}
            pending={massCancelRange.isPending}
          />
          <Button
            size="sm"
            disabled={draftCount === 0 || publishDrafts.isPending}
            onClick={() =>
              publishDrafts.mutate({
                start: format(monthStart, "yyyy-MM-dd"),
                end: format(monthEnd, "yyyy-MM-dd"),
              })
            }
          >
            {publishDrafts.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Publish {draftCount > 0 ? `(${draftCount})` : ""}
          </Button>
        </div>

        {draftCount > 0 && (
          <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
            {draftCount} unpublished change{draftCount === 1 ? "" : "s"} — members can't see these yet.
          </div>
        )}

        <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-muted px-2 py-1 text-xs font-medium text-muted-foreground text-center">
              {d}
            </div>
          ))}
          {gridDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const list = byDate.get(dateStr) || [];
            const inMonth = isSameMonth(day, month);
            const hasUnstaffed = list.some((s) => !s.instructor_id && !s.is_cancelled);
            return (
              <div
                key={dateStr}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(dateStr);
                }}
                className={cn(
                  "bg-card min-h-[112px] p-1.5 space-y-1",
                  !inMonth && "opacity-40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{format(day, "d")}</span>
                  {hasUnstaffed && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                </div>
                {list.map((s) => (
                  <div
                    key={s.id}
                    draggable={!s.is_cancelled}
                    onDragStart={() => setDragPayload({ kind: "session", id: s.id })}
                    onClick={() => onSelect(s)}
                    className={cn(
                      "group cursor-pointer rounded border border-border border-l-2 bg-background px-1 py-0.5 text-[10px] leading-tight",
                      studioAccent(s.room),
                      s.is_cancelled && "line-through opacity-50",
                      s.is_hidden && !s.is_cancelled && "border-dashed",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">
                        {formatTimeLabel(s.start_time)} {s.class_types?.name}
                      </span>
                      {s.is_hidden && !s.is_cancelled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDraft.mutate(s.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-destructive"
                          aria-label="Remove draft class"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <span className="text-muted-foreground truncate block">
                      {s.instructors ? `${s.instructors.first_name} ${s.instructors.last_name[0]}.` : "Unstaffed"}
                      {" · "}
                      {s.current_enrollment}/{s.max_capacity}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Coverage rail */}
      <Card className="order-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Instructor coverage</CardTitle>
          <p className="text-xs text-muted-foreground">{format(month, "MMMM yyyy")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {coverage.unstaffed > 0 && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {coverage.unstaffed} unstaffed class{coverage.unstaffed === 1 ? "" : "es"}
            </div>
          )}
          {coverage.rows.map((r) => (
            <div key={r.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="truncate">{r.name}</span>
                <span className="text-muted-foreground">
                  {(r.minutes / 60).toFixed(1)} hrs · {r.classes}
                </span>
              </div>
              <Progress value={(r.minutes / coverage.maxMinutes) * 100} className="h-1.5" />
              {r.conflicts > 0 && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {r.conflicts} time conflict{r.conflicts === 1 ? "" : "s"}
                </p>
              )}
            </div>
          ))}
          {coverage.rows.length === 0 && <p className="text-xs text-muted-foreground">Nothing scheduled.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function CopyWeekDialog({
  month, onCopy, pending,
}: {
  month: Date;
  onCopy: (start: string, end: string, weeks: number) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(format(startOfWeek(month), "yyyy-MM-dd"));
  const [weeks, setWeeks] = useState("4");
  const end = format(endOfWeek(parseISO(start)), "yyyy-MM-dd");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><CopyPlus className="h-4 w-4 mr-2" />Copy week forward</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Copy a week forward</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source week starting</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            <p className="text-xs text-muted-foreground">Copies {start} → {end}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Repeat for</Label>
            <Select value={weeks} onValueChange={setWeeks}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 8, 12].map((w) => (
                  <SelectItem key={w} value={String(w)}>{w} week{w === 1 ? "" : "s"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Copies land as unpublished drafts you can review before publishing.</p>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => {
              onCopy(start, end, parseInt(weeks, 10));
              setOpen(false);
            }}
          >
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkInstructorDialog({
  month, instructors, classTypes, onApply, pending,
}: {
  month: Date;
  instructors: any[];
  classTypes: any[];
  onApply: (a: {
    start: string; end: string; instructorId: string; fromInstructorId?: string | null; classTypeId?: string | null;
  }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(format(startOfMonth(month), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(endOfMonth(month), "yyyy-MM-dd"));
  const [from, setFrom] = useState("any");
  const [to, setTo] = useState("");
  const [classType, setClassType] = useState("any");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><UserCog className="h-4 w-4 mr-2" />Bulk instructor</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Bulk assign instructor</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>From</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>To</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Currently assigned to</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Anyone</SelectItem>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Class type</Label>
            <Select value={classType} onValueChange={setClassType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All class types</SelectItem>
                {classTypes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue placeholder="Choose instructor" /></SelectTrigger>
              <SelectContent>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!to || pending}
            onClick={() => {
              onApply({
                start, end, instructorId: to,
                fromInstructorId: from === "any" ? null : from,
                classTypeId: classType === "any" ? null : classType,
              });
              setOpen(false);
            }}
          >
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MassCancelDialog({
  month, onApply, pending,
}: {
  month: Date;
  onApply: (a: { start: string; end: string; reason: string }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(format(month, "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(month, "yyyy-MM-dd"));
  const [reason, setReason] = useState("Club closed for the holiday");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          <XCircle className="h-4 w-4 mr-2" />Mass cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Cancel every class in a date range</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>From</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>To</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason (sent to booked members)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Bookings are cancelled and refunded through the standard cancellation flow.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              onApply({ start, end, reason });
              setOpen(false);
            }}
          >
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Cancel classes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
