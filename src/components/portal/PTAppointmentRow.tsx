import { Dumbbell, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { PT_FORMAT_LABEL } from "@/lib/ptFormat";
import type { PTAppt } from "@/hooks/useAllAppointmentHistory";

export function PTAppointmentRow({ appt }: { appt: PTAppt }) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/50">
      <div className="flex items-start gap-3 min-w-0">
        <Dumbbell className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">
            {PT_FORMAT_LABEL[appt.format as keyof typeof PT_FORMAT_LABEL] ?? appt.format}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(appt.starts_at), "EEE, MMM d, yyyy · h:mm a")} · {appt.duration_minutes} min
          </p>
          {appt.instructor_name && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {appt.instructor_name}
            </p>
          )}
        </div>
      </div>
      <Badge
        variant={
          appt.status === "completed"
            ? "default"
            : appt.status === "cancelled" || appt.status === "no_show"
            ? "destructive"
            : "secondary"
        }
      >
        {appt.status.replace(/_/g, " ")}
      </Badge>
    </div>
  );
}
