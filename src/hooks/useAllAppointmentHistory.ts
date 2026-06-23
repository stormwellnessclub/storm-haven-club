import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
  const { user } = useAuth();
  const { data: spaAll = [], isLoading: spaLoading } = useMySpaAppointments();

  const { data: ptAll = [], isLoading: ptLoading } = useQuery({
    queryKey: ["my-pt-appointments-all", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<PTAppt[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_appointments")
        .select("id, format, starts_at, ends_at, duration_minutes, status, instructor_id, cancel_reason")
        .eq("user_id", user!.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PTAppt[];
    },
  });

  // Resolve staff/instructor names
  const staffIds = Array.from(new Set(spaAll.map((s) => s.staff_id).filter(Boolean))) as string[];
  const instructorIds = Array.from(new Set(ptAll.map((p) => p.instructor_id).filter(Boolean))) as string[];
  const allIds = Array.from(new Set([...staffIds, ...instructorIds]));

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
    .map((p) => ({ ...p, instructor_name: p.instructor_id ? names[p.instructor_id] ?? null : null }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const pastPT = ptAll
    .filter((p) => p.starts_at < nowIso || p.status !== "scheduled")
    .map((p) => ({ ...p, instructor_name: p.instructor_id ? names[p.instructor_id] ?? null : null }));

  return {
    upcomingSpa,
    pastSpa,
    upcomingPT,
    pastPT,
    isLoading: spaLoading || ptLoading,
  };
}
