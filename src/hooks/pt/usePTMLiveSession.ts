import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ------------------------------------------------------------------ types */

export interface PTMSessionSet {
  id: string;
  session_exercise_id: string;
  appointment_id: string;
  user_id: string;
  set_number: number;
  weight_lbs: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance: number | null;
  distance_unit: string | null;
  rpe: number | null;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
  pain_flag: boolean;
  is_pr: boolean;
}

export interface PTMSessionExercise {
  id: string;
  appointment_id: string;
  user_id: string;
  exercise: string;
  exercise_id: string | null;
  program_exercise_id: string | null;
  planned_sets: number | null;
  planned_reps: string | null;
  planned_load: string | null;
  tempo: string | null;
  rest: string | null;
  cues: string | null;
  media_url: string | null;
  modification: string | null;
  notes: string | null;
  display_order: number;
  status: "pending" | "active" | "done" | "skipped" | string;
  skip_reason: string | null;
  substituted_from: string | null;
  sets: PTMSessionSet[];
}

export interface PTMLiveState {
  /** accumulated seconds before the current running span */
  elapsed?: number;
  /** ISO timestamp the current running span started, null when paused */
  runningSince?: string | null;
  currentIndex?: number;
}

/* ------------------------------------------------------- connection state */

export function usePTMOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/* ------------------------------------------------------------ session data */

export function usePTMLiveSession(appointmentId?: string) {
  return useQuery({
    queryKey: ["ptm-live-session", appointmentId],
    enabled: !!appointmentId,
    staleTime: 5_000,
    queryFn: async () => {
      const [exRes, setRes] = await Promise.all([
        (supabase as any)
          .from("pt_session_exercises")
          .select("*")
          .eq("appointment_id", appointmentId)
          .order("display_order", { ascending: true }),
        (supabase as any)
          .from("pt_session_sets")
          .select("*")
          .eq("appointment_id", appointmentId)
          .order("set_number", { ascending: true }),
      ]);
      if (exRes.error) throw exRes.error;
      if (setRes.error) throw setRes.error;
      const sets: PTMSessionSet[] = setRes.data ?? [];
      const exercises: PTMSessionExercise[] = (exRes.data ?? []).map((e: any) => ({
        ...e,
        sets: sets.filter((s) => s.session_exercise_id === e.id).sort((a, b) => a.set_number - b.set_number),
      }));
      return exercises;
    },
  });
}

/** Previous-session performance for the exercises in this workout. */
export function usePTMPreviousPerformance(userId?: string, appointmentId?: string, names: string[] = []) {
  const key = [...names].sort().join("|");
  return useQuery({
    queryKey: ["ptm-prev-performance", userId, appointmentId, key],
    enabled: !!userId && names.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_session_sets")
        .select("weight_lbs, reps, rpe, set_number, completed_at, session_exercise_id, pt_session_exercises!inner(exercise, appointment_id, user_id)")
        .eq("user_id", userId)
        .eq("completed", true)
        .neq("appointment_id", appointmentId)
        .order("completed_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      const byExercise: Record<string, { weight: number | null; reps: number | null; when: string | null; best: number }> = {};
      (data ?? []).forEach((row: any) => {
        const name = String(row.pt_session_exercises?.exercise ?? "").toLowerCase();
        if (!name) return;
        const w = row.weight_lbs == null ? null : Number(row.weight_lbs);
        const existing = byExercise[name];
        if (!existing) {
          byExercise[name] = { weight: w, reps: row.reps, when: row.completed_at, best: w ?? 0 };
        } else if (row.completed_at && existing.when && row.completed_at > existing.when) {
          byExercise[name] = { weight: w, reps: row.reps, when: row.completed_at, best: Math.max(existing.best, w ?? 0) };
        } else {
          existing.best = Math.max(existing.best, w ?? 0);
        }
      });
      return byExercise;
    },
  });
}

/* ------------------------------------------------------------- seeding */

/** Build today's workout from the client's active program when nothing is logged yet. */
export function usePTMSeedWorkout(appointmentId?: string, userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!appointmentId || !userId) return 0;
      const { data: existing } = await (supabase as any)
        .from("pt_session_exercises").select("id").eq("appointment_id", appointmentId).limit(1);
      if ((existing ?? []).length > 0) return 0;

      const { data: programs } = await (supabase as any)
        .from("pt_programs")
        .select("id, status, updated_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1);
      const programId = (programs ?? [])[0]?.id;
      if (!programId) return 0;

      const { data: days } = await (supabase as any)
        .from("pt_program_days")
        .select("id, weekday, display_order")
        .eq("program_id", programId)
        .order("display_order", { ascending: true });
      if (!days?.length) return 0;
      const today = new Date().getDay();
      const day = days.find((d: any) => d.weekday === today) ?? days[0];

      const { data: pex } = await (supabase as any)
        .from("pt_program_exercises")
        .select("id, exercise, exercise_id, sets, reps, load, tempo, rest, cues, media_url, modification, notes, display_order")
        .eq("day_id", day.id)
        .order("display_order", { ascending: true });
      if (!pex?.length) return 0;

      const rows = pex.map((p: any, i: number) => ({
        appointment_id: appointmentId,
        user_id: userId,
        program_exercise_id: p.id,
        exercise_id: p.exercise_id ?? null,
        exercise: p.exercise,
        planned_sets: p.sets ?? null,
        planned_reps: p.reps ?? null,
        planned_load: p.load ?? null,
        tempo: p.tempo ?? null,
        rest: p.rest ?? null,
        cues: p.cues ?? null,
        media_url: p.media_url ?? null,
        modification: p.modification ?? null,
        notes: p.notes ?? null,
        display_order: p.display_order ?? i,
        status: i === 0 ? "active" : "pending",
      }));
      const { error } = await (supabase as any).from("pt_session_exercises").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      if (n) qc.invalidateQueries({ queryKey: ["ptm-live-session", appointmentId] });
    },
  });
}

