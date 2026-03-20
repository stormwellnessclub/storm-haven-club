import { useState } from "react";
import { ScheduleConflict } from "@/lib/scheduleConflicts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Pencil } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(time: string) {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

interface Props {
  conflicts: ScheduleConflict[];
  onEditSchedule: (scheduleId: string) => void;
}

export function ScheduleConflictPanel({ conflicts, onEditSchedule }: Props) {
  const [open, setOpen] = useState(true);

  if (conflicts.length === 0) {
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

  const highCount = conflicts.filter((c) => c.severity === "high").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-destructive/50 bg-destructive/5">
        <CollapsibleTrigger asChild>
          <CardContent className="flex items-center justify-between py-3 cursor-pointer hover:bg-destructive/10 transition-colors">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">
                  {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} detected
                  {highCount > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      {highCount} critical
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Instructor overlaps and room double-bookings
                </p>
              </div>
            </div>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 pb-4 space-y-2">
            {conflicts.map((conflict, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 rounded-md border p-3 bg-background"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant={conflict.severity === "high" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {conflict.type === "instructor_overlap"
                        ? "Instructor"
                        : conflict.type === "room_conflict"
                        ? "Room"
                        : "Duplicate"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {DAYS[conflict.dayOfWeek]}
                    </span>
                  </div>
                  <p className="text-sm">{conflict.detail}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(conflict.scheduleA.start_time)}–{formatTime(conflict.scheduleA.end_time)}
                    {" & "}
                    {formatTime(conflict.scheduleB.start_time)}–{formatTime(conflict.scheduleB.end_time)}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditSchedule(conflict.scheduleA.id)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditSchedule(conflict.scheduleB.id)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
