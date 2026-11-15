import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyPTPortal } from "@/hooks/useMyPTPortal";
import { useMySpaAppointments, type SpaAppointment } from "@/hooks/useSpaBooking";

export interface PTAppt {
  id: string;
  format: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  instructor_id: string | null;
  cancel_reason: string | null;
  instructor_name?: string | null;
}

export interface SpaApptWithStaff extends SpaAppointment {
  staff_name?: string | null;
}

/**
 * Unified appointment history: spa + PT for the signed-in user.
 * Returns upcoming + past, sorted appropriately.
 */
export function useAllAppointmentHistory() {
  const { data: spaAll = [], isLoading: spaLoading } = useMySpaAppointments();

  // PT history comes only from the client-safe pt_my_portal() read (no staff notes).
  const { data: ptPortal, isLoading: ptLoading } = useMyPTPortal();
  const ptAll: PTAppt[] = (ptPortal?.appointments ?? []).map((a: any) => ({
    id: a.id, format: a.format, starts_at: a.starts_at, ends_at: a.ends_at, duration_minutes: a.duration_minutes,
    status: a.status, instructor_id: null, cancel_reason: null, instructor_name: a.trainer || null,
  }));

  // Resolve staff/instructor names
  const staffIds = Array.from(new Set(spaAll.map((s) => s.staff_id).filter(Boolean))) as string[];
  const allIds = staffIds;

  const { data: names = {} } = useQuery({
    queryKey: ["appt-history-staff-names", allIds],
    enabled: allIds.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const [{ data: instr }, { data: thera }] = await Promise.all([
        (supabase.rpc as any)("get_public_instructors"),
        (supabase.rpc as any)("get_public_spa_therapists"),
      ]);
      const m: Record<string, string> = {};
      (instr ?? []).filter((i: any) => allIds.includes(i.id)).forEach((i: any) => { m[i.id] = `${i.first_name} ${i.last_name}`; });
      (thera ?? []).filter((t: any) => allIds.includes(t.id)).forEach((t: any) => { if (!m[t.id]) m[t.id] = t.full_name || `${t.first_name} ${t.last_name}`; });
      return m;
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const upcomingSpa: SpaApptWithStaff[] = spaAll
    .filter((s) =>
      s.appointment_date >= today &&
      ["confirmed", "pending", "checked_in", "in_progress"].includes(s.status as string)
    )
    .map((s) => ({ ...s, staff_name: s.staff_id ? names[s.staff_id] ?? null : null }));

  const pastSpa: SpaApptWithStaff[] = spaAll
    .filter((s) => !upcomingSpa.find((u) => u.id === s.id))
    .map((s) => ({ ...s, staff_name: s.staff_id ? names[s.staff_id] ?? null : null }))
    .sort((a, b) =>
      `${b.appointment_date}T${b.appointment_time}`.localeCompare(`${a.appointment_date}T${a.appointment_time}`)
    );

  const upcomingPT = ptAll
    .filter((p) => p.starts_at >= nowIso && p.status === "scheduled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const pastPT = ptAll
    .filter((p) => p.starts_at < nowIso || p.status !== "scheduled");

  return {
    upcomingSpa,
    pastSpa,
    upcomingPT,
    pastPT,
    isLoading: spaLoading || ptLoading,
  };
}