/* -------------------------------------------------------------- mutations */

export function usePTMLiveActions(appointmentId?: string, userId?: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["ptm-live-session", appointmentId] });
  const inflight = useRef<Set<string>>(new Set());

  const guard = async <T,>(key: string, fn: () => Promise<T>) => {
    if (inflight.current.has(key)) return undefined as T | undefined;
    inflight.current.add(key);
    try {
      return await fn();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save — retry when back online");
      throw e;
    } finally {
      inflight.current.delete(key);
    }
  };

  const addExercise = async (payload: Partial<PTMSessionExercise> & { exercise: string; display_order: number }) => {
    await guard(`add-ex-${payload.exercise}-${payload.display_order}`, async () => {
      const { error } = await (supabase as any).from("pt_session_exercises").insert({
        appointment_id: appointmentId, user_id: userId, ...payload,
      });
      if (error) throw error;
    });
    invalidate();
  };

  const updateExercise = async (id: string, patch: Record<string, any>) => {
    const { error } = await (supabase as any).from("pt_session_exercises").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  };

  const removeExercise = async (id: string) => {
    const { error } = await (supabase as any).from("pt_session_exercises").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  };

  const reorder = async (ids: string[]) => {
    await Promise.all(
      ids.map((id, i) => (supabase as any).from("pt_session_exercises").update({ display_order: i }).eq("id", id)),
    );
    invalidate();
  };

  /** Insert a set; unique(session_exercise_id, set_number) prevents duplicates. */
  const addSet = async (exerciseId: string, setNumber: number, seed?: Partial<PTMSessionSet>) => {
    await guard(`add-set-${exerciseId}-${setNumber}`, async () => {
      const { error } = await (supabase as any).from("pt_session_sets").insert({
        session_exercise_id: exerciseId,
        appointment_id: appointmentId,
        user_id: userId,
        set_number: setNumber,
        weight_lbs: seed?.weight_lbs ?? null,
        reps: seed?.reps ?? null,
        duration_seconds: seed?.duration_seconds ?? null,
        distance: seed?.distance ?? null,
        rpe: seed?.rpe ?? null,
      });
      if (error && !String(error.message).includes("duplicate")) throw error;
    });
    invalidate();
  };

  const updateSet = async (setId: string, patch: Record<string, any>) => {
    const { error } = await (supabase as any).from("pt_session_sets").update(patch).eq("id", setId);
    if (error) { toast.error(error.message); return; }
    invalidate();
  };

  const removeSet = async (setId: string) => {
    const { error } = await (supabase as any).from("pt_session_sets").delete().eq("id", setId);
    if (error) { toast.error(error.message); return; }
    invalidate();
  };

  const saveLiveState = async (state: PTMLiveState) => {
    if (!appointmentId) return;
    await (supabase as any).from("pt_appointments").update({ live_state: state }).eq("id", appointmentId);
  };

  /** Persist a confirmed personal record. */
  const savePR = async (args: {
    exercise: string; weight: number | null; reps: number | null;
    previousWeight: number | null; programExerciseId?: string | null; setId?: string;
  }) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("pt_prs").insert({
      user_id: userId,
      exercise: args.exercise,
      weight_lbs: args.weight,
      reps: args.reps,
      previous_weight_lbs: args.previousWeight,
      achieved_on: new Date().toISOString().slice(0, 10),
      source: "live_session",
      status: "confirmed",
      created_by: auth?.user?.id ?? null,
      confirmed_by: auth?.user?.id ?? null,
      confirmed_at: new Date().toISOString(),
      program_exercise_id: args.programExerciseId ?? null,
    });
    if (error) { toast.error(error.message); return; }
    if (args.setId) await updateSet(args.setId, { is_pr: true });
    toast.success("Personal record saved");
  };

  return {
    addExercise, updateExercise, removeExercise, reorder,
    addSet, updateSet, removeSet, saveLiveState, savePR,
  };
}

/* ----------------------------------------------------------------- timer */

export function usePTMSessionTimer(appointmentId: string | undefined, initial: PTMLiveState | undefined, onPersist: (s: PTMLiveState) => void) {
  const localKey = `ptm-live-timer:${appointmentId ?? "none"}`;
  const [state, setState] = useState<PTMLiveState>(() => {
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return initial ?? {};
  });
  const hydrated = useRef(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (hydrated.current || !initial) return;
    hydrated.current = true;
    // Prefer whichever source has more accumulated time (crash recovery).
    setState((cur) => ((initial.elapsed ?? 0) > (cur.elapsed ?? 0) ? initial : cur));
  }, [initial]);

  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const persist = useCallback((next: PTMLiveState) => {
    setState(next);
    try { localStorage.setItem(localKey, JSON.stringify(next)); } catch { /* ignore */ }
    onPersist(next);
  }, [localKey, onPersist]);

  const seconds = useMemo(() => {
    const base = state.elapsed ?? 0;
    if (!state.runningSince) return base;
    return base + Math.max(0, Math.floor((Date.now() - new Date(state.runningSince).getTime()) / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tick]);

  const running = !!state.runningSince;
  const start = () => persist({ ...state, runningSince: new Date().toISOString() });
  const pause = () => persist({ elapsed: seconds, runningSince: null, currentIndex: state.currentIndex });
  const setIndex = (i: number) => persist({ ...state, elapsed: state.elapsed, currentIndex: i });

  return { seconds, running, start, pause, setIndex, currentIndex: state.currentIndex ?? 0 };
}

export function ptmFormatClock(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
