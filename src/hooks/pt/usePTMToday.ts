import { useQuery } from "@tanstack/react-query";
import { format as fmtDate, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ptLifecycle, type PTLifecycle } from "./usePTSchedule";

export interface PTMTodayAppointment {
  id: string;
  userId: string;
  clientName: string;
  photoUrl: string | null;
  startsAt: string;
  durationMinutes: number;
  sessionTypeName: string | null;
  locationName: string | null;
  trainerName: string | null;
  lifecycle: PTLifecycle;
  checkedIn: boolean;
}

export interface PTMTodayData {
  trainerName: string;
  trainerId: string | null;
  scopedToTrainer: boolean;
  appointments: PTMTodayAppointment[];
  upNext: PTMTodayAppointment | null;
  active: PTMTodayAppointment | null;
  actions: {
    notesToComplete: number;
    followUps: number;
    packagesExpiring: number;
    reassessmentsDue: number;
    unconfirmed: number;
    openAlerts: number;
  };
}

const dayStartIso = (d: Date) => new Date(`${fmtDate(d, "yyyy-MM-dd")}T00:00:00`).toISOString();
const dayEndIso = (d: Date) => new Date(`${fmtDate(d, "yyyy-MM-dd")}T23:59:59`).toISOString();

/** Everything the mobile Today command center needs, scoped to the signed-in trainer when applicable. */
export function usePTMToday(opts: { isAdmin: boolean }) {
  const today = new Date();
  const dayKey = fmtDate(today, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["ptm-today", dayKey, opts.isAdmin],
    refetchInterval: 60_000,
    staleTime: 15_000,
    queryFn: async (): Promise<PTMTodayData> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;

      const { data: me } = uid
        ? await (supabase as any)
            .from("instructors")
            .select("id, first_name, last_name")
            .eq("user_id", uid)
            .maybeSingle()
        : { data: null };

      const trainerId = me?.id ?? null;
      const scopedToTrainer = !opts.isAdmin && !!trainerId;

      let q = (supabase as any)
        .from("pt_appointments")
        .select("*")
        .gte("starts_at", dayStartIso(today))
        .lte("starts_at", dayEndIso(today))
        .order("starts_at", { ascending: true });
      if (scopedToTrainer) q = q.eq("instructor_id", trainerId);
      const { data: appts, error } = await q;
      if (error) throw error;
      const rows = (appts ?? []) as any[];

      const userIds = Array.from(new Set(rows.map((a) => a.user_id).filter(Boolean)));
      const typeIds = Array.from(new Set(rows.map((a) => a.session_type_id).filter(Boolean)));
      const locIds = Array.from(new Set(rows.map((a) => a.location_id).filter(Boolean)));
      const trainerIds = Array.from(new Set(rows.map((a) => a.instructor_id).filter(Boolean)));

      const soon = fmtDate(addDays(today, 21), "yyyy-MM-dd");

      const [
        { data: profiles }, { data: members }, { data: types }, { data: locs }, { data: trainers },
        { data: notes }, { data: passes }, { data: programs }, { data: alerts }, { data: recentDone },
      ] = await Promise.all([
        userIds.length
          ? (supabase as any).from("pt_client_profiles").select("user_id, full_name, email").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        userIds.length
          ? (supabase as any).from("members").select("user_id, first_name, last_name, email, photo_url").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        typeIds.length
          ? (supabase as any).from("pt_session_types").select("id, name, duration_minutes").in("id", typeIds)
          : Promise.resolve({ data: [] }),
        locIds.length
          ? (supabase as any).from("pt_locations").select("id, name").in("id", locIds)
          : Promise.resolve({ data: [] }),
        trainerIds.length
          ? (supabase as any).from("instructors").select("id, first_name, last_name").in("id", trainerIds)
          : Promise.resolve({ data: [] }),
        (supabase as any).from("pt_session_notes").select("appointment_id, is_draft"),
        (supabase as any).from("pt_passes")
          .select("id, user_id, sessions_remaining, expires_at, status")
          .eq("status", "active"),
        (supabase as any).from("pt_programs")
          .select("id, user_id, next_reassessment, status")
          .eq("status", "active")
          .not("next_reassessment", "is", null)
          .lte("next_reassessment", soon),
        (supabase as any).from("pt_alerts")
          .select("id, client_user_id, alert_type, severity, is_resolved, assigned_to")
          .eq("is_resolved", false),
        (supabase as any).from("pt_appointments")
          .select("id, instructor_id, status, completed_at")
          .eq("status", "completed")
          .gte("completed_at", addDays(today, -14).toISOString()),
      ]);

      const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const memMap = new Map((members ?? []).map((m: any) => [m.user_id, m]));
      const typeMap = new Map((types ?? []).map((t: any) => [t.id, t]));
      const locMap = new Map((locs ?? []).map((l: any) => [l.id, l]));
      const trainerMap = new Map((trainers ?? []).map((t: any) => [t.id, t]));

      const nameFor = (userId: string) => {
        const p: any = profMap.get(userId);
        const m: any = memMap.get(userId);
        return (
          p?.full_name ||
          [m?.first_name, m?.last_name].filter(Boolean).join(" ") ||
          p?.email || m?.email || "Client"
        );
      };

      const appointments: PTMTodayAppointment[] = rows.map((a) => {
        const t: any = a.session_type_id ? typeMap.get(a.session_type_id) : null;
        const tr: any = a.instructor_id ? trainerMap.get(a.instructor_id) : null;
        return {
          id: a.id,
          userId: a.user_id,
          clientName: nameFor(a.user_id),
          photoUrl: (memMap.get(a.user_id) as any)?.photo_url ?? null,
          startsAt: a.starts_at,
          durationMinutes: a.duration_minutes ?? t?.duration_minutes ?? 60,
          sessionTypeName: t?.name ?? (a.format ? String(a.format).replace(/_/g, " ") : null),
          locationName: a.location_id ? ((locMap.get(a.location_id) as any)?.name ?? null) : null,
          trainerName: tr ? [tr.first_name, tr.last_name].filter(Boolean).join(" ") : null,
          lifecycle: ptLifecycle(a),
          checkedIn: !!a.checked_in_at,
        };
      });

      const now = Date.now();
      const active = appointments.find((a) => a.lifecycle === "in_progress") ?? null;
      const upNext =
        appointments.find(
          (a) =>
            !["cancelled", "completed", "no_show"].includes(a.lifecycle) &&
            new Date(a.startsAt).getTime() + a.durationMinutes * 60000 > now,
        ) ?? null;

      // Action items
      const noteByAppt = new Map((notes ?? []).map((n: any) => [n.appointment_id, n]));
      const completedScope = (recentDone ?? []).filter((a: any) =>
        scopedToTrainer ? a.instructor_id === trainerId : true,
      );
      const notesToComplete = completedScope.filter((a: any) => {
        const n: any = noteByAppt.get(a.id);
        return !n || n.is_draft;
      }).length;

      const clientScope = scopedToTrainer
        ? new Set(appointments.map((a) => a.userId))
        : null;
      const inScope = (userId: string) => !clientScope || clientScope.has(userId);

      const packagesExpiring = (passes ?? []).filter(
        (p: any) =>
          inScope(p.user_id) &&
          ((p.expires_at && p.expires_at <= soon) || (p.sessions_remaining ?? 0) <= 2),
      ).length;

      const reassessmentsDue = (programs ?? []).filter((p: any) => inScope(p.user_id)).length;

      const openAlertRows = (alerts ?? []).filter((a: any) => inScope(a.client_user_id));
      const followUps = openAlertRows.filter((a: any) => a.alert_type === "follow_up").length;
      const openAlerts = openAlertRows.length - followUps;

      const unconfirmed = appointments.filter(
        (a) => a.lifecycle === "scheduled" || a.lifecycle === "tentative",
      ).length;

      return {
        trainerName: me ? [me.first_name, me.last_name].filter(Boolean).join(" ") : "there",
        trainerId,
        scopedToTrainer,
        appointments,
        upNext,
        active,
        actions: { notesToComplete, followUps, packagesExpiring, reassessmentsDue, unconfirmed, openAlerts },
      };
    },
  });
}
