import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PTProgramDay {
  id: string;
  program_id: string;
  label: string;
  focus: string | null;
  day_type: string | null;
  weekday: number | null;
  week_number: number;
  display_order: number;
  notes: string | null;
  homework: string | null;
  phase: string | null;
}

export interface PTProgramExercise {
  id: string;
  day_id: string;
  exercise: string;
  exercise_id: string | null;
  sets: number | null;
  reps: string | null;
  load: string | null;
  tempo: string | null;
  rest: string | null;
  rpe: number | null;
  notes: string | null;
  cues: string | null;
  substitution: string | null;
  modification: string | null;
  superset_group: string | null;
  media_url: string | null;
  display_order: number;
  completed_result: string | null;
  previous_result: string | null;
  is_pr: boolean | null;
}

export interface PTProgramPhase { name: string; weeks: number; focus?: string }

export const PT_DAY_PRESETS = [
  { label: "Lower Body", focus: "Quads, hips and posterior chain", day_type: "strength" },
  { label: "Glutes & Hamstrings", focus: "Hip hinge and glute development", day_type: "strength" },
  { label: "Upper Body Push", focus: "Chest, shoulders and triceps", day_type: "strength" },
  { label: "Upper Body Pull", focus: "Back, rear delts and biceps", day_type: "strength" },
  { label: "Core & Conditioning", focus: "Trunk stability and engine work", day_type: "conditioning" },
  { label: "Recovery", focus: "Mobility, breathwork and soft tissue", day_type: "recovery" },
  { label: "Custom Day", focus: "", day_type: "custom" },
] as const;

/* ------------------------------------------------------------- queries */

