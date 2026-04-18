import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpaIntakeForm } from "@/components/spa/SpaIntakeForm";
import {
  useIntakeForm,
  useSubmitIntakeForm,
} from "@/hooks/useSpaIntake";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
  memberId?: string | null;
  /** Optional context shown in dialog header */
  serviceName?: string;
  onSubmitted?: () => void;
}

export function IntakeFormDialog({
  open,
  onOpenChange,
  appointmentId,
  memberId,
  serviceName,
  onSubmitted,
}: Props) {
  const { data: existing } = useIntakeForm(appointmentId);
  const submit = useSubmitIntakeForm();

  if (!appointmentId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Update Intake Form" : "Complete Intake Form"}
          </DialogTitle>
          <DialogDescription>
            {serviceName
              ? `Help us prepare for your ${serviceName} session.`
              : "Help us prepare for your spa session."}
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
