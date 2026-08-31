import { useState } from "react";
import {
  ScheduleConflictReport,
  ScheduleForConflict,
  sharedWindowLabel,
} from "@/lib/scheduleConflicts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Pencil, EyeOff } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(time: string) {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

export interface ScheduleUsageStat {
  sessions: number;
  bookings: number;
}

interface Props {
  report: ScheduleConflictReport;
  /** schedule_id -> upcoming session + booking counts, used to say what is safe to remove */
  usageByScheduleId?: Record<string, ScheduleUsageStat>;
  onEditSchedule: (scheduleId: string) => void;
  onDeactivateSchedule?: (scheduleId: string) => void;
  deactivatingId?: string | null;
}

function scheduleLabel(s: ScheduleForConflict) {
  return s.class_types?.name || "Unknown class";
}

function instructorLabel(s: ScheduleForConflict) {
  return s.instructors ? `${s.instructors.first_name} ${s.instructors.last_name}` : "No instructor";
}

export function ScheduleConflictPanel({
  report,
  usageByScheduleId,
  onEditSchedule,
  onDeactivateSchedule,
  deactivatingId,
}: Props) {
  const [open, setOpen] = useState(true);
  const { clusters, pairs, totalIssues } = report;

  if (totalIssues === 0) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
        <CardContent className="flex items-center gap-3 py-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            No scheduling conflicts detected
          </p>
        </CardContent>
      </Card>
    );
  }

  const slotWord = clusters.length === 1 ? "time slot has" : "time slots have";

  function renderScheduleRow(s: ScheduleForConflict) {
    const usage = usageByScheduleId?.[s.id];
    const hasBookings = (usage?.bookings ?? 0) > 0;
    return (
      <div
        key={s.id}
        className="flex items-start justify-between gap-3 rounded-md border p-3 bg-background"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{scheduleLabel(s)}</p>
          <p className="text-xs text-muted-foreground">
            {instructorLabel(s)}
            {usage
              ? ` · ${usage.sessions} upcoming session${usage.sessions === 1 ? "" : "s"} · ${
                  usage.bookings
                } booking${usage.bookings === 1 ? "" : "s"}`
              : ""}
          </p>
          {usage && (
            <p
              className={`text-xs mt-1 ${
                hasBookings ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
              }`}
            >
              {hasBookings
                ? "Has bookings — don't remove, edit the time or room instead"
                : "No bookings — safe to remove"}
            </p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onEditSchedule(s.id)} title="Edit schedule">
            <Pencil className="h-3 w-3" />
          </Button>
          {onDeactivateSchedule && !hasBookings && (
            <Button
              variant="outline"
              size="sm"
              disabled={deactivatingId === s.id}
              onClick={() => onDeactivateSchedule(s.id)}
            >
              <EyeOff className="h-3 w-3 mr-1" />
              Deactivate
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-destructive/50 bg-destructive/5">
        <CollapsibleTrigger asChild>
          <CardContent className="flex items-center justify-between py-3 cursor-pointer hover:bg-destructive/10 transition-colors">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">
                  {clusters.length > 0 && (
                    <>
                      {clusters.length} {slotWord} more than one class scheduled
                    </>
                  )}
                  {clusters.length > 0 && pairs.length > 0 && " · "}
                  {pairs.length > 0 && (
                    <>
                      {pairs.length} overlapping conflict{pairs.length === 1 ? "" : "s"}
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  A conflict means two active weekly schedules land in the same room at the same
                  time, or give one instructor two classes at once.
                </p>
              </div>
            </div>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 pb-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Deactivating a duplicate only stops future sessions from being generated — past classes
              and attendance history are kept.
            </p>

            {clusters.map((cluster) => (
              <div key={cluster.key} className="rounded-md border bg-background/60 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="destructive" className="text-xs">
                    Same room, same time
                  </Badge>
                  <span className="text-sm font-medium">
                    {DAYS[cluster.dayOfWeek]} {formatTime(cluster.startTime)}–
                    {formatTime(cluster.endTime)} · {cluster.room}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {cluster.schedules.length} classes scheduled here
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {sharedWindowLabel(cluster.schedules[0], cluster.schedules[1])}
                  </Badge>
                </div>
                <div className="space-y-2">{cluster.schedules.map(renderScheduleRow)}</div>
              </div>
            ))}

            {pairs.map((pair, idx) => (
              <div
                key={`${pair.type}-${pair.scheduleA.id}-${pair.scheduleB.id}-${idx}`}
                className="rounded-md border bg-background/60 p-3 space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={pair.type === "room_overlap" ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {pair.type === "instructor_and_room_overlap"
                      ? "Instructor + room overlap"
                      : pair.type === "instructor_overlap"
                        ? "Instructor double-booked"
                        : "Room overlap"}
                  </Badge>
                  <span className="text-sm font-medium">{DAYS[pair.dayOfWeek]}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(pair.scheduleA.start_time)}–{formatTime(pair.scheduleA.end_time)}
                    {" & "}
                    {formatTime(pair.scheduleB.start_time)}–{formatTime(pair.scheduleB.end_time)}
                  </span>
                   <Badge variant="outline" className="text-xs">
                     {sharedWindowLabel(pair.scheduleA, pair.scheduleB)}
                   </Badge>
                </div>
                <p className="text-sm">{pair.detail}</p>
                <div className="space-y-2">
                  {renderScheduleRow(pair.scheduleA)}
                  {renderScheduleRow(pair.scheduleB)}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
