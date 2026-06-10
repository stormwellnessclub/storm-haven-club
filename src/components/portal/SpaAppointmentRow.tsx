import { Sparkles, User, X } from "lucide-react";
import { format, parseISO, differenceInHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime12h } from "@/lib/timeFormat";
import type { SpaApptWithStaff } from "@/hooks/useAllAppointmentHistory";
import { useCancelSpaAppointment } from "@/hooks/useSpaBooking";

export function SpaAppointmentRow({
  appt,
  showCancel = false,
}: {
  appt: SpaApptWithStaff;
  showCancel?: boolean;
}) {
  const cancel = useCancelSpaAppointment();
  const date = parseISO(appt.appointment_date);
  const hoursOut = differenceInHours(
    parseISO(`${appt.appointment_date}T${appt.appointment_time}`),
    new Date()
  );

  async function handleCancel() {
    const warn =
      hoursOut < 24
        ? "This is less than 24 hours away. Cancelling may forfeit your credit. Continue?"
        : "Cancel this spa appointment?";
    if (!window.confirm(warn)) return;
    await cancel.mutateAsync({ appointmentId: appt.id });
  }

  return (
    <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/50">
      <div className="flex items-start gap-3 min-w-0">
        <Sparkles className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{appt.service_name}</p>
          <p className="text-xs text-muted-foreground">
            {format(date, "EEE, MMM d, yyyy")} · {formatTime12h(appt.appointment_time)} ·{" "}
            {appt.duration_minutes} min
          </p>
          {appt.staff_name && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {appt.staff_name}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
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
        {showCancel && (
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={cancel.isPending}>
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
