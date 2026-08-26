import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, Sparkles, User, X } from "lucide-react";
import { format, parseISO, differenceInHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime12h } from "@/lib/timeFormat";
import type { SpaApptWithStaff } from "@/hooks/useAllAppointmentHistory";
import { useCancelSpaAppointment } from "@/hooks/useSpaBooking";
import { useIntakeForm } from "@/hooks/useSpaIntake";
import { IntakeFormDialog } from "@/components/spa/IntakeFormDialog";

function serviceNeedsIntake(appt: SpaApptWithStaff): boolean {
  const cat = (appt.service_category || "").toLowerCase();
  const name = (appt.service_name || "").toLowerCase();
  return (
    cat.includes("massage") ||
    cat.includes("body") ||
    name.includes("massage")
  );
}

export function SpaAppointmentRow({
  appt,
  showCancel = false,
  showIntake = false,
  autoOpenIntake = false,
}: {
  appt: SpaApptWithStaff;
  showCancel?: boolean;
  /** Show "Intake Form" button when missing (typically only for upcoming). */
  showIntake?: boolean;
  /** Open the intake dialog automatically (deep link from email). */
  autoOpenIntake?: boolean;
}) {
  const cancel = useCancelSpaAppointment();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const needsIntake = serviceNeedsIntake(appt);
  const { data: existingIntake } = useIntakeForm(
    showIntake && needsIntake ? appt.id : null
  );
  const intakeMissing = !existingIntake;

  useEffect(() => {
    if (autoOpenIntake && needsIntake && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setIntakeOpen(true);
    }
  }, [autoOpenIntake, needsIntake]);


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
    <div className="flex items-start justify-between gap-2 p-3 rounded-lg bg-secondary/50 flex-wrap">
      <div className="flex items-start gap-3 min-w-0 flex-1">
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
          {showIntake && needsIntake && intakeMissing && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <ClipboardCheck className="h-3 w-3" />
              Intake form needed before your session
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
        {showIntake && needsIntake && (
          <Button
            size="sm"
            variant={intakeMissing ? "default" : "outline"}
            onClick={() => setIntakeOpen(true)}
          >
            <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
            {intakeMissing ? "Intake Form" : "Edit Intake"}
          </Button>
        )}
        {showCancel && (
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={cancel.isPending}>
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      <IntakeFormDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        appointmentId={appt.id}
        memberId={appt.member_id}
        serviceName={appt.service_name}
      />
    </div>
  );
}
