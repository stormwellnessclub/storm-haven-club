import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ptmToast } from "@/components/admin/pt/mobile/ptmToast";
import { compressImage } from "@/lib/imageCompress";

/**
 * Mobile progress snapshot data layer.
 *
 * One query per concern so the Overview tab paints from cached metric data
 * while photos (which need signed URLs) resolve in the background.
 */

export type PTMRangeKey = "4w" | "8w" | "12w" | "6m" | "1y" | "custom";

export const PTM_RANGE_OPTIONS: { key: PTMRangeKey; label: string; days: number | null }[] = [
  { key: "4w", label: "4 Weeks", days: 28 },
  { key: "8w", label: "8 Weeks", days: 56 },
  { key: "12w", label: "12 Weeks", days: 84 },
  { key: "6m", label: "6 Months", days: 182 },
  { key: "1y", label: "1 Year", days: 365 },
  { key: "custom", label: "Custom", days: null },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function usePTMRange() {
  const [key, setKey] = useState<PTMRangeKey>("12w");
  const [customFrom, setCustomFrom] = useState(iso(new Date(Date.now() - 84 * 864e5)));
  const [customTo, setCustomTo] = useState(iso(new Date()));

  const range = useMemo(() => {
    if (key === "custom") return { from: customFrom, to: customTo };
    const days = PTM_RANGE_OPTIONS.find((o) => o.key === key)?.days ?? 84;
    return { from: iso(new Date(Date.now() - days * 864e5)), to: iso(new Date()) };
  }, [key, customFrom, customTo]);

  return { key, setKey, range, customFrom, setCustomFrom, customTo, setCustomTo };
}

export interface PTMProgressPoint { date: string; value: number }

export interface PTMProgressCard {
  key: string;
  label: string;
  unit: string;
  /** Lower is usually better (body fat, waist…) */
  invert?: boolean;
  current: number | null;
  start: number | null;
  latest: number | null;
  change: number | null;
  latestDate: string | null;
  startDate: string | null;
  series: PTMProgressPoint[];
}

const METRIC_FIELDS: { key: string; label: string; unit: string; invert?: boolean }[] = [
  { key: "weight_lbs", label: "Weight", unit: "lbs" },
  { key: "body_fat_pct", label: "Body fat", unit: "%", invert: true },
  { key: "muscle_mass_lbs", label: "Muscle mass", unit: "lbs" },
  { key: "waist_in", label: "Waist", unit: "in", invert: true },
  { key: "hips_in", label: "Hips / glutes", unit: "in" },
  { key: "chest_in", label: "Chest", unit: "in" },
  { key: "arms_in", label: "Arms", unit: "in" },
  { key: "thighs_in", label: "Thighs", unit: "in" },
  { key: "calves_in", label: "Calves", unit: "in" },
  { key: "neck_in", label: "Neck", unit: "in", invert: true },
];

/** Metrics, attendance, compliance, reassessments and PRs for a client. */
export function usePTMProgressData(userId?: string, range?: { from: string; to: string }) {
  return useQuery({
    queryKey: ["ptm-progress", userId, range?.from, range?.to],
    enabled: !!userId && !!range,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: metrics }, { data: prs }, { data: appts }, { data: tests }, { data: programs }] =
        await Promise.all([
          (supabase as any).from("pt_body_metrics").select("*").eq("user_id", userId).order("measured_on"),
          (supabase as any)
            .from("pt_prs")
            .select("*")
            .eq("user_id", userId)
            .order("achieved_on", { ascending: false }),
          (supabase as any)
            .from("pt_appointments")
            .select("id, starts_at, status, session_type_id")
            .eq("user_id", userId)
            .order("starts_at"),
          (supabase as any)
            .from("pt_performance_tests")
            .select("*")
            .eq("user_id", userId)
            .order("tested_on", { ascending: false }),
          (supabase as any)
            .from("pt_programs")
            .select("id, name, status, next_reassessment")
            .eq("user_id", userId),
        ]);

      // Program compliance across the client's programs.
      const programIds = (programs ?? []).map((p: any) => p.id);
      let compliance: { planned: number; completed: number } = { planned: 0, completed: 0 };
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
        metrics: (metrics ?? []) as any[],
        prs: (prs ?? []) as any[],
        appts: (appts ?? []) as any[],
        tests: (tests ?? []) as any[],
        programs: (programs ?? []) as any[],
        compliance,
      };
    },
  });
}