export function usePTProgramList() {
  return useQuery({
    queryKey: ["pt-programs-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_programs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function usePTProgramDetail(programId?: string) {
  return useQuery({
    queryKey: ["pt-program-detail", programId],
    enabled: !!programId,
    queryFn: async () => {
      const [{ data: days, error: dErr }, { data: program, error: pErr }] = await Promise.all([
        (supabase as any).from("pt_program_days").select("*").eq("program_id", programId)
          .order("week_number", { ascending: true }).order("display_order", { ascending: true }),
        (supabase as any).from("pt_programs").select("*").eq("id", programId).maybeSingle(),
      ]);
      if (dErr) throw dErr;
      if (pErr) throw pErr;

      const dayIds = (days ?? []).map((d: any) => d.id);
      let exercises: any[] = [];
      if (dayIds.length) {
        const { data: ex, error: eErr } = await (supabase as any)
          .from("pt_program_exercises").select("*").in("day_id", dayIds)
          .order("display_order", { ascending: true });
        if (eErr) throw eErr;
        exercises = ex ?? [];
      }
      return {
        program: program as any,
        days: (days ?? []) as PTProgramDay[],
        exercises: exercises as PTProgramExercise[],
      };
    },
  });
}

/* ----------------------------------------------------------- mutations */

export function usePTProgramMutations(programId?: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pt-programs-all"] });
    qc.invalidateQueries({ queryKey: ["pt-program-detail", programId] });
  };
  const fail = (e: any) => toast.error(e?.message ?? "Something went wrong");

  const createProgram = useMutation({
    mutationFn: async (input: {
      name: string; user_id?: string | null; instructor_id?: string | null; goal?: string | null;
      start_date?: string | null; length_weeks?: number; sessions_per_week?: number;
      is_template?: boolean; phases?: PTProgramPhase[]; description?: string | null;
      template_id?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any).from("pt_programs").insert({
        status: "active",
        created_by: auth?.user?.id ?? null,
        ...input,
        phases: input.phases ?? [],
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => { toast.success("Program created"); refresh(); },
    onError: fail,
  });

  const updateProgram = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await (supabase as any).from("pt_programs")
        .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const deleteProgram = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_programs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Program deleted"); refresh(); },
    onError: fail,
  });

  /** Deep-copies a program (days + exercises). Used for duplicate, template use and assignment. */
  const duplicateProgram = useMutation({
    mutationFn: async (input: {
      sourceId: string; name?: string; userId?: string | null; asTemplate?: boolean;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: src, error: sErr } = await (supabase as any)
        .from("pt_programs").select("*").eq("id", input.sourceId).single();
      if (sErr) throw sErr;

      const { id, created_at, updated_at, ...rest } = src;
      const { data: copy, error: cErr } = await (supabase as any).from("pt_programs").insert({
        ...rest,
        name: input.name ?? `${src.name} (copy)`,
        user_id: input.asTemplate ? null : input.userId ?? src.user_id,
        is_template: !!input.asTemplate,
        template_id: input.asTemplate ? null : src.is_template ? src.id : src.template_id,
        status: "active",
        created_by: auth?.user?.id ?? null,
      }).select("id").single();
      if (cErr) throw cErr;

      const { data: days } = await (supabase as any)
        .from("pt_program_days").select("*").eq("program_id", input.sourceId);
      for (const d of days ?? []) {
        const { id: dayId, created_at: _c, program_id: _p, ...dayRest } = d;
        const { data: newDay, error: dErr } = await (supabase as any)
          .from("pt_program_days").insert({ ...dayRest, program_id: copy.id }).select("id").single();
        if (dErr) throw dErr;
        const { data: exs } = await (supabase as any)
          .from("pt_program_exercises").select("*").eq("day_id", dayId);
        if (exs?.length) {
          const payload = exs.map((e: any) => {
            const { id: _i, created_at: _cc, day_id: _d, completed_at, completed_result, is_pr, ...exRest } = e;
            return { ...exRest, day_id: newDay.id, completed_result: null, is_pr: false };
          });
          const { error: eErr } = await (supabase as any).from("pt_program_exercises").insert(payload);
          if (eErr) throw eErr;
        }
      }
      return copy.id as string;
    },
    onSuccess: () => { toast.success("Program copied"); refresh(); },
    onError: fail,
  });

  const addDay = useMutation({
    mutationFn: async (input: Partial<PTProgramDay> & { program_id: string; label: string }) => {
      const { data, error } = await (supabase as any).from("pt_program_days").insert({
        week_number: 1, display_order: 999, ...input,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const updateDay = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await (supabase as any).from("pt_program_days").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const deleteDay = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("pt_program_exercises").delete().eq("day_id", id);
      const { error } = await (supabase as any).from("pt_program_days").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Day removed"); refresh(); },
    onError: fail,
  });

  const reorderDays = useMutation({
    mutationFn: async (ordered: { id: string; display_order: number; week_number: number }[]) => {
      for (const d of ordered) {
        const { error } = await (supabase as any).from("pt_program_days")
          .update({ display_order: d.display_order, week_number: d.week_number }).eq("id", d.id);
        if (error) throw error;
      }
    },
    onSuccess: refresh,
    onError: fail,
  });

  const duplicateDay = useMutation({
    mutationFn: async (dayId: string) => {
      const { data: day, error } = await (supabase as any)
        .from("pt_program_days").select("*").eq("id", dayId).single();
      if (error) throw error;
      const { id, created_at, ...rest } = day;
      const { data: newDay, error: dErr } = await (supabase as any).from("pt_program_days")
        .insert({ ...rest, label: `${day.label} (copy)`, display_order: (day.display_order ?? 0) + 1 })
        .select("id").single();
      if (dErr) throw dErr;
      const { data: exs } = await (supabase as any).from("pt_program_exercises").select("*").eq("day_id", dayId);
      if (exs?.length) {
        const payload = exs.map((e: any) => {
          const { id: _i, created_at: _c, day_id: _d, ...exRest } = e;
          return { ...exRest, day_id: newDay.id };
        });
        await (supabase as any).from("pt_program_exercises").insert(payload);
      }
    },
    onSuccess: () => { toast.success("Workout duplicated"); refresh(); },
    onError: fail,
  });

  const addExercise = useMutation({
    mutationFn: async (input: Partial<PTProgramExercise> & { day_id: string; exercise: string }) => {
      const { error } = await (supabase as any).from("pt_program_exercises")
        .insert({ sets: 3, reps: "10", display_order: 999, ...input });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const updateExercise = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await (supabase as any).from("pt_program_exercises").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const deleteExercise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_program_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const duplicateExercise = useMutation({
    mutationFn: async (exerciseId: string) => {
      const { data: ex, error } = await (supabase as any)
        .from("pt_program_exercises").select("*").eq("id", exerciseId).single();
      if (error) throw error;
      const { id, created_at, ...rest } = ex;
      const { error: iErr } = await (supabase as any).from("pt_program_exercises")
        .insert({ ...rest, display_order: (ex.display_order ?? 0) + 1 });
      if (iErr) throw iErr;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const reorderExercises = useMutation({
    mutationFn: async (ordered: { id: string; display_order: number }[]) => {
      for (const e of ordered) {
        const { error } = await (supabase as any).from("pt_program_exercises")
          .update({ display_order: e.display_order }).eq("id", e.id);
        if (error) throw error;
      }
    },
    onSuccess: refresh,
    onError: fail,
  });

  return {
    createProgram, updateProgram, deleteProgram, duplicateProgram,
    addDay, updateDay, deleteDay, reorderDays, duplicateDay,
    addExercise, updateExercise, deleteExercise, duplicateExercise, reorderExercises,
  };
}

/* ------------------------------------------------------ exercise library */

export function usePTExerciseLibrary() {
  return useQuery({
    queryKey: ["pt-exercise-library"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_exercise_library").select("*").order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function usePTExerciseLibraryMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["pt-exercise-library"] });
  const fail = (e: any) => toast.error(e?.message ?? "Something went wrong");

  const save = useMutation({
    mutationFn: async (input: Record<string, any> & { id?: string }) => {
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await (supabase as any).from("pt_exercise_library").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("pt_exercise_library").insert({ is_active: true, ...input });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Exercise saved"); refresh(); },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_exercise_library").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Exercise archived"); refresh(); },
    onError: fail,
  });

  return { save, remove };
}
