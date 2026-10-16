import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/** Body wrap services get the Body Wrap intake instead of the massage intake. */
export function isBodyWrapService(category?: string | null, name?: string | null): boolean {
  const c = (category || "").toLowerCase();
  const n = (name || "").toLowerCase();
  return c.includes("wrap") || n.includes("wrap");
}

export type IntakeKind = "massage" | "body_wrap";

export function intakeKindFor(category?: string | null, name?: string | null): IntakeKind | null {
  if (isBodyWrapService(category, name)) return "body_wrap";
  const c = (category || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (c.includes("massage") || c.includes("body") || n.includes("massage")) return "massage";
  return null;
}

export const BW_HEALTH_QUESTIONS: { key: string; label: string }[] = [
  { key: "infectious_disease", label: "An infectious disease" },
  { key: "heart_circulation", label: "Heart or circulation issues" },
  { key: "cancer", label: "Cancer" },
  { key: "high_blood_pressure", label: "High blood pressure" },
  { key: "low_blood_pressure", label: "Low blood pressure or fainting" },
  { key: "varicose_veins", label: "Varicose veins" },
  { key: "epilepsy", label: "Epilepsy" },
  { key: "diabetes", label: "Diabetes" },
  { key: "skin_problems", label: "Skin problems" },
  { key: "open_cuts", label: "Open cuts, recent waxing, or recent sunburn" },
  { key: "arthritis", label: "Arthritis / tendonitis" },
  { key: "numbness", label: "Numbness" },
  { key: "osteoporosis", label: "Osteoporosis" },
  { key: "sprains", label: "Sprains / strains" },
  { key: "fibromyalgia", label: "Fibromyalgia" },
  { key: "edema", label: "Edema (swelling)" },
  { key: "tmj", label: "TMJ" },
  { key: "kidney_liver", label: "Kidney or liver conditions" },
  { key: "thyroid", label: "Thyroid conditions" },
  { key: "claustrophobia", label: "Claustrophobia or anxiety when wrapped" },
  { key: "allergic_lotions", label: "Allergic to lotions or oils" },
  { key: "allergic_nuts", label: "Allergic to nuts" },
  { key: "allergic_iodine", label: "Allergic or sensitive to iodine or shellfish" },
  { key: "pregnant", label: "Pregnant, recently pregnant, or breastfeeding" },
  { key: "heat_sensitive", label: "Sensitive to heat" },
  { key: "recent_surgery", label: "Recent surgery or major accident" },
  { key: "spinal_injury", label: "Neck, back, or spinal injuries" },
];

export const BW_ACKNOWLEDGEMENTS: { key: string; text: string }[] = [
  { key: "purpose", text: "I understand my body wrap treatment is for relaxation and to assist with the release and elimination of toxins from the body. I understand inch-loss results vary from person to person and from session to session." },
  { key: "contraindications", text: "I am aware of the conditions that prevent someone from receiving a body wrap, and none apply to me." },
  { key: "not_medical", text: "I understand the Spa Aella team does not diagnose conditions or illnesses, or prescribe medical or pharmaceutical treatment. This body wrap is not a substitute for a medical examination, and I should contact a licensed health care provider for any medical or health condition. I understand some detox symptoms may occur after this service." },
  { key: "accurate", text: "It is my choice to receive this body wrap. I have answered this form truthfully and accurately to the best of my knowledge, and I will report any changes in my health." },
  { key: "no_show", text: "I understand a no-call / no-show will be charged the full price of the service." },
];

export interface BodyWrapIntake {
  id: string;
  appointment_id: string;
  user_id: string;
  member_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  health_answers: Record<string, boolean>;
  health_details: string | null;
  other_allergies: string | null;
  medications: string | null;
  goals: string | null;
  ate_and_hydrated: boolean | null;
  acknowledgements: Record<string, string>;
  measurement_consent: boolean;
  signature_name: string | null;
  signature_image: string | null;
  signed_at: string | null;
  guardian_name: string | null;
  guardian_signature_image: string | null;
  guardian_signed_at: string | null;
  practitioner_name: string | null;
  practitioner_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BodyWrapIntakeInput = Omit<
  BodyWrapIntake,
  "id" | "user_id" | "signed_at" | "guardian_signed_at" | "practitioner_name" | "practitioner_signed_at" | "created_at" | "updated_at"
>;

export function isUnder18(dob?: string | null): boolean {
  if (!dob) return false;
  const d = new Date(dob + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 18;
}

export function useBodyWrapIntake(appointmentId: string | null | undefined) {
  return useQuery({
    queryKey: ["spa-body-wrap-intake", appointmentId],
    enabled: !!appointmentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("spa_body_wrap_intakes")
        .select("*")
        .eq("appointment_id", appointmentId)
        .maybeSingle();
      if (error) throw error;
      return data as BodyWrapIntake | null;
    },
  });
}

export function useSubmitBodyWrapIntake() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: BodyWrapIntakeInput) => {
      if (!user) throw new Error("You must be signed in.");
      const now = new Date().toISOString();
      const payload = {
        ...input,
        user_id: user.id,
        signed_at: input.signature_image ? now : null,
        guardian_signed_at: input.guardian_signature_image ? now : null,
      };
      const { data, error } = await (supabase.from as any)("spa_body_wrap_intakes")
        .upsert(payload, { onConflict: "appointment_id" })
        .select()
        .single();
      if (error) throw error;
      return data as BodyWrapIntake;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["spa-body-wrap-intake", vars.appointment_id] });
      qc.invalidateQueries({ queryKey: ["my-intake-forms"] });
      toast.success("Body wrap intake saved");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save intake form"),
  });
}