export function usePTMProgressCards(
  data: ReturnType<typeof usePTMProgressData>["data"],
  range: { from: string; to: string },
) {
  return useMemo(() => {
    if (!data) return null;
    const inRange = (d?: string | null) => !!d && d.slice(0, 10) >= range.from && d.slice(0, 10) <= range.to;
    const metrics = data.metrics.filter((m) => inRange(m.measured_on));

    const cards: PTMProgressCard[] = METRIC_FIELDS.map((f) => {
      const series = metrics
        .filter((m) => m[f.key] != null)
        .map((m) => ({ date: m.measured_on as string, value: Number(m[f.key]) }));
      const start = series[0] ?? null;
      const latest = series[series.length - 1] ?? null;
      return {
        key: f.key,
        label: f.label,
        unit: f.unit,
        invert: f.invert,
        current: latest?.value ?? null,
        start: start?.value ?? null,
        latest: latest?.value ?? null,
        change: start && latest ? Number((latest.value - start.value).toFixed(1)) : null,
        latestDate: latest?.date ?? null,
        startDate: start?.date ?? null,
        series,
      };
    }).filter((c) => c.series.length > 0);

    // Extra circumference measurements stored in the jsonb `extra` column.
    const extraKeys = new Set<string>();
    metrics.forEach((m) => Object.keys(m.extra ?? {}).forEach((k) => extraKeys.add(k)));
    extraKeys.forEach((k) => {
      const series = metrics
        .filter((m) => m.extra?.[k] != null && !isNaN(Number(m.extra[k])))
        .map((m) => ({ date: m.measured_on as string, value: Number(m.extra[k]) }));
      if (!series.length) return;
      const start = series[0];
      const latest = series[series.length - 1];
      cards.push({
        key: `extra:${k}`,
        label: k.replace(/_/g, " "),
        unit: "in",
        current: latest.value,
        start: start.value,
        latest: latest.value,
        change: Number((latest.value - start.value).toFixed(1)),
        latestDate: latest.date,
        startDate: start.date,
        series,
      });
    });

    const apptsInRange = data.appts.filter((a) => inRange(a.starts_at));
    const completed = apptsInRange.filter((a) => a.status === "completed").length;
    const counted = apptsInRange.filter((a) =>
      ["completed", "no_show", "late_cancel"].includes(a.status)).length;

    const strengthByExercise = new Map<string, any>();
    data.prs
      .filter((p) => p.status !== "rejected")
      .forEach((p) => {
        const cur = strengthByExercise.get(p.exercise);
        if (!cur || Number(p.weight_lbs ?? 0) > Number(cur.weight_lbs ?? 0)) strengthByExercise.set(p.exercise, p);
      });

    return {
      cards,
      attendance: {
        rate: counted ? Math.round((completed / counted) * 100) : null,
        completed,
        counted,
        noShows: apptsInRange.filter((a) => a.status === "no_show").length,
      },
      compliance: data.compliance.planned
        ? Math.round((data.compliance.completed / data.compliance.planned) * 100)
        : null,
      compliancePlanned: data.compliance.planned,
      complianceCompleted: data.compliance.completed,
      strengthRecords: Array.from(strengthByExercise.values()),
      prsInRange: data.prs.filter((p) => inRange(p.achieved_on)),
      allPrs: data.prs,
      reassessments: data.tests.filter((t) => t.is_reassessment),
      tests: data.tests,
      nextReassessment: data.programs.map((p: any) => p.next_reassessment).filter(Boolean).sort()[0] ?? null,
      appts: data.appts,
    };
  }, [data, range]);
}

