import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PTProgressRange { from: string; to: string }

export function usePTProgressData(userId?: string) {
  return useQuery({
    queryKey: ["pt-progress-data", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: appts }, { data: metrics }, { data: prs }, { data: photos }, { data: programs }, { data: tests }] =
        await Promise.all([
          (supabase as any).from("pt_appointments")
            .select("id, starts_at, status, instructor_id").eq("user_id", userId).order("starts_at"),
          (supabase as any).from("pt_body_metrics").select("*").eq("user_id", userId).order("measured_on"),
          (supabase as any).from("pt_prs").select("*").eq("user_id", userId).order("achieved_on", { ascending: false }),
          (supabase as any).from("pt_progress_photos").select("*").eq("user_id", userId).order("taken_on", { ascending: false }),
          (supabase as any).from("pt_programs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
          (supabase as any).from("pt_performance_tests").select("*").eq("user_id", userId).order("tested_on", { ascending: false }),
        ]);

      const programIds = (programs ?? []).map((p: any) => p.id);
      let compliance = { planned: 0, completed: 0 };
      if (programIds.length) {
        const { data: days } = await (supabase as any)
          .from("pt_program_days").select("id").in("program_id", programIds);
        const dayIds = (days ?? []).map((d: any) => d.id);
        if (dayIds.length) {
          const { data: exs } = await (supabase as any)
            .from("pt_program_exercises").select("id, completed_at").in("day_id", dayIds);
          compliance = {
            planned: exs?.length ?? 0,
            completed: (exs ?? []).filter((e: any) => e.completed_at).length,
          };
        }
      }

      return {
        appts: (appts ?? []) as any[],
        metrics: (metrics ?? []) as any[],
        prs: (prs ?? []) as any[],
        photos: (photos ?? []) as any[],
        programs: (programs ?? []) as any[],
        tests: (tests ?? []) as any[],
        compliance,
      };
    },
  });
}

/** Derived KPIs and chart series for a date range. */
export function usePTProgressSummary(
  data: ReturnType<typeof usePTProgressData>["data"],
  range: PTProgressRange,
) {
  return useMemo(() => {
    if (!data) return null;
    const inRange = (d?: string | null) => !!d && d.slice(0, 10) >= range.from && d.slice(0, 10) <= range.to;

    const appts = data.appts.filter((a) => inRange(a.starts_at));
    const completed = appts.filter((a) => a.status === "completed").length;
    const counted = appts.filter((a) => ["completed", "no_show", "late_cancel"].includes(a.status)).length;
    const attendance = counted ? Math.round((completed / counted) * 100) : null;

    const metrics = data.metrics.filter((m) => inRange(m.measured_on));
    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    const delta = (key: string) =>
      first && last && first[key] != null && last[key] != null ? Number(last[key]) - Number(first[key]) : null;

    return {
      sessionsCompleted: completed,
      sessionsCounted: counted,
      attendance,
      weightSeries: metrics.filter((m) => m.weight_lbs != null)
        .map((m) => ({ date: m.measured_on, value: Number(m.weight_lbs) })),
      bodyFatSeries: metrics.filter((m) => m.body_fat_pct != null)
        .map((m) => ({ date: m.measured_on, value: Number(m.body_fat_pct) })),
      circumferenceSeries: metrics.map((m) => ({
        date: m.measured_on,
        waist: m.waist_in != null ? Number(m.waist_in) : null,
        hips: m.hips_in != null ? Number(m.hips_in) : null,
        chest: m.chest_in != null ? Number(m.chest_in) : null,
        arms: m.arms_in != null ? Number(m.arms_in) : null,
      })),
      first, last,
      weightDelta: delta("weight_lbs"),
      bodyFatDelta: delta("body_fat_pct"),
      waistDelta: delta("waist_in"),
      prsConfirmed: data.prs.filter((p) => p.status !== "pending" && inRange(p.achieved_on)),
      prsPending: data.prs.filter((p) => p.status === "pending"),
      compliance: data.compliance.planned
        ? Math.round((data.compliance.completed / data.compliance.planned) * 100)
        : null,
      photos: data.photos,
      nextReassessment: data.programs
        .map((p: any) => p.next_reassessment).filter(Boolean).sort()[0] ?? null,
    };
  }, [data, range]);
}

