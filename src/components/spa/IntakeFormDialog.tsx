import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpaIntakeForm } from "@/components/spa/SpaIntakeForm";
import { BodyWrapIntakeForm } from "@/components/spa/BodyWrapIntakeForm";
import { useIntakeForm, useSubmitIntakeForm } from "@/hooks/useSpaIntake";
import {
  type IntakeKind,
  useBodyWrapIntake,
  useSubmitBodyWrapIntake,
} from "@/hooks/useBodyWrapIntake";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
  memberId?: string | null;
  /** Optional context shown in dialog header */
  serviceName?: string;
  /** Which intake to show. Defaults to massage. */
  kind?: IntakeKind;
  onSubmitted?: () => void;
}

export function IntakeFormDialog({
  open,
  onOpenChange,
  appointmentId,
  memberId,
  serviceName,
  kind = "massage",
  onSubmitted,
}: Props) {
  const isWrap = kind === "body_wrap";
  const { data: existing } = useIntakeForm(isWrap ? null : appointmentId);
  const { data: existingWrap } = useBodyWrapIntake(isWrap ? appointmentId : null);
  const submit = useSubmitIntakeForm();
  const submitWrap = useSubmitBodyWrapIntake();

  if (!appointmentId) return null;
  const has = isWrap ? !!existingWrap : !!existing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isWrap
              ? has ? "Update Body Wrap Intake & Consent" : "Body Wrap Intake & Consent"
              : has ? "Update Intake Form" : "Complete Intake Form"}
          </DialogTitle>
          <DialogDescription>
            {isWrap
              ? "Spa Aella · Please complete and sign before your body wrap."
              : serviceName
              ? `Help us prepare for your ${serviceName} session.`
              : "Help us prepare for your spa session."}
          </DialogDescription>
        </DialogHeader>

        {isWrap ? (
          <BodyWrapIntakeForm
            key={existingWrap?.id || "new"}
            appointmentId={appointmentId}
            memberId={memberId}
            initial={existingWrap}
            isSubmitting={submitWrap.isPending}
            onSubmit={async (values) => {
              await submitWrap.mutateAsync(values);
              onSubmitted?.();
              onOpenChange(false);
            }}
          />
        ) : (
          <SpaIntakeForm
            initial={existing}
            isSubmitting={submit.isPending}
            submitLabel={existing ? "Update Intake Form" : "Submit Intake Form"}
            showHeader={false}
            onSubmit={async (values) => {
              await submit.mutateAsync({
                ...values,
                appointment_id: appointmentId,
                member_id: memberId || null,
              });
              onSubmitted?.();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
