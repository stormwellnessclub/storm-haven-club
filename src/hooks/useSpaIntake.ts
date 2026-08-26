import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SpaIntakeForm {
  id: string;
  appointment_id: string;
  member_id: string | null;
  user_id: string;
  focus_areas: string[];
  pressure_preference: string | null;
  pain_level: number | null;
  pain_areas: string | null;
  health_conditions: string[];
  allergies: string | null;
  medications: string | null;
  goals: string | null;
  areas_to_avoid: string | null;
  prior_massage_experience: string | null;
  pregnancy_weeks: number | null;
  pregnancy_accommodations: string | null;
  pregnancy_restrictions: string | null;
  consent_signed: boolean;
  consent_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpaIntakeFormInput {
  appointment_id: string;
  member_id?: string | null;
  focus_areas: string[];
  pressure_preference?: string | null;
  pain_level?: number | null;
  pain_areas?: string | null;
  health_conditions: string[];
  allergies?: string | null;
  medications?: string | null;
  goals?: string | null;
  areas_to_avoid?: string | null;
  prior_massage_experience?: string | null;
  pregnancy_weeks?: number | null;
  pregnancy_accommodations?: string | null;
  pregnancy_restrictions?: string | null;
  consent_signed: boolean;
}

/** Fetch intake form for a single appointment */
export function useIntakeForm(appointmentId: string | null | undefined) {
  return useQuery({
    queryKey: ["spa-intake-form", appointmentId],
    enabled: !!appointmentId,
    queryFn: async () => {
      if (!appointmentId) return null;
      const { data, error } = await (supabase.from as any)("spa_intake_forms")
        .select("*")
        .eq("appointment_id", appointmentId)
        .maybeSingle();
      if (error) throw error;
      return data as SpaIntakeForm | null;
    },
  });
}

/** Fetch intake form status (boolean) for many appointment IDs at once */
export function useIntakeFormStatuses(appointmentIds: string[]) {
  return useQuery({
    queryKey: ["spa-intake-form-statuses", [...appointmentIds].sort().join(",")],
    enabled: appointmentIds.length > 0,
    queryFn: async () => {
      if (appointmentIds.length === 0) return {} as Record<string, boolean>;
      const { data, error } = await (supabase.from as any)("spa_intake_forms")
        .select("appointment_id, consent_signed")
        .in("appointment_id", appointmentIds);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        map[row.appointment_id] = row.consent_signed === true;
      });
      return map;
    },
  });
}

/** Insert or update an intake form */
export function useSubmitIntakeForm() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SpaIntakeFormInput) => {
      if (!user) throw new Error("You must be signed in.");

      const payload: any = {
        appointment_id: input.appointment_id,
        user_id: user.id,
        member_id: input.member_id || null,
        focus_areas: input.focus_areas,
        pressure_preference: input.pressure_preference || null,
        pain_level: input.pain_level ?? null,
        pain_areas: input.pain_areas || null,
        health_conditions: input.health_conditions,
        allergies: input.allergies || null,
        medications: input.medications || null,
        goals: input.goals || null,
        areas_to_avoid: input.areas_to_avoid || null,
        prior_massage_experience: input.prior_massage_experience || null,
        pregnancy_weeks: input.pregnancy_weeks ?? null,
        pregnancy_accommodations: input.pregnancy_accommodations || null,
        pregnancy_restrictions: input.pregnancy_restrictions || null,
        consent_signed: input.consent_signed,
        consent_signed_at: input.consent_signed ? new Date().toISOString() : null,
      };

      // Upsert by appointment_id
      const { data, error } = await (supabase.from as any)("spa_intake_forms")
        .upsert(payload, { onConflict: "appointment_id" })
        .select()
        .single();

      if (error) throw error;
      return data as SpaIntakeForm;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["spa-intake-form", vars.appointment_id] });
      qc.invalidateQueries({ queryKey: ["spa-intake-form-statuses"] });
      toast.success("Intake form saved");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save intake form");
    },
  });
}

// ─── Reference data ─────────────────────────────────────────────

export const FOCUS_AREAS = [
  { value: "head_scalp", label: "Head & Scalp" },
  { value: "neck", label: "Neck" },
  { value: "shoulders", label: "Shoulders" },
  { value: "upper_back", label: "Upper Back" },
  { value: "mid_back", label: "Mid Back" },
  { value: "lower_back", label: "Lower Back" },
  { value: "arms", label: "Arms" },
  { value: "hands", label: "Hands" },
  { value: "chest", label: "Chest" },
  { value: "abdomen", label: "Abdomen" },
  { value: "hips", label: "Hips" },
  { value: "glutes", label: "Glutes" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "quads", label: "Quads / Front of Legs" },
  { value: "calves", label: "Calves" },
  { value: "feet", label: "Feet" },
] as const;

export const PRESSURE_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "firm", label: "Firm" },
  { value: "deep", label: "Deep Tissue" },
] as const;

export const HEALTH_CONDITIONS = [
  { value: "pregnancy", label: "Pregnancy" },
  { value: "high_blood_pressure", label: "High Blood Pressure" },
  { value: "low_blood_pressure", label: "Low Blood Pressure" },
  { value: "heart_condition", label: "Heart Condition" },
  { value: "blood_thinners", label: "Blood Thinners" },
  { value: "diabetes", label: "Diabetes" },
  { value: "recent_surgery", label: "Recent Surgery (< 6 mo)" },
  { value: "skin_condition", label: "Skin Condition" },
  { value: "allergies", label: "Allergies" },
  { value: "varicose_veins", label: "Varicose Veins" },
  { value: "fibromyalgia", label: "Fibromyalgia / Chronic Pain" },
  { value: "cancer_history", label: "Cancer History" },
  { value: "other", label: "Other (note below)" },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: "none", label: "First time" },
  { value: "occasional", label: "Occasional" },
  { value: "regular", label: "Regular" },
] as const;

export function getFocusAreaLabel(value: string): string {
  return FOCUS_AREAS.find((f) => f.value === value)?.label || value;
}
export function getHealthConditionLabel(value: string): string {
  return HEALTH_CONDITIONS.find((h) => h.value === value)?.label || value;
}
