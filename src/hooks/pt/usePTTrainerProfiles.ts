import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PTTrainerProfile {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  photo_url: string | null;
  specialties: string[];
  is_active: boolean;
  is_public_pt: boolean;
  is_master: boolean;
  employment_status: string | null;
  schedule_color: string | null;
  default_location_id: string | null;
  /** metrics */
  upcoming: number;
  completed90: number;
  scheduled90: number;
  noShows90: number;
  cancels90: number;
  attendanceRate: number | null;
  notesCompletionRate: number | null;
  retentionRate: number | null;
  packageUtilization: number | null;
  assignedClients: number;
}

/** Trainer directory with live performance metrics computed from real records. */
export function usePTTrainerProfiles() {
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString();
  }, []);

  return useQuery({
    queryKey: ["pt-trainer-profiles", since.slice(0, 10)],
    queryFn: async (): Promise<PTTrainerProfile[]> => {
      const nowIso = new Date().toISOString();
      const [instructors, appts, notes, links, passes] = await Promise.all([
        // Contact + pay columns are staff-only; fetched via SECURITY DEFINER RPC.
        (supabase as any).rpc("get_instructors_with_contact"),
        (supabase as any)
          .from("pt_appointments")
          .select("id, instructor_id, user_id, starts_at, status")
          .gte("starts_at", since)
          .limit(5000),
        (supabase as any)
          .from("pt_session_notes")
          .select("id, appointment_id, instructor_id, created_at")
          .gte("created_at", since)
          .limit(5000),
        (supabase as any).from("pt_client_trainers").select("instructor_id, client_user_id, ended_at"),
        (supabase as any).from("pt_passes").select("id, user_id, sessions_total, sessions_remaining, status"),
      ]);

      const apptRows: any[] = appts.data ?? [];
      const noteRows: any[] = notes.data ?? [];
      const linkRows: any[] = links.data ?? [];
      const passRows: any[] = passes.data ?? [];

      const notedAppointments = new Set(noteRows.map((n) => n.appointment_id).filter(Boolean));

      return (instructors.data ?? []).map((t: any) => {
        const mine = apptRows.filter((a) => a.instructor_id === t.id);
        const past = mine.filter((a) => a.starts_at < nowIso);
        const completed = past.filter((a) => a.status === "completed");
        const noShows = past.filter((a) => a.status === "no_show");
        const cancels = past.filter((a) => a.status === "cancelled" || a.status === "late_cancel");
        const upcoming = mine.filter((a) => a.starts_at >= nowIso && a.status === "scheduled").length;

        const attendanceBase = completed.length + noShows.length + cancels.length;
        const withNotes = completed.filter((a) => notedAppointments.has(a.id)).length;

        // Retention: clients seen in the last 90 days who also have an upcoming or recent repeat booking
        const clientSessions = new Map<string, number>();
        past.forEach((a) => a.user_id && clientSessions.set(a.user_id, (clientSessions.get(a.user_id) || 0) + 1));
        const repeatClients = Array.from(clientSessions.values()).filter((n) => n > 1).length;

        const assigned = linkRows.filter((l) => l.instructor_id === t.id && !l.ended_at);
        const assignedIds = new Set(assigned.map((l) => l.client_user_id));
        const clientPasses = passRows.filter((p) => assignedIds.has(p.user_id));
        const totalSold = clientPasses.reduce((s, p) => s + (p.sessions_total || 0), 0);
        const totalUsed = clientPasses.reduce((s, p) => s + ((p.sessions_total || 0) - (p.sessions_remaining || 0)), 0);

        return {
          id: t.id,
          user_id: t.user_id,
          name: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim(),
          email: t.email,
          phone: t.phone,
          bio: t.bio,
          photo_url: t.photo_url,
          specialties: Array.isArray(t.specialties) ? t.specialties : [],
          is_active: !!t.is_active,
          is_public_pt: !!t.is_public_pt,
          is_master: !!t.is_master,
          employment_status: t.employment_status,
          schedule_color: t.schedule_color,
          default_location_id: t.default_location_id,
          upcoming,
          completed90: completed.length,
          scheduled90: mine.length,
          noShows90: noShows.length,
          cancels90: cancels.length,
          attendanceRate: attendanceBase ? Math.round((completed.length / attendanceBase) * 100) : null,
          notesCompletionRate: completed.length ? Math.round((withNotes / completed.length) * 100) : null,
          retentionRate: clientSessions.size ? Math.round((repeatClients / clientSessions.size) * 100) : null,
          packageUtilization: totalSold ? Math.round((totalUsed / totalSold) * 100) : null,
          assignedClients: assignedIds.size,
        };
      });
    },
  });
}

export function usePTTrainerDetail(instructorId?: string) {
  const availability = useQuery({
    queryKey: ["pt-trainer-availability", instructorId],
    enabled: !!instructorId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_trainer_availability")
        .select("id, weekday, start_time, end_time")
        .eq("instructor_id", instructorId)
        .order("weekday");
      return data ?? [];
    },
  });

  const locations = useQuery({
    queryKey: ["pt-trainer-locations", instructorId],
    enabled: !!instructorId,
    queryFn: async () => {
      const [{ data: links }, { data: all }] = await Promise.all([
        (supabase as any).from("pt_trainer_locations").select("location_id").eq("instructor_id", instructorId),
        (supabase as any).from("pt_locations").select("id, name, code, color, is_active"),
      ]);
      const ids = new Set((links ?? []).map((l: any) => l.location_id));
      return (all ?? []).filter((l: any) => ids.has(l.id));
    },
  });

  const upcoming = useQuery({
    queryKey: ["pt-trainer-upcoming-list", instructorId],
    enabled: !!instructorId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_appointments")
        .select("id, user_id, starts_at, duration_minutes, status, format, location_id")
        .eq("instructor_id", instructorId)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(25);
      return data ?? [];
    },
  });

  const clients = useQuery({
    queryKey: ["pt-trainer-clients", instructorId],
    enabled: !!instructorId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_client_trainers")
        .select("client_user_id, relationship, assigned_at, ended_at")
        .eq("instructor_id", instructorId)
        .is("ended_at", null);
      return data ?? [];
    },
  });

  const notes = useQuery({
    queryKey: ["pt-trainer-notes", instructorId],
    enabled: !!instructorId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_notes")
        .select("id, body, created_at, scope")
        .eq("instructor_id", instructorId)
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  return { availability, locations, upcoming, clients, notes };
}