export function usePractitionerSignBodyWrap() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, appointmentId, name }: { id: string; appointmentId: string; name: string }) => {
      const { error } = await (supabase.from as any)("spa_body_wrap_intakes")
        .update({ practitioner_signed_by: user?.id, practitioner_name: name, practitioner_signed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return appointmentId;
    },
    onSuccess: (appointmentId) => {
      qc.invalidateQueries({ queryKey: ["spa-body-wrap-intake", appointmentId] });
      toast.success("Practitioner sign-off saved");
    },
    onError: (e: any) => toast.error(e?.message || "Could not sign off"),
  });
}

export interface MyIntakeEntry {
  kind: IntakeKind;
  appointment_id: string;
  submitted_at: string;
  service_name: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  service_category: string | null;
  member_id: string | null;
}

/** Every intake (massage + body wrap) the signed-in person has submitted. */
export function useMyIntakeForms() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-intake-forms", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [m, b] = await Promise.all([
        (supabase.from as any)("spa_intake_forms").select("appointment_id, updated_at").eq("user_id", user!.id),
        (supabase.from as any)("spa_body_wrap_intakes").select("appointment_id, updated_at").eq("user_id", user!.id),
      ]);
      if (m.error) throw m.error;
      if (b.error) throw b.error;
      const rows: { kind: IntakeKind; appointment_id: string; updated_at: string }[] = [
        ...(m.data || []).map((r: any) => ({ kind: "massage" as const, ...r })),
        ...(b.data || []).map((r: any) => ({ kind: "body_wrap" as const, ...r })),
      ];
      const ids = [...new Set(rows.map((r) => r.appointment_id))];
      const appts: Record<string, any> = {};
      if (ids.length) {
        const { data } = await supabase
          .from("spa_appointments")
          .select("id, service_name, service_category, appointment_date, appointment_time, member_id")
          .in("id", ids);
        (data || []).forEach((a: any) => (appts[a.id] = a));
      }
      return rows
        .map<MyIntakeEntry>((r) => ({
          kind: r.kind,
          appointment_id: r.appointment_id,
          submitted_at: r.updated_at,
          service_name: appts[r.appointment_id]?.service_name ?? null,
          service_category: appts[r.appointment_id]?.service_category ?? null,
          appointment_date: appts[r.appointment_id]?.appointment_date ?? null,
          appointment_time: appts[r.appointment_id]?.appointment_time ?? null,
          member_id: appts[r.appointment_id]?.member_id ?? null,
        }))
        .sort((a, b) => (b.appointment_date || "").localeCompare(a.appointment_date || ""));
    },
  });
}
