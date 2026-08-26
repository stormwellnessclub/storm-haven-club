import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { BodyDiagram } from "./BodyDiagram";
import {
  HEALTH_CONDITIONS,
  PRESSURE_OPTIONS,
  EXPERIENCE_OPTIONS,
  type SpaIntakeForm as SpaIntakeFormType,
  type SpaIntakeFormInput,
} from "@/hooks/useSpaIntake";

interface Props {
  /** Pre-fill from existing intake form (for edit) */
  initial?: SpaIntakeFormType | null;
  /** Called with the form values (excluding appointment_id, which the parent owns) */
  onSubmit: (
    values: Omit<SpaIntakeFormInput, "appointment_id" | "member_id">,
  ) => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  showHeader?: boolean;
}

export function SpaIntakeForm({
  initial,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Save Intake Form",
  showHeader = true,
}: Props) {
  const [focusAreas, setFocusAreas] = useState<string[]>(initial?.focus_areas || []);
  const [pressure, setPressure] = useState<string>(initial?.pressure_preference || "medium");
  const [painLevel, setPainLevel] = useState<number>(initial?.pain_level ?? 0);
  const [painAreas, setPainAreas] = useState<string>(initial?.pain_areas || "");
  const [healthConditions, setHealthConditions] = useState<string[]>(
    initial?.health_conditions || [],
  );
  const [allergies, setAllergies] = useState<string>(initial?.allergies || "");
  const [medications, setMedications] = useState<string>(initial?.medications || "");
  const [goals, setGoals] = useState<string>(initial?.goals || "");
  const [avoid, setAvoid] = useState<string>(initial?.areas_to_avoid || "");
  const [experience, setExperience] = useState<string>(
    initial?.prior_massage_experience || "occasional",
  );
  const [pregWeeks, setPregWeeks] = useState<string>(
    initial?.pregnancy_weeks != null ? String(initial.pregnancy_weeks) : "",
  );
  const [pregAccom, setPregAccom] = useState<string>(initial?.pregnancy_accommodations || "");
  const [pregRestrict, setPregRestrict] = useState<string>(initial?.pregnancy_restrictions || "");
  const [consent, setConsent] = useState<boolean>(initial?.consent_signed || false);

  useEffect(() => {
    if (initial) {
      setFocusAreas(initial.focus_areas || []);
      setPressure(initial.pressure_preference || "medium");
      setPainLevel(initial.pain_level ?? 0);
      setPainAreas(initial.pain_areas || "");
      setHealthConditions(initial.health_conditions || []);
      setAllergies(initial.allergies || "");
      setMedications(initial.medications || "");
      setGoals(initial.goals || "");
      setAvoid(initial.areas_to_avoid || "");
      setExperience(initial.prior_massage_experience || "occasional");
      setPregWeeks(initial.pregnancy_weeks != null ? String(initial.pregnancy_weeks) : "");
      setPregAccom(initial.pregnancy_accommodations || "");
      setPregRestrict(initial.pregnancy_restrictions || "");
      setConsent(initial.consent_signed || false);
    }
  }, [initial?.id]);

  const isPregnant = healthConditions.includes("pregnancy");

  const toggle = (
    arr: string[],
    setArr: (v: string[]) => void,
    value: string,
  ) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const handleSubmit = async () => {
    const weeks = parseInt(pregWeeks, 10);
    await onSubmit({
      focus_areas: focusAreas,
      pressure_preference: pressure,
      pain_level: painLevel,
      pain_areas: painAreas.trim() || null,
      health_conditions: healthConditions,
      allergies: allergies.trim() || null,
      medications: medications.trim() || null,
      goals: goals.trim() || null,
      areas_to_avoid: avoid.trim() || null,
      prior_massage_experience: experience,
      pregnancy_weeks:
        isPregnant && Number.isFinite(weeks) && weeks >= 1 && weeks <= 45 ? weeks : null,
      pregnancy_accommodations: isPregnant ? pregAccom.trim() || null : null,
      pregnancy_restrictions: isPregnant ? pregRestrict.trim() || null : null,
      consent_signed: consent,
    });
  };

  const canSubmit = consent && focusAreas.length > 0 && !isSubmitting;


  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-start gap-3">
          <ClipboardCheck className="h-5 w-5 text-accent mt-0.5" />
          <div>
            <h3 className="font-semibold text-base">Client Intake Form</h3>
            <p className="text-sm text-muted-foreground">
              Help your therapist tailor the session to your needs.
            </p>
          </div>
        </div>
      )}

      {/* Focus areas */}
      <div className="space-y-2">
        <Label className="font-medium">
          Focus Areas <span className="text-destructive">*</span>
          <span className="text-xs text-muted-foreground font-normal ml-2">
            (select all that apply)
          </span>
        </Label>
        <BodyDiagram selected={focusAreas} onChange={setFocusAreas} />
        {focusAreas.length === 0 && (
          <p className="text-xs text-muted-foreground">Pick at least one area to focus on.</p>
        )}
      </div>

      {/* Pressure */}
      <div className="space-y-2">
        <Label className="font-medium">Preferred Pressure</Label>
        <div className="flex gap-2 flex-wrap">
          {PRESSURE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={pressure === opt.value ? "default" : "outline"}
              onClick={() => setPressure(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Pain level */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="font-medium">Current Pain / Tension Level</Label>
          <Badge variant="outline">{painLevel} / 10</Badge>
        </div>
        <Slider
          value={[painLevel]}
          onValueChange={([v]) => setPainLevel(v)}
          min={0}
          max={10}
          step={1}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>None</span>
          <span>Severe</span>
        </div>
        {painLevel > 0 && (
          <Textarea
            placeholder="Where does it hurt? Any injuries we should know about?"
            value={painAreas}
            onChange={(e) => setPainAreas(e.target.value)}
            rows={2}
          />
        )}
      </div>

      {/* Health conditions */}
      <div className="space-y-2">
        <Label className="font-medium">Health Conditions</Label>
        <p className="text-xs text-muted-foreground">
          Select any that apply so we can adjust the session safely.
        </p>
        <div className="flex flex-wrap gap-2">
          {HEALTH_CONDITIONS.map((c) => {
            const selected = healthConditions.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => toggle(healthConditions, setHealthConditions, c.value)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-full border transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-secondary border-border",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Allergies */}
      <div className="space-y-2">
        <Label className="font-medium">Allergies (oils, lotions, fragrances)</Label>
        <Textarea
          placeholder="e.g. nuts, lavender, latex"
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          rows={2}
        />
      </div>

      {/* Medications */}
      <div className="space-y-2">
        <Label className="font-medium">Current Medications (optional)</Label>
        <Textarea
          placeholder="List medications that may affect your session"
          value={medications}
          onChange={(e) => setMedications(e.target.value)}
          rows={2}
        />
      </div>

      {/* Goals */}
      <div className="space-y-2">
        <Label className="font-medium">Goals for this Session</Label>
        <Textarea
          placeholder="e.g. relax, work out shoulder knots, recover from workout"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={2}
        />
      </div>

      {/* Avoid */}
      <div className="space-y-2">
        <Label className="font-medium">Areas to Avoid</Label>
        <Textarea
          placeholder="Any body parts you'd prefer the therapist not work on"
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          rows={2}
        />
      </div>

      {/* Experience */}
      <div className="space-y-2">
        <Label className="font-medium">Prior Massage Experience</Label>
        <div className="flex gap-2 flex-wrap">
          {EXPERIENCE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={experience === opt.value ? "default" : "outline"}
              onClick={() => setExperience(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Consent */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40 border">
        <Checkbox
          id="intake-consent"
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
        />
        <Label
          htmlFor="intake-consent"
          className="text-sm leading-snug cursor-pointer font-normal"
        >
          I confirm the information above is accurate and I consent to receive treatment.
          I understand I should notify my therapist of any discomfort during the session.
        </Label>
      </div>

      <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}
