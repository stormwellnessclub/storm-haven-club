import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PTMNextSessionData {
  appointment: any | null;
  client: {
    userId: string;
    name: string;
    email: string | null;
    phone: string | null;
    photoUrl: string | null;
  } | null;
  profile: any | null;
  sessionType: { id: string; name: string; duration_minutes: number } | null;
  location: { id: string; name: string; address: string | null } | null;
  trainer: { id: string; name: string } | null;
  pass: {
    id: string;
    pack_name: string | null;
    sessions_total: number | null;
    sessions_remaining: number | null;
    expires_at: string | null;
    status: string | null;
  } | null;
  lastNote: {
    session_date: string | null;
    next_focus: string | null;
    modifications: string | null;
    pain_discomfort: string | null;
  } | null;
  overdueForms: { id: string; title: string | null; doc_type: string; expires_at: string | null; status: string }[];
  reassessmentDue: string | null;
  alerts: { id: string; message: string; severity: string; alert_type: string }[];
}

const asArray = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.label ?? x?.name ?? x?.note ?? "")).filter(Boolean);
  if (typeof v === "string") return v.trim() ? [v] : [];
  if (typeof v === "object") return Object.values(v).map(String).filter(Boolean);
  return [];
};

export const ptmListFrom = asArray;

/**
 * Loads everything the Next Session screen needs.
 * When `appointmentId` is omitted the next upcoming (non-cancelled) session is used.
 */
export function usePTMNextSession(appointmentId?: string) {
  return useQuery({
    queryKey: ["ptm-next-session", appointmentId ?? "next"],
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<PTMNextSessionData> => {
      const empty: PTMNextSessionData = {
        appointment: null, client: null, profile: null, sessionType: null, location: null,
        trainer: null, pass: null, lastNote: null, overdueForms: [], reassessmentDue: null, alerts: [],
      };

      let appt: any = null;
      if (appointmentId) {
        const { data, error } = await (supabase as any)
          .from("pt_appointments").select("*").eq("id", appointmentId).maybeSingle();
        if (error) throw error;
        appt = data;
      } else {
        const { data, error } = await (supabase as any)
          .from("pt_appointments")
          .select("*")
          .gte("starts_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .in("status", ["scheduled"])
          .order("starts_at", { ascending: true })
          .limit(1);
        if (error) throw error;
        appt = data?.[0] ?? null;
      }
      if (!appt) return empty;

      const [
        { data: profile }, { data: member }, { data: auth },
        { data: sessionType }, { data: location },
        { data: passes }, { data: notes }, { data: docs }, { data: programs }, { data: alerts },
      ] = await Promise.all([
        (supabase as any).from("pt_client_profiles").select("*").eq("user_id", appt.user_id).maybeSingle(),
        (supabase as any).from("members")
          .select("user_id, first_name, last_name, email, phone, photo_url").eq("user_id", appt.user_id).maybeSingle(),
        (supabase as any).from("profiles")
          .select("id, first_name, last_name, email, phone").eq("id", appt.user_id).maybeSingle(),
        appt.session_type_id
          ? (supabase as any).from("pt_session_types").select("id, name, duration_minutes").eq("id", appt.session_type_id).maybeSingle()
          : Promise.resolve({ data: null }),
        appt.location_id
          ? (supabase as any).from("pt_locations").select("id, name, address").eq("id", appt.location_id).maybeSingle()
          : Promise.resolve({ data: null }),
        (supabase as any).from("pt_passes")
          .select("id, pack_name, sessions_total, sessions_remaining, expires_at, status")
          .eq("user_id", appt.user_id).eq("status", "active").order("expires_at", { ascending: true }),
        (supabase as any).from("pt_session_notes")
          .select("session_date, next_focus, modifications, pain_discomfort")
          .eq("user_id", appt.user_id).eq("is_draft", false)
          .order("session_date", { ascending: false }).limit(1),
        (supabase as any).from("pt_documents")
          .select("id, title, doc_type, status, expires_at").eq("user_id", appt.user_id),
        (supabase as any).from("pt_programs")
          .select("next_reassessment, status").eq("user_id", appt.user_id).eq("status", "active")
          .not("next_reassessment", "is", null).order("next_reassessment", { ascending: true }).limit(1),
        (supabase as any).from("pt_alerts")
          .select("id, message, severity, alert_type").eq("client_user_id", appt.user_id).eq("is_resolved", false),
      ]);

      let trainer: PTMNextSessionData["trainer"] = null;
      if (appt.instructor_id) {
        const { data: t } = await (supabase as any)
          .from("instructors").select("id, name").eq("id", appt.instructor_id).maybeSingle();
        if (t) trainer = { id: t.id, name: t.name };
      }

      const name =
        profile?.full_name ||
        [member?.first_name, member?.last_name].filter(Boolean).join(" ") ||
        [auth?.first_name, auth?.last_name].filter(Boolean).join(" ") ||
        profile?.email || member?.email || auth?.email || "Client";

      const today = new Date().toISOString().slice(0, 10);
      const overdueForms = (docs ?? []).filter(
        (d: any) => d.status !== "completed" || (d.expires_at && d.expires_at < today),
      );
      if (profile?.parq_status && profile.parq_status !== "complete" && profile.parq_status !== "completed") {
        overdueForms.unshift({
          id: "parq", title: "PAR-Q health screening", doc_type: "parq",
          status: profile.parq_status, expires_at: profile.parq_expires_at ?? null,
        });
      }

      return {
        appointment: appt,
        client: {
          userId: appt.user_id,
          name,
          email: profile?.email ?? member?.email ?? auth?.email ?? null,
          phone: profile?.phone ?? member?.phone ?? auth?.phone ?? null,
          photoUrl: member?.photo_url ?? null,
        },
        profile: profile ?? null,
        sessionType: sessionType ?? null,
        location: location ?? null,
        trainer,
        pass: (passes ?? [])[0] ?? null,
        lastNote: (notes ?? [])[0] ?? null,
        overdueForms,
        reassessmentDue: (programs ?? [])[0]?.next_reassessment ?? null,
        alerts: alerts ?? [],
      };
    },
  });
}
