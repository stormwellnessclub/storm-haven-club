import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { minutesToTime, timeToMinutes } from "@/lib/studios";

export interface StudioSession {
  id: string;
  class_type_id: string;
  schedule_id: string | null;
  instructor_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  max_capacity: number;
  current_enrollment: number;
  is_cancelled: boolean;
  is_hidden: boolean;
  is_invite_only: boolean | null;
  is_fundraiser: boolean | null;
  session_notes: string | null;
  cancellation_reason: string | null;
  class_types: { id: string; name: string; category: string; duration_minutes: number | null } | null;
  instructors: { id: string; first_name: string; last_name: string } | null;
}

export interface StudioTemplate {
  id: string;
  class_type_id: string;
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  max_capacity: number;
  is_active: boolean;
  is_one_time: boolean | null;
  effective_from: string | null;
  effective_until: string | null;
  class_types: { id: string; name: string; category: string; duration_minutes: number | null } | null;
  instructors: { id: string; first_name: string; last_name: string } | null;
}

const SESSION_SELECT = `
  id, class_type_id, schedule_id, instructor_id, session_date, start_time, end_time, room,
  max_capacity, current_enrollment, is_cancelled, is_hidden, is_invite_only, is_fundraiser,
  session_notes, cancellation_reason,
  class_types!inner (id, name, category, duration_minutes),
  instructors (id, first_name, last_name)
`;

export function useStudioSessions(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["class-studio-sessions", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select(SESSION_SELECT)
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date")
        .order("start_time");
      if (error) throw error;
      return (data || []) as unknown as StudioSession[];
    },
    staleTime: 15_000,
  });
}

export function useStudioTemplates() {
  return useQuery({
    queryKey: ["class-studio-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_schedules")
        .select(
          `id, class_type_id, instructor_id, day_of_week, start_time, end_time, room, max_capacity,
           is_active, is_one_time, effective_from, effective_until,
           class_types!inner (id, name, category, duration_minutes),
           instructors (id, first_name, last_name)`,
        )
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data || []) as unknown as StudioTemplate[];
    },
    staleTime: 60_000,
  });
}

