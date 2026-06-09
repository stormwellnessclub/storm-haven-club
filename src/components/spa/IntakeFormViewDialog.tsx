import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IntakeFormSummary } from "@/components/spa/IntakeFormSummary";
import { useIntakeForm } from "@/hooks/useSpaIntake";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
  clientName?: string;
  serviceName?: string;
}

/** Read-only viewer for staff to inspect a submitted intake form. */
export function IntakeFormViewDialog({
  open,
  onOpenChange,
  appointmentId,
  clientName,
  serviceName,
}: Props) {
  const { data: intake, isLoading } = useIntakeForm(appointmentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Client Intake Form</DialogTitle>
          <DialogDescription>
            {[clientName, serviceName].filter(Boolean).join(" — ") ||
              "Submitted intake form details."}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : (
          <IntakeFormSummary intake={intake} />
        )}
      </DialogContent>
    </Dialog>
  );
}