/** Progress photos with short-lived signed URLs (bucket is private). */
export function usePTMProgressPhotos(userId?: string) {
  return useQuery({
    queryKey: ["ptm-progress-photos", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_progress_photos")
        .select("*")
        .eq("user_id", userId)
        .order("taken_on", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      if (!rows.length) return [] as any[];
      const { data: signed } = await supabase.storage
        .from("pt-progress-photos")
        .createSignedUrls(rows.map((r) => r.storage_path), 60 * 30);
      const byPath = new Map((signed ?? []).map((s: any) => [s.path, s.signedUrl]));
      return rows.map((r) => ({ ...r, url: byPath.get(r.storage_path) ?? null }));
    },
  });
}

export function usePTMProgressMutations(userId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ptm-progress"] });
    qc.invalidateQueries({ queryKey: ["ptm-progress-photos", userId] });
    qc.invalidateQueries({ queryKey: ["ptm-client-summary", userId] });
    qc.invalidateQueries({ queryKey: ["pt-progress-data", userId] });
  };

  const addMetrics = useMutation({
    mutationFn: async (args: { measuredOn: string; values: Record<string, string>; notes: string }) => {
      if (!userId) throw new Error("Select a client first");
      const { data: auth } = await supabase.auth.getUser();
      const num = (v?: string) => (v == null || v.trim() === "" ? null : Number(v));
      const payload: Record<string, any> = {
        user_id: userId,
        measured_on: args.measuredOn,
        notes: args.notes || null,
        created_by: auth?.user?.id ?? null,
      };
      METRIC_FIELDS.forEach((f) => { payload[f.key] = num(args.values[f.key]); });
      const hasValue = METRIC_FIELDS.some((f) => payload[f.key] != null);
      if (!hasValue) throw new Error("Enter at least one measurement");
      const { error } = await (supabase as any).from("pt_body_metrics").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { ptmToast.success("Measurements saved"); invalidate(); },
    onError: (e: any) => ptmToast.error(e?.message ?? "Could not save measurements"),
  });

  const addPhoto = useMutation({
    mutationFn: async (args: { file: File; pose: string; takenOn: string; notes: string }) => {
      if (!userId) throw new Error("Select a client first");
      const { data: auth } = await supabase.auth.getUser();
      const file = await compressImage(args.file);
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("pt-progress-photos").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await (supabase as any).from("pt_progress_photos").insert({
        user_id: userId,
        storage_path: path,
        pose: args.pose || null,
        taken_on: args.takenOn,
        notes: args.notes || null,
        created_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { ptmToast.success("Photo uploaded"); invalidate(); },
    onError: (e: any) => ptmToast.error(e?.message ?? "Could not upload photo"),
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: { id: string; storage_path: string }) => {
      const { error } = await (supabase as any).from("pt_progress_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from("pt-progress-photos").remove([photo.storage_path]);
    },
    onSuccess: () => { ptmToast.success("Photo deleted"); invalidate(); },
    onError: (e: any) => ptmToast.error(e?.message ?? "Could not delete photo"),
  });

  const confirmPR = useMutation({
    mutationFn: async (pr: { id: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("pt_prs")
        .update({ status: "confirmed", confirmed_by: auth?.user?.id ?? null, confirmed_at: new Date().toISOString() })
        .eq("id", pr.id);
      if (error) throw error;
    },
    onSuccess: () => { ptmToast.success("PR confirmed"); invalidate(); },
    onError: (e: any) => ptmToast.error(e?.message ?? "Could not confirm PR"),
  });

  return { addMetrics, addPhoto, deletePhoto, confirmPR, metricFields: METRIC_FIELDS };
}

export { METRIC_FIELDS };
