import { IntakeFormSummary } from "@/components/spa/IntakeFormSummary";
import { BodyWrapIntakeSummary } from "@/components/spa/BodyWrapIntakeSummary";
import type { SpaIntakeForm } from "@/hooks/useSpaIntake";
import { isBodyWrapService, useBodyWrapIntake } from "@/hooks/useBodyWrapIntake";

/** Staff view: shows the Body Wrap intake for wrap services, otherwise the massage intake. */
export function StaffIntakePanel({
  appointmentId,
  massageIntake,
  serviceCategory,
  serviceName,
}: {
  appointmentId: string | null | undefined;
  massageIntake: SpaIntakeForm | null | undefined;
  serviceCategory?: string | null;
  serviceName?: string | null;
}) {
  const { data: bw } = useBodyWrapIntake(appointmentId);
  if (bw || isBodyWrapService(serviceCategory, serviceName)) {
    return <BodyWrapIntakeSummary intake={bw} staffSignOff />;
  }
  return <IntakeFormSummary intake={massageIntake} />;
}
