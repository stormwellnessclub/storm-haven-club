import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IntakeFormSummary } from "@/components/spa/IntakeFormSummary";
import { useIntakeForm } from "@/hooks/useSpaIntake";
import { useRef, useState } from "react";
import { useBodyWrapIntake, intakeKindFor } from "@/hooks/useBodyWrapIntake";
import { BodyWrapIntakeSummary } from "./BodyWrapIntakeSummary";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printIntake } from "./printIntake";
import { formatTime12h } from "@/lib/timeFormat";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
  clientName?: string;
  serviceName?: string;
  serviceCategory?: string | null;
  appointmentDate?: string;
  appointmentTime?: string;
}

/** Read-only viewer for staff to inspect a submitted intake form. */
export function IntakeFormViewDialog({
  open,
  onOpenChange,
  appointmentId,
  clientName,
  serviceName,
  serviceCategory,
  appointmentDate,
  appointmentTime,
}: Props) {
  const content = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const massage = useIntakeForm(open ? appointmentId : null);
  const bodyWrap = useBodyWrapIntake(open ? appointmentId : null);
  const wrap = !!bodyWrap.data || intakeKindFor(serviceCategory, serviceName) === "body_wrap";
  const isLoading = massage.isLoading || bodyWrap.isLoading;
  const error = wrap ? bodyWrap.error : massage.error;
  const hasIntake = wrap ? !!bodyWrap.data : !!massage.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Client Intake Form</DialogTitle>
          <DialogDescription>
            {[clientName, serviceName].filter(Boolean).join(" — ") ||
              "Submitted intake form details."}
          </DialogDescription>
        </DialogHeader>
        <Button type="button" variant="outline" className="w-fit" disabled={isLoading || !!error || !hasIntake || printing} onClick={async () => {
          if (!content.current) return;
          setPrinting(true);
          try { await printIntake(content.current); } finally { setPrinting(false); }
        }}><Printer className="h-4 w-4 mr-2" />Print intake</Button>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : error ? <p className="text-sm text-destructive">Could not load the intake. Please close and try again.</p> : (
          <div ref={content} className="space-y-4">
            <header className="border-b pb-3 space-y-1">
              <h2 className="font-semibold">Spa Aella · Storm Wellness Club</h2>
              {clientName && <p>{clientName}</p>}
              {serviceName && <p>{serviceName}</p>}
              {appointmentDate && <p>Appointment: {appointmentDate}{appointmentTime ? ` · ${formatTime12h(appointmentTime)}` : ""}</p>}
            </header>
            {wrap ? <BodyWrapIntakeSummary intake={bodyWrap.data} /> : <IntakeFormSummary intake={massage.data} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
