import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SPA_PATHS } from "@/lib/spaRoutes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Answers, ReviewState, ScreeningQuestion, SpaPreparation } from "@/lib/aellaSculptForms";

// Keep `from` bound to the client; an unbound `supabase.from` throws before any request is sent.
const db = (table: string) => (supabase as any).from(table);
export const SCULPT_KEY = "aella-sculpt";

export function useScreeningQuestions(serviceKey = SCULPT_KEY, includeInactive = false) {
  return useQuery({
    queryKey: ["spa-screening-questions", serviceKey, includeInactive],
    queryFn: async (): Promise<ScreeningQuestion[]> => {
      let q = db("spa_screening_questions").select("*").eq("service_key", serviceKey).order("sort_order").order("created_at");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ScreeningQuestion[];
    },
  });
}

export interface SculptIntake {
  id: string; appointment_id: string; user_id: string; zone_name: string | null; answers: Answers;
  answers_snapshot: { id: string; section: string; title: string | null; prompt: string; answer: string[]; detail: string | null; detail_prompt: string | null; flag: "review" | "hold" | null }[];
  screening_level: "clear" | "review" | "hold"; submitted_at: string; updated_at: string;
}
export interface SculptConsent {
  id: string; appointment_id: string; user_id: string; consent_version: string; acknowledgements: Record<string, boolean>;
  consent_agreed: boolean; printed_name: string; signature_image: string; signed_on: string; signed_at: string;
  provider_ack_by: string | null; provider_ack_name: string | null; provider_ack_at: string | null;
}
export interface SculptFormStatus {
  appointment_id: string; intake_done: boolean; consent_done: boolean; provider_ack: boolean | null; photo_consent: boolean | null;
  review_state: ReviewState | null; screening_level: string | null; review_decision: "cleared" | "not_cleared" | null;
  reviewed_by_name: string | null; reviewed_at: string | null; intake_appointment_id: string | null;
}

/** The intake saved for this appointment, or the client's latest one to prefill from. */
export function useSculptIntake(appointmentId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ["sculpt-intake", appointmentId, userId],
    enabled: !!appointmentId,
    queryFn: async (): Promise<{ own: SculptIntake | null; latest: SculptIntake | null }> => {
      const { data: own, error } = await db("spa_sculpt_intakes").select("*").eq("appointment_id", appointmentId).maybeSingle();
      if (error) throw error;
      if (own || !userId) return { own: own ?? null, latest: own ?? null };
      const { data: latest } = await db("spa_sculpt_intakes").select("*").eq("user_id", userId).eq("service_key", SCULPT_KEY).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      return { own: null, latest: latest ?? null };
    },
  });
}

export function useSculptConsent(appointmentId: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ["sculpt-consent", appointmentId, userId],
    enabled: !!appointmentId,
    queryFn: async (): Promise<{ own: SculptConsent | null; latest: SculptConsent | null }> => {
      const { data: own, error } = await db("spa_sculpt_consents").select("*").eq("appointment_id", appointmentId).maybeSingle();
      if (error) throw error;
      if (own || !userId) return { own: own ?? null, latest: own ?? null };
      const { data: latest } = await db("spa_sculpt_consents").select("*").eq("user_id", userId).eq("service_key", SCULPT_KEY).order("signed_at", { ascending: false }).limit(1).maybeSingle();
      return { own: null, latest: latest ?? null };
    },
  });
}

