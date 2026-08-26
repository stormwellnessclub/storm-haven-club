import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, AlertCircle, Baby } from "lucide-react";
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

  const isPregnant = intake.health_conditions?.includes("pregnancy");
  const hasPregnancyDetails =
    isPregnant ||
    intake.pregnancy_weeks != null ||
    !!intake.pregnancy_accommodations ||
    !!intake.pregnancy_restrictions;

  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2 font-medium pb-2">
        <ClipboardCheck className="h-4 w-4 text-accent" />
        Client Intake
        {intake.consent_signed && (
          <Badge variant="outline" className="text-xs">
            Signed {intake.consent_signed_at && format(new Date(intake.consent_signed_at), "MMM d")}
          </Badge>
        )}
      </div>

      <Field question="Focus areas requested" answered={intake.focus_areas?.length > 0}>
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

      <Field question="Preferred pressure" value={pressure} />

      <Field
        question="Current pain / tension level"
        answered={typeof intake.pain_level === "number"}
      >
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs">
            {intake.pain_level ?? 0} / 10
          </Badge>
          {typeof intake.pain_level === "number" && intake.pain_level > 0 && (
            <p className="text-foreground">
              {intake.pain_areas || (
                <span className="text-muted-foreground italic">
                  No detail given on where it hurts
                </span>
              )}
            </p>
          )}
        </div>
      </Field>

      <Field
        question="Health conditions reported"
        answered={intake.health_conditions?.length > 0}
      >
        <div className="flex flex-wrap gap-1">
          {intake.health_conditions.map((h) => (
            <Badge key={h} variant="destructive" className="text-xs">
              {getHealthConditionLabel(h)}
            </Badge>
          ))}
        </div>
      </Field>

      {hasPregnancyDetails && (
        <div className="my-2 rounded-lg border border-accent/50 bg-accent/5 p-3 space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <Baby className="h-4 w-4 text-accent" />
            Pregnancy details
            {intake.pregnancy_weeks != null && (
              <Badge variant="secondary" className="text-xs">
                {intake.pregnancy_weeks} weeks along
              </Badge>
            )}
          </div>
          {intake.pregnancy_weeks == null && (
            <p className="text-xs text-muted-foreground">Weeks along: not provided</p>
          )}
          <Field
            question="Accommodations needed"
            value={intake.pregnancy_accommodations || undefined}
          />
          <Field
            question="Restrictions from their doctor"
            value={intake.pregnancy_restrictions || undefined}
          />
        </div>
      )}

      <Field
        question="Allergies (oils, lotions, fragrances)"
        value={intake.allergies || undefined}
      />
      <Field question="Current medications" value={intake.medications || undefined} />
      <Field question="Goals for this session" value={intake.goals || undefined} />
      <Field question="Areas to avoid" value={intake.areas_to_avoid || undefined} />
      <Field question="Prior massage experience" value={experience} />
    </div>
  );
}

function Field({
  question,
  value,
  children,
  answered,
}: {
  question: string;
  value?: string;
  children?: React.ReactNode;
  /** Override for children-based fields: false renders the "not answered" state */
  answered?: boolean;
}) {
  const hasAnswer = children ? answered !== false : !!value;

  return (
    <div className="py-2 border-b border-border/50 last:border-b-0 space-y-1">
      <p className="text-xs text-muted-foreground font-medium">{question}</p>
      {hasAnswer ? (
        <div className="text-foreground whitespace-pre-wrap">{children ?? value}</div>
      ) : (
        <p className="text-muted-foreground italic">None reported</p>
      )}
    </div>
  );
}
