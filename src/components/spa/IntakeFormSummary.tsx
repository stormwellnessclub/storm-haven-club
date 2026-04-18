import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, AlertCircle } from "lucide-react";
import {
  type SpaIntakeForm,
  getFocusAreaLabel,
  getHealthConditionLabel,
  PRESSURE_OPTIONS,
  EXPERIENCE_OPTIONS,
} from "@/hooks/useSpaIntake";
import { format } from "date-fns";
import { BodyDiagramReadOnly } from "./BodyDiagramReadOnly";

interface Props {
  intake: SpaIntakeForm | null | undefined;
  /** Show empty state if no intake exists */
  showEmptyState?: boolean;
}

export function IntakeFormSummary({ intake, showEmptyState = true }: Props) {
  if (!intake) {
    if (!showEmptyState) return null;
    return (
      <div className="p-3 rounded-lg border border-dashed bg-muted/30 flex items-start gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>No intake form submitted yet for this appointment.</span>
      </div>
    );
  }

  const pressure = PRESSURE_OPTIONS.find((p) => p.value === intake.pressure_preference)?.label;
  const experience = EXPERIENCE_OPTIONS.find(
    (e) => e.value === intake.prior_massage_experience,
  )?.label;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <ClipboardCheck className="h-4 w-4 text-accent" />
        Client Intake
        {intake.consent_signed && (
          <Badge variant="outline" className="text-xs">
            Signed {intake.consent_signed_at && format(new Date(intake.consent_signed_at), "MMM d")}
          </Badge>
        )}
      </div>

      {intake.focus_areas?.length > 0 && (
        <Field label="Focus areas">
          <div className="space-y-2">
            <BodyDiagramReadOnly selected={intake.focus_areas} />
            <div className="flex flex-wrap gap-1">
              {intake.focus_areas.map((a) => (
                <Badge key={a} variant="secondary" className="text-xs">
                  {getFocusAreaLabel(a)}
                </Badge>
              ))}
            </div>
          </div>
        </Field>
      )}

      {pressure && <Field label="Pressure" value={pressure} />}
      {typeof intake.pain_level === "number" && intake.pain_level > 0 && (
        <Field label={`Pain (${intake.pain_level}/10)`} value={intake.pain_areas || "—"} />
      )}

      {intake.health_conditions?.length > 0 && (
        <Field label="Health conditions">
          <div className="flex flex-wrap gap-1">
            {intake.health_conditions.map((h) => (
              <Badge key={h} variant="destructive" className="text-xs">
                {getHealthConditionLabel(h)}
              </Badge>
            ))}
          </div>
        </Field>
      )}

      {intake.allergies && <Field label="Allergies" value={intake.allergies} />}
      {intake.medications && <Field label="Medications" value={intake.medications} />}
      {intake.goals && <Field label="Goals" value={intake.goals} />}
      {intake.areas_to_avoid && <Field label="Avoid" value={intake.areas_to_avoid} />}
      {experience && <Field label="Experience" value={experience} />}
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <div>{children ?? <span className="text-foreground">{value}</span>}</div>
    </div>
  );
}
