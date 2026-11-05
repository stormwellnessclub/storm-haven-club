import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ActiveWorkoutState, newerState, restoreWorkoutState, addDaysISO } from "@/lib/workoutJournal";

const db = supabase as any;
const lsKey = (uid: string) => `storm-active-workout:${uid}`;

/** The workout a member is in the middle of; survives phone lock, app close and other devices. */
export function useActiveWorkoutSession() {
  const { user } = useAuth();
  const [state, setLocal] = useState<ActiveWorkoutState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let local: ActiveWorkoutState | null = null;
    try { local = restoreWorkoutState(JSON.parse(localStorage.getItem(lsKey(user.id)) || "null")); } catch { /* ignore */ }
    setLocal(local);
    setLoaded(true);
    db.from("workout_sessions_in_progress").select("state").eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => {
        const remote = restoreWorkoutState(data?.state);
        const best = newerState(local, remote);
        if (best) { setLocal(best); localStorage.setItem(lsKey(user.id), JSON.stringify(best)); }
      });
  }, [user?.id]);

  const save = useCallback((next: ActiveWorkoutState | null) => {
    if (!user) return;
    if (next) next = { ...next, updatedAt: new Date().toISOString() };
    setLocal(next);
    if (next) localStorage.setItem(lsKey(user.id), JSON.stringify(next));
    else localStorage.removeItem(lsKey(user.id));
    if (timer.current) window.clearTimeout(timer.current);
    const write = () => next
      ? db.from("workout_sessions_in_progress").upsert({ user_id: user.id, state: next, updated_at: next.updatedAt })
      : db.from("workout_sessions_in_progress").delete().eq("user_id", user.id);
    if (!next) { write(); return; }
    timer.current = window.setTimeout(() => { write(); }, 800);
  }, [user?.id]);

  return { state, loaded, save };
}

export interface PlanEntry {
  id: string; user_id: string; plan_date: string; template_id: string | null;
  label: string | null; notes: string | null; status: "planned" | "done" | "skipped";
  workout_log_id: string | null;
  category: string; activity_key: string | null; start_time: string | null;
  duration_min: number | null; reminder_offset_min: number | null; reminder_at: string | null;
  completed_at: string | null; sort_order: number;
}

export function useWorkoutPlan(weekStart: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workout-plan", user?.id, weekStart],
    enabled: !!user,
    queryFn: async (): Promise<PlanEntry[]> => {
      const { data, error } = await db.from("workout_plan_entries").select("*")
        .eq("user_id", user!.id).gte("plan_date", weekStart).lte("plan_date", addDaysISO(weekStart, 6))
        .order("start_time", { nullsFirst: false }).order("created_at");
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePlanMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["workout-plan"] });
  const onError = (e: Error) => toast.error(e.message || "Couldn't save");
  const add = useMutation({
    mutationFn: async (e: Partial<PlanEntry> & { plan_date: string }) => {
      const { error } = await db.from("workout_plan_entries").insert({ user_id: user!.id, ...e });
      if (error) throw error;
    }, onSuccess: done, onError,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PlanEntry> & { id: string }) => {
      const { error } = await db.from("workout_plan_entries").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    }, onSuccess: done, onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("workout_plan_entries").delete().eq("id", id);
      if (error) throw error;
    }, onSuccess: done, onError,
  });
  const copyWeek = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const { data, error } = await db.from("workout_plan_entries").select("plan_date,template_id,label,category,activity_key,start_time,duration_min")
        .eq("user_id", user!.id).gte("plan_date", from).lte("plan_date", addDaysISO(from, 6));
      if (error) throw error;
      if (!data?.length) throw new Error("Last week has nothing planned");
      const rows = data.map((r: any) => {
        const offset = Math.round((Date.parse(r.plan_date) - Date.parse(from)) / 86400000);
        return { user_id: user!.id, plan_date: addDaysISO(to, offset), template_id: r.template_id, label: r.label, category: r.category, activity_key: r.activity_key, start_time: r.start_time, duration_min: r.duration_min };
      });
      const { error: e2 } = await db.from("workout_plan_entries").insert(rows);
      if (e2) throw e2;
    }, onSuccess: () => { done(); toast.success("Copied last week"); }, onError,
  });
  const addMany = useMutation({
    mutationFn: async (rows: (Partial<PlanEntry> & { plan_date: string })[]) => {
      const { error } = await db.from("workout_plan_entries").insert(rows.map((r) => ({ user_id: user!.id, ...r })));
      if (error) throw error;
    }, onSuccess: () => { done(); toast.success("Week planned"); }, onError,
  });
  return { add, update, remove, copyWeek, addMany };
}