/* ------------------------------------------------- personal records flow */

export function usePTPendingPRs() {
  return useQuery({
    queryKey: ["pt-pending-prs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_prs").select("*").eq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function usePTPRMutations(userId?: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pt-pending-prs"] });
    qc.invalidateQueries({ queryKey: ["pt-progress-data", userId] });
    qc.invalidateQueries({ queryKey: ["pt-client", "pt_prs", userId] });
  };
  const fail = (e: any) => toast.error(e?.message ?? "Something went wrong");

  /**
   * Records a result and, when it beats the client's previous best for that
   * exercise, proposes a PR that a trainer must confirm before it counts.
   */
  const recordResult = useMutation({
    mutationFn: async (input: {
      user_id: string; exercise: string; weight_lbs: number; reps?: number | null;
      achieved_on?: string; notes?: string | null; program_exercise_id?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: best } = await (supabase as any)
        .from("pt_prs").select("weight_lbs, reps")
        .eq("user_id", input.user_id).eq("exercise", input.exercise).eq("status", "confirmed")
        .order("weight_lbs", { ascending: false }).limit(1).maybeSingle();

      const beatsPrevious = !best || Number(input.weight_lbs) > Number(best.weight_lbs);
      if (!beatsPrevious) return { proposed: false };

      const { error } = await (supabase as any).from("pt_prs").insert({
        user_id: input.user_id,
        exercise: input.exercise,
        weight_lbs: input.weight_lbs,
        reps: input.reps ?? null,
        achieved_on: input.achieved_on ?? new Date().toISOString().slice(0, 10),
        notes: input.notes ?? null,
        program_exercise_id: input.program_exercise_id ?? null,
        previous_weight_lbs: best?.weight_lbs ?? null,
        previous_reps: best?.reps ?? null,
        status: "pending",
        source: "detected",
        created_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
      return { proposed: true };
    },
    onSuccess: (r) => {
      toast.success(r?.proposed ? "New PR detected — awaiting confirmation" : "Result saved (no PR)");
      refresh();
    },
    onError: fail,
  });

  const confirmPR = useMutation({
    mutationFn: async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_prs").update({
        status: "confirmed", confirmed_by: auth?.user?.id ?? null, confirmed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Personal record confirmed"); refresh(); },
    onError: fail,
  });

  const rejectPR = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_prs").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("PR dismissed"); refresh(); },
    onError: fail,
  });

  const addManualPR = useMutation({
    mutationFn: async (input: { user_id: string; exercise: string; weight_lbs: number; reps?: number | null; achieved_on: string; notes?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_prs").insert({
        ...input, status: "pending", source: "manual", created_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("PR submitted for confirmation"); refresh(); },
    onError: fail,
  });

  return { recordResult, confirmPR, rejectPR, addManualPR };
}

/* --------------------------------------------------------- reassessments */

export function usePTReassessments() {
  return useQuery({
    queryKey: ["pt-reassessments"],
    queryFn: async () => {
      const [{ data: programs }, { data: tests }] = await Promise.all([
        (supabase as any).from("pt_programs")
          .select("id, user_id, name, next_reassessment, instructor_id, status")
          .not("user_id", "is", null).neq("status", "archived"),
        (supabase as any).from("pt_performance_tests").select("*")
          .eq("is_reassessment", true).order("tested_on", { ascending: false }),
      ]);
      return { programs: (programs ?? []) as any[], tests: (tests ?? []) as any[] };
    },
  });
}

export function usePTReassessmentMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["pt-reassessments"] });

  const schedule = useMutation({
    mutationFn: async ({ programId, date }: { programId: string; date: string }) => {
      const { error } = await (supabase as any).from("pt_programs")
        .update({ next_reassessment: date }).eq("id", programId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reassessment scheduled"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not schedule"),
  });

  const recordTest = useMutation({
    mutationFn: async (input: {
      user_id: string; test_name: string; value?: number | null; unit?: string | null;
      result_text?: string | null; tested_on: string; notes?: string | null; category?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_performance_tests").insert({
        ...input, is_reassessment: true, created_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reassessment recorded"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not record test"),
  });

  return { schedule, recordTest };
}
