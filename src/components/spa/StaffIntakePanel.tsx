import { IntakeFormSummary } from "@/components/spa/IntakeFormSummary";
import { BodyWrapIntakeSummary } from "@/components/spa/BodyWrapIntakeSummary";
import type { SpaIntakeForm } from "@/hooks/useSpaIntake";
import { intakeKindFor, useBodyWrapIntake } from "@/hooks/useBodyWrapIntake";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";
import { IntakeFormViewDialog } from "./IntakeFormViewDialog";

/** Staff view: shows the Body Wrap intake for wrap services, otherwise the massage intake. */
export function StaffIntakePanel({
  appointmentId,
  massageIntake,
  serviceCategory,
  serviceName,
  clientName,
  appointmentDate,
  appointmentTime,
}: {
  appointmentId: string | null | undefined;
  massageIntake: SpaIntakeForm | null | undefined;
  serviceCategory?: string | null;
  serviceName?: string | null;
  clientName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const { data: bw, isLoading, error } = useBodyWrapIntake(appointmentId);
  const wrap = !!bw || intakeKindFor(serviceCategory, serviceName) === "body_wrap";
  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={() => setViewOpen(true)} disabled={!appointmentId}>
        <ClipboardCheck className="h-4 w-4 mr-2" />View full intake / Print
      </Button>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading intake…</p> : error ? <p className="text-sm text-destructive">Could not load the intake. Please reopen the appointment.</p> : wrap ? <BodyWrapIntakeSummary intake={bw} staffSignOff /> : <IntakeFormSummary intake={massageIntake} />}
      <IntakeFormViewDialog open={viewOpen} onOpenChange={setViewOpen} appointmentId={appointmentId ?? null} clientName={clientName} serviceName={serviceName ?? undefined} serviceCategory={serviceCategory} appointmentDate={appointmentDate} appointmentTime={appointmentTime} />
    </div>
  );
}