/** Saves a finished guided workout to the journal. */
export function useFinishWorkout() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: ActiveWorkoutState) => {
      const { data: member } = await supabase.from("members").select("id").eq("user_id", user!.id).maybeSingle();
      if (!member) throw new Error("Member not found");
      const minutes = Math.max(1, Math.round((Date.now() - Date.parse(s.startedAt)) / 60000));
      const exercises = s.exercises.map((e, i) => ({
        ...e,
        sets_completed: s.done[i].filter(Boolean).length,
        weights_used: s.weights[i],
      }));
      const { data: log, error } = await db.from("workout_logs").insert({
        member_id: member.id, user_id: user!.id,
        workout_type: s.workoutType || s.name,
        duration_minutes: Math.min(minutes, 300),
        notes: `Completed: ${s.name}`,
        logged_at: new Date().toISOString(),
        exercises,
      }).select("id").single();
      if (error) throw error;
      if (s.templateId) {
        const { data: t } = await db.from("workout_templates").select("times_used").eq("id", s.templateId).maybeSingle();
        if (t) await db.from("workout_templates").update({ times_used: (t.times_used || 0) + 1 }).eq("id", s.templateId);
      }
      if (s.programWorkoutId) {
        await db.from("program_workouts").update({ is_completed: true, completed_at: new Date().toISOString() }).eq("id", s.programWorkoutId);
      }
      if (s.planEntryId) {
        await db.from("workout_plan_entries").update({ status: "done", workout_log_id: log.id }).eq("id", s.planEntryId);
      }
    },
    onSuccess: () => {
      ["workout-logs", "workout-templates", "workout-plan", "member-activities", "program-workouts"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Workout saved to your journal");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save workout"),
  });
}

/** Weights the member used last time for each of these exercises. */
export async function fetchLastWeights(userId: string, exercises: { name: string }[]) {
  const { lastWeightsFor } = await import("@/lib/workoutJournal");
  const { data } = await db.from("workout_logs").select("exercises").eq("user_id", userId)
    .order("logged_at", { ascending: false }).limit(40);
  return lastWeightsFor(data || [], exercises);
}

/** Rolling history for streaks (last ~10 weeks). */
export function usePlanHistory(fromISO: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workout-plan", "history", user?.id, fromISO],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db.from("workout_plan_entries").select("plan_date,category,status")
        .eq("user_id", user!.id).gte("plan_date", fromISO);
      return (data || []) as { plan_date: string; category: string; status: string }[];
    },
  });
}

export interface BookedItem { id: string; kind: "class" | "spa"; date: string; time: string | null; title: string; href: string }

/** The member's real class bookings and spa/recovery appointments for the week (read-only). */
export function useWeekBookings(weekStart: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["week-bookings", user?.id, weekStart],
    enabled: !!user,
    queryFn: async (): Promise<BookedItem[]> => {
      const end = addDaysISO(weekStart, 6);
      const [cls, spa] = await Promise.all([
        db.from("class_bookings").select("id,status,class_sessions!inner(session_date,start_time,is_cancelled,class_types(name))")
          .eq("user_id", user!.id).eq("status", "confirmed")
          .gte("class_sessions.session_date", weekStart).lte("class_sessions.session_date", end),
        db.from("spa_appointments").select("id,appointment_date,appointment_time,service_name,status")
          .eq("user_id", user!.id).gte("appointment_date", weekStart).lte("appointment_date", end)
          .not("status", "in", "(cancelled,no_show)"),
      ]);
      const out: BookedItem[] = [];
      for (const b of cls.data || []) {
        const s = b.class_sessions; if (!s || s.is_cancelled) continue;
        out.push({ id: `c-${b.id}`, kind: "class", date: s.session_date, time: s.start_time, title: s.class_types?.name || "Class", href: "/member/bookings" });
      }
      for (const a of spa.data || []) {
        out.push({ id: `s-${a.id}`, kind: "spa", date: a.appointment_date, time: a.appointment_time, title: a.service_name || "Spa appointment", href: "/member/bookings" });
      }
      return out;
    },
  });
}

export interface DayCheckin { mood: number | null; energy: number | null; note: string | null; habits: Record<string, boolean> }

export function useDayCheckins(weekStart: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["workout-checkins", user?.id, weekStart],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db.from("workout_day_checkins").select("*").eq("user_id", user!.id)
        .gte("check_date", weekStart).lte("check_date", addDaysISO(weekStart, 6));
      return Object.fromEntries((data || []).map((r: any) => [r.check_date, r])) as Record<string, DayCheckin>;
    },
  });
  const save = useMutation({
    mutationFn: async ({ date, ...patch }: Partial<DayCheckin> & { date: string }) => {
      const prev = q.data?.[date];
      const { error } = await db.from("workout_day_checkins").upsert({
        user_id: user!.id, check_date: date,
        mood: prev?.mood ?? null, energy: prev?.energy ?? null, note: prev?.note ?? null, habits: prev?.habits ?? {},
        ...patch, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,check_date" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-checkins"] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't save"),
  });
  return { checkins: q.data || {}, save };
}

export function useReminderPrefs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["workout-reminder-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db.from("workout_reminder_prefs").select("*").eq("user_id", user!.id).maybeSingle();
      return data as { daily_summary: boolean; summary_time: string } | null;
    },
  });
  const save = useMutation({
    mutationFn: async (p: { daily_summary: boolean; summary_time: string; next_summary_at: string | null }) => {
      const { error } = await db.from("workout_reminder_prefs").upsert({ user_id: user!.id, ...p, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workout-reminder-prefs"] }); toast.success("Reminder settings saved"); },
    onError: (e: Error) => toast.error(e.message || "Couldn't save"),
  });
  return { prefs: q.data, save };
}