export function usePhotoConsent(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["sculpt-photo-consent", userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ consent: boolean; decided_at: string } | null> => {
      const { data, error } = await db("spa_photo_consents").select("consent, decided_at").eq("user_id", userId).eq("service_key", SCULPT_KEY).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSculptFormStatus(appointmentIds: string[]) {
  const ids = [...new Set(appointmentIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["sculpt-form-status", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("spa_sculpt_form_status", { p_appointment_ids: ids });
      if (error) throw error;
      return new Map<string, SculptFormStatus>(((data ?? []) as SculptFormStatus[]).map((r) => [r.appointment_id, r]));
    },
  });
}

const invalidateForms = (qc: ReturnType<typeof useQueryClient>) => {
  ["sculpt-intake", "sculpt-consent", "sculpt-photo-consent", "sculpt-form-status", "my-intake-forms", "sculpt-reviews"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
};

export function useSaveSculptIntake() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ appointmentId, answers }: { appointmentId: string; answers: Answers }) => {
      if (!user) throw new Error("Please sign in.");
      const { error } = await db("spa_sculpt_intakes").upsert(
        { appointment_id: appointmentId, user_id: user.id, service_key: SCULPT_KEY, answers },
        { onConflict: "appointment_id" },
      );
      if (error) throw new Error(error.message || "Could not save your intake.");
    },
    onSuccess: () => { invalidateForms(qc); toast.success("Intake saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveSculptConsent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (v: { appointmentId: string; acknowledgements: Record<string, boolean>; printedName: string; signature: string; signedOn: string; version: string }) => {
      if (!user) throw new Error("Please sign in.");
      const { error } = await db("spa_sculpt_consents").upsert({
        appointment_id: v.appointmentId, user_id: user.id, service_key: SCULPT_KEY, consent_version: v.version,
        acknowledgements: v.acknowledgements, consent_agreed: true, printed_name: v.printedName.trim(), signature_image: v.signature, signed_on: v.signedOn,
      }, { onConflict: "appointment_id" });
      if (error) throw new Error(error.message || "Could not save your consent.");
    },
    onSuccess: () => { invalidateForms(qc); toast.success("Consent signed"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSavePhotoConsent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ consent, appointmentId }: { consent: boolean; appointmentId: string | null }) => {
      if (!user) throw new Error("Please sign in.");
      const { error } = await db("spa_photo_consents").upsert(
        { user_id: user.id, service_key: SCULPT_KEY, consent, appointment_id: appointmentId, decided_at: new Date().toISOString() },
        { onConflict: "user_id,service_key" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { invalidateForms(qc); toast.success("Photography choice saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface ScreeningReview { id: string; decision: "cleared" | "not_cleared"; note: string; reviewer_name: string | null; reviewed_at: string }
export function useScreeningReviews(intakeId: string | null | undefined) {
  return useQuery({
    queryKey: ["sculpt-reviews", intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<ScreeningReview[]> => {
      const { data, error } = await db("spa_screening_reviews").select("id, decision, note, reviewer_name, reviewed_at").eq("intake_id", intakeId).order("reviewed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordScreeningReview() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ intakeId, decision, note }: { intakeId: string; decision: "cleared" | "not_cleared"; note: string }) => {
      const { error } = await db("spa_screening_reviews").insert({ intake_id: intakeId, decision, note: note.trim(), reviewed_by: user?.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { invalidateForms(qc); toast.success("Review recorded"); },
    onError: (e: Error) => toast.error(e.message || "Could not record the review"),
  });
}

export function useAcknowledgeSculptConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (consentId: string) => {
      const { error } = await db("spa_sculpt_consents").update({ provider_ack_at: new Date().toISOString() }).eq("id", consentId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { invalidateForms(qc); toast.success("Consent acknowledged"); },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });
}

/** Preparation instructions for spa services that have them, keyed by service id. */
export function useSpaPreparations() {
  return useQuery({
    queryKey: ["spa-preparations"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await db("spa_services").select("id, service_key, preparation").not("preparation", "is", null);
      return new Map<string, { service_key: string | null; preparation: SpaPreparation }>(
        (data ?? []).map((r: any) => [String(r.id), { service_key: r.service_key, preparation: r.preparation }]),
      );
    },
  });
}

/** Where the full preparation page lives for a service. */
export const preparationPath = (serviceKey: string | null | undefined) =>
  serviceKey === SCULPT_KEY ? SPA_PATHS.sculptPreparation : null;