export function useClassTypesLite() {
  return useQuery({
    queryKey: ["class-studio-class-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_types")
        .select("id, name, category, duration_minutes, max_capacity, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useInstructorsLite() {
  return useQuery({
    queryKey: ["class-studio-instructors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, first_name, last_name, is_active")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useWaitlistCounts(sessionIds: string[]) {
  const key = sessionIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["class-studio-waitlist", key],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_waitlist_counts", {
        p_session_ids: sessionIds,
      });
      if (error) throw error;
      const map: Record<string, number> = {};
      (data as any[] | null)?.forEach((row: any) => {
        map[row.session_id] = Number(row.waiting_count ?? row.count ?? 0);
      });
      return map;
    },
    staleTime: 30_000,
  });
}

export function useStudioMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["class-studio-sessions"] });
    qc.invalidateQueries({ queryKey: ["class-studio-templates"] });
    qc.invalidateQueries({ queryKey: ["admin-class-sessions-day"] });
  };

  const updateSession = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase
        .from("class_sessions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Update failed"),
  });

  /** Move a session to a new time and/or studio, preserving its duration. */
  const moveSession = useMutation({
    mutationFn: async ({
      session,
      newStartMinutes,
      newRoom,
      newDate,
    }: {
      session: StudioSession;
      newStartMinutes?: number;
      newRoom?: string;
      newDate?: string;
    }) => {
      const duration = timeToMinutes(session.end_time) - timeToMinutes(session.start_time);
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (typeof newStartMinutes === "number") {
        patch.start_time = minutesToTime(newStartMinutes);
        patch.end_time = minutesToTime(newStartMinutes + duration);
      }
      if (newRoom) patch.room = newRoom;
      if (newDate) patch.session_date = newDate;
      const { error } = await supabase.from("class_sessions").update(patch).eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Class moved");
    },
    onError: (e: any) => toast.error(e.message || "Move failed"),
  });

  const createSession = useMutation({
    mutationFn: async (payload: {
      class_type_id: string;
      instructor_id: string | null;
      session_date: string;
      start_time: string;
      end_time: string;
      room: string | null;
      max_capacity: number;
      is_hidden: boolean;
    }) => {
      const { data, error } = await supabase
        .from("class_sessions")
        .insert(payload as any)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message || "Could not add class"),
  });

  const cancelSession = useMutation({
    mutationFn: async ({
      sessionId,
      hide,
      reason,
    }: {
      sessionId: string;
      hide: boolean;
      reason: string;
    }) => {
      const { error } = await supabase.rpc("admin_cancel_class_session", {
        _session_id: sessionId,
        _is_hidden: hide,
        _cancellation_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Class cancelled");
    },
    onError: (e: any) => toast.error(e.message || "Cancel failed"),
  });

  /** Publish every drafted (hidden, not cancelled) session in a date range. */
  const publishDrafts = useMutation({
    mutationFn: async ({ start, end }: { start: string; end: string }) => {
      const { data, error } = await supabase
        .from("class_sessions")
        .update({ is_hidden: false, updated_at: new Date().toISOString() })
        .gte("session_date", start)
        .lte("session_date", end)
        .eq("is_hidden", true)
        .eq("is_cancelled", false)
        .select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: (count) => {
      invalidate();
      toast.success(`Published ${count} class${count === 1 ? "" : "es"}`);
    },
    onError: (e: any) => toast.error(e.message || "Publish failed"),
  });

  const bulkAssignInstructor = useMutation({
    mutationFn: async ({
      start,
      end,
      instructorId,
      fromInstructorId,
      classTypeId,
    }: {
      start: string;
      end: string;
      instructorId: string;
      fromInstructorId?: string | null;
      classTypeId?: string | null;
    }) => {
      let q = supabase
        .from("class_sessions")
        .update({ instructor_id: instructorId, updated_at: new Date().toISOString() })
        .gte("session_date", start)
        .lte("session_date", end)
        .eq("is_cancelled", false);
      if (fromInstructorId) q = q.eq("instructor_id", fromInstructorId);
      if (classTypeId) q = q.eq("class_type_id", classTypeId);
      const { data, error } = await q.select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: (n) => {
      invalidate();
      toast.success(`Updated ${n} class${n === 1 ? "" : "es"}`);
    },
    onError: (e: any) => toast.error(e.message || "Bulk assign failed"),
  });

  const massCancelRange = useMutation({
    mutationFn: async ({ start, end, reason }: { start: string; end: string; reason: string }) => {
      const { data: sessions, error } = await supabase
        .from("class_sessions")
        .select("id")
        .gte("session_date", start)
        .lte("session_date", end)
        .eq("is_cancelled", false);
      if (error) throw error;
      const ids = (sessions || []).map((s: any) => s.id);
      for (const id of ids) {
        const { error: rpcError } = await supabase.rpc("admin_cancel_class_session", {
          _session_id: id,
          _is_hidden: true,
          _cancellation_reason: reason,
        });
        if (rpcError) throw rpcError;
      }
      return ids.length;
    },
    onSuccess: (n) => {
      invalidate();
      toast.success(`Cancelled ${n} class${n === 1 ? "" : "es"}`);
    },
    onError: (e: any) => toast.error(e.message || "Mass cancel failed"),
  });

  /** Copy every session in a source week into N following weeks, as drafts. */
  const copyWeekForward = useMutation({
    mutationFn: async ({
      sourceStart,
      sourceEnd,
      weeks,
    }: {
      sourceStart: string;
      sourceEnd: string;
      weeks: number;
    }) => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select(
          "class_type_id, instructor_id, session_date, start_time, end_time, room, max_capacity",
        )
        .gte("session_date", sourceStart)
        .lte("session_date", sourceEnd)
        .eq("is_cancelled", false);
      if (error) throw error;
      const rows: any[] = [];
      for (let w = 1; w <= weeks; w++) {
        (data || []).forEach((s: any) => {
          const d = new Date(`${s.session_date}T00:00:00`);
          d.setDate(d.getDate() + 7 * w);
          rows.push({
            class_type_id: s.class_type_id,
            instructor_id: s.instructor_id,
            session_date: d.toISOString().slice(0, 10),
            start_time: s.start_time,
            end_time: s.end_time,
            room: s.room,
            max_capacity: s.max_capacity,
            is_hidden: true,
          });
        });
      }
      if (!rows.length) return { inserted: 0, skipped: 0 };

      // Target weeks usually already contain the auto-generated recurring
      // sessions. Skip those instead of letting the unique constraint
      // (class_type_id, session_date, start_time) abort the whole insert.
      const targetDates = Array.from(new Set(rows.map((r) => r.session_date)));
      const { data: existing, error: exErr } = await supabase
        .from("class_sessions")
        .select("class_type_id, session_date, start_time")
        .in("session_date", targetDates);
      if (exErr) throw exErr;
      const taken = new Set(
        (existing || []).map(
          (e: any) => `${e.class_type_id}|${e.session_date}|${e.start_time}`,
        ),
      );
      const fresh: any[] = [];
      for (const r of rows) {
        const key = `${r.class_type_id}|${r.session_date}|${r.start_time}`;
        if (taken.has(key)) continue;
        taken.add(key);
        fresh.push(r);
      }
      const skipped = rows.length - fresh.length;
      if (!fresh.length) return { inserted: 0, skipped };

      const { error: insErr } = await supabase.from("class_sessions").insert(fresh);
      if (insErr) throw insErr;
      return { inserted: fresh.length, skipped };
    },
    onSuccess: ({ inserted, skipped }) => {
      invalidate();
      if (!inserted && skipped) {
        toast.info(`Nothing to copy — all ${skipped} classes already exist`);
        return;
      }
      toast.success(
        `Copied ${inserted} class${inserted === 1 ? "" : "es"} as drafts` +
          (skipped ? ` · skipped ${skipped} already scheduled` : ""),
      );
    },
    onError: (e: any) => toast.error(e.message || "Copy failed"),
  });


  const deleteDraft = useMutation({
    mutationFn: async (sessionId: string) => {
      const { count, error: cErr } = await supabase
        .from("class_bookings")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .in("status", ["confirmed", "completed"]);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) throw new Error("This class has bookings — cancel it instead of deleting.");
      const { error } = await supabase.from("class_sessions").delete().eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Draft removed");
    },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  return {
    updateSession,
    moveSession,
    createSession,
    cancelSession,
    publishDrafts,
    bulkAssignInstructor,
    massCancelRange,
    copyWeekForward,
    deleteDraft,
  };
}
