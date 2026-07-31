import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PTMSessionExercise } from "./usePTMLiveSession";

/* --------------------------------------------------------------- summary */

export interface PTMSessionSummary {
  durationMinutes: number | null;
  exercisesPlanned: number;
  exercisesCompleted: number;
  exercisesSkipped: number;
  totalSets: number;
  completedSets: number;
  totalVolume: number | null;
  averageRpe: number | null;
  prs: { exercise: string; weight: number | null; reps: number | null }[];
  modifications: { exercise: string; modification: string }[];
  painFlags: { exercise: string; note: string | null }[];
  completionPct: number;
}

function minutesBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

/** Derives every metric shown on the post-session summary from logged data only. */
export function ptmBuildSummary(
  exercises: PTMSessionExercise[],
  appointment: any,
  elapsedSeconds?: number | null,
): PTMSessionSummary {
  const sets = exercises.flatMap((e) => e.sets ?? []);
  const completedSets = sets.filter((s) => s.completed);

  let volume = 0;
  let hasVolume = false;
  let rpeSum = 0;
  let rpeCount = 0;
  for (const s of completedSets) {
    if (s.weight_lbs != null && s.reps != null) {
      volume += Number(s.weight_lbs) * Number(s.reps);
      hasVolume = true;
    }
    if (s.rpe != null) {
      rpeSum += Number(s.rpe);
      rpeCount += 1;
    }
  }

  const done = exercises.filter((e) => e.status === "done").length;
  const skipped = exercises.filter((e) => e.status === "skipped").length;
  const planned = exercises.length;

  const prs = exercises.flatMap((e) =>
    (e.sets ?? [])
      .filter((s) => s.is_pr)
      .map((s) => ({ exercise: e.exercise, weight: s.weight_lbs, reps: s.reps })),
  );

  const modifications = exercises
    .filter((e) => !!e.modification)
    .map((e) => ({ exercise: e.exercise, modification: e.modification as string }));

  const painFlags = exercises.flatMap((e) =>
    (e.sets ?? []).filter((s) => s.pain_flag).map((s) => ({ exercise: e.exercise, note: s.notes })),
  );

  const durationFromTimer = elapsedSeconds ? Math.round(elapsedSeconds / 60) : null;
  const duration =
    minutesBetween(appointment?.started_at, appointment?.completed_at ?? new Date().toISOString()) ??
    durationFromTimer ??
    appointment?.duration_minutes ??
    null;

  return {
    durationMinutes: duration,
    exercisesPlanned: planned,
    exercisesCompleted: done,
    exercisesSkipped: skipped,
    totalSets: sets.length,
    completedSets: completedSets.length,
    totalVolume: hasVolume ? Math.round(volume) : null,
    averageRpe: rpeCount ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
    prs,
    modifications,
    painFlags,
    completionPct: planned ? Math.round((done / planned) * 100) : sets.length ? Math.round((completedSets.length / sets.length) * 100) : 0,
  };
}

/* ------------------------------------------------------------- documentation */

export interface PTMPostDoc {
  subjective: string; // Session summary
  objective: string; // Client performance
  observations: string; // Trainer observations
  pain_discomfort: string; // Pain / restriction changes
  client_recap: string;
  homework: string;
  next_focus: string;
  private_note: string;
  modifications: string;
  rpe: string;
}

const EMPTY_DOC: PTMPostDoc = {
  subjective: "", objective: "", observations: "", pain_discomfort: "",
  client_recap: "", homework: "", next_focus: "", private_note: "", modifications: "", rpe: "",
};

/** Existing (draft) note for this appointment, if one exists. */
export function usePTMSessionNote(appointmentId?: string) {
  return useQuery({
    queryKey: ["ptm-post-note", appointmentId],
    enabled: !!appointmentId,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_session_notes")
        .select("*")
        .eq("appointment_id", appointmentId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/**
 * Post-session documentation state with local draft recovery.
 * Pre-fills only factual, logged data — never invented clinical observations.
 */
export function usePTMPostDoc(appointmentId: string | undefined, note: any, summary: PTMSessionSummary) {
  const [doc, setDoc] = useState<PTMPostDoc>(EMPTY_DOC);
  const [dirty, setDirty] = useState(false);
  const hydrated = useRef(false);
  const draftKey = `ptm-post-draft:${appointmentId ?? "none"}`;

  useEffect(() => {
    if (hydrated.current || !appointmentId) return;
    hydrated.current = true;
    const base: PTMPostDoc = {
      ...EMPTY_DOC,
      subjective: note?.subjective ?? "",
      objective: note?.objective ?? "",
      observations: note?.observations ?? "",
      pain_discomfort: note?.pain_discomfort ?? "",
      client_recap: note?.client_recap ?? "",
      homework: note?.homework ?? "",
      next_focus: note?.next_focus ?? "",
      private_note: note?.private_note ?? "",
      modifications:
        note?.modifications ??
        summary.modifications.map((m) => `${m.exercise}: ${m.modification}`).join("\n"),
      rpe: note?.rpe != null ? String(note.rpe) : summary.averageRpe != null ? String(summary.averageRpe) : "",
    };
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.doc) {
          setDoc({ ...base, ...parsed.doc });
          toast.info("Recovered unsaved documentation from this device");
          return;
        }
      }
    } catch { /* ignore */ }
    setDoc(base);
  }, [appointmentId, note, summary, draftKey]);

  const update = useCallback(
    (field: keyof PTMPostDoc, value: string) => {
      setDirty(true);
      setDoc((prev) => {
        const next = { ...prev, [field]: value };
        try { localStorage.setItem(draftKey, JSON.stringify({ doc: next, at: Date.now() })); } catch { /* ignore */ }
        return next;
      });
    },
    [draftKey],
  );

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setDirty(false);
  }, [draftKey]);

  /** Documentation the club requires before a session can be marked complete. */
  const missing = useMemo(() => {
    const out: string[] = [];
    if (!doc.subjective.trim()) out.push("Session summary");
    if (!doc.next_focus.trim()) out.push("Next-session focus");
    if (summary.painFlags.length && !doc.pain_discomfort.trim()) out.push("Pain / restriction changes");
    return out;
  }, [doc, summary.painFlags.length]);

  return { doc, update, dirty, clearDraft, missing };
}

/* ------------------------------------------------------------ save + complete */

export function usePTMPostActions(appointmentId?: string, userId?: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    ["ptm-post-note", "ptm-next-session", "ptm-live-session", "ptm-today", "pt-appointments",
      "pt-passes", "pt-dashboard", "pt-session-notes-list", "pt-prs", "pt-tasks"]
      .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const toPayload = (doc: PTMPostDoc, exercises: PTMSessionExercise[], summary: PTMSessionSummary) => ({
    subjective: doc.subjective,
    objective: doc.objective,
    observations: doc.observations,
    pain_discomfort: doc.pain_discomfort,
    client_recap: doc.client_recap,
    homework: doc.homework,
    next_focus: doc.next_focus,
    private_note: doc.private_note,
    modifications: doc.modifications,
    rpe: doc.rpe,
    exercise_log: {
      summary,
      exercises: exercises.map((e) => ({
        exercise: e.exercise,
        status: e.status,
        skip_reason: e.skip_reason,
        modification: e.modification,
        sets: (e.sets ?? []).map((s) => ({
          set_number: s.set_number, weight_lbs: s.weight_lbs, reps: s.reps,
          duration_seconds: s.duration_seconds, distance: s.distance, rpe: s.rpe,
          completed: s.completed, pain_flag: s.pain_flag, is_pr: s.is_pr, notes: s.notes,
        })),
      })),
    },
  });

  /** Saves documentation as a draft without completing the session. */
  const saveDraft = useMutation({
    mutationFn: async (args: { doc: PTMPostDoc; exercises: PTMSessionExercise[]; summary: PTMSessionSummary; sessionDate: string }) => {
      if (!appointmentId || !userId) throw new Error("Missing session");
      const payload = toPayload(args.doc, args.exercises, args.summary);
      const { data: auth } = await supabase.auth.getUser();
      const { data: existing } = await (supabase as any)
        .from("pt_session_notes").select("id").eq("appointment_id", appointmentId).maybeSingle();
      const row = {
        ...payload,
        rpe: payload.rpe === "" ? null : Number(payload.rpe),
        is_draft: true,
        updated_by: auth?.user?.id ?? null,
        updated_at: new Date().toISOString(),
      };
      if (existing?.id) {
        const { error } = await (supabase as any).from("pt_session_notes").update(row).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("pt_session_notes").insert({
          ...row,
          appointment_id: appointmentId,
          user_id: userId,
          session_date: args.sessionDate,
          created_by: auth?.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Documentation saved"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save documentation"),
  });

  /**
   * Atomic completion: status, timestamp, notes, exercise log and package deduction.
   * Fails loudly (never silently) when the package deduction cannot be applied.
   */
  const complete = useMutation({
    mutationFn: async (args: {
      doc: PTMPostDoc; exercises: PTMSessionExercise[]; summary: PTMSessionSummary; deduct: boolean;
    }) => {
      if (!appointmentId) throw new Error("Missing session");
      const payload = toPayload(args.doc, args.exercises, args.summary);
      const { data, error } = await (supabase as any).rpc("pt_complete_session", {
        p_appointment_id: appointmentId,
        p_note: payload,
        p_deduct: args.deduct,
      });
      if (error) throw error;
      return data as { deducted: boolean; pass_name: string | null; sessions_remaining: number | null };
    },
    onSuccess: (res) => {
      toast.success(
        res?.deducted
          ? `Session completed · ${res.sessions_remaining ?? 0} left on ${res.pass_name ?? "package"}`
          : "Session completed",
      );
      invalidate();
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      toast.error(
        msg.includes("PACKAGE_DEDUCTION_FAILED")
          ? "Package deduction failed — no session credit available. Session was not completed."
          : msg || "Could not complete session",
      );
    },
  });

  /** Emails the client-facing recap. */
  const sendRecap = useMutation({
    mutationFn: async (args: { recap: string; homework: string }) => {
      const { error } = await supabase.functions.invoke("send-pt-booking-email", {
        body: {
          appointment_id: appointmentId,
          type: "session_recap",
          recap: args.recap,
          homework: args.homework,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Recap sent to client"),
    onError: (e: any) => toast.error(e?.message ?? "Could not send recap"),
  });

  const createTask = useMutation({
    mutationFn: async (args: { title: string; detail: string; dueAt: string | null; instructorId: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_tasks").insert({
        title: args.title,
        detail: args.detail || null,
        task_type: "follow_up",
        priority: "medium",
        due_at: args.dueAt,
        client_user_id: userId ?? null,
        instructor_id: args.instructorId,
        assigned_to: auth?.user?.id ?? null,
        appointment_id: appointmentId ?? null,
        status: "todo",
        created_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Follow-up task created"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not create task"),
  });

  const recordProgress = useMutation({
    mutationFn: async (args: { weight: string; bodyFat: string; waist: string; notes: string }) => {
      if (!userId) throw new Error("Missing client");
      const { data: auth } = await supabase.auth.getUser();
      const num = (v: string) => (v.trim() === "" ? null : Number(v));
      const { error } = await (supabase as any).from("pt_body_metrics").insert({
        user_id: userId,
        measured_on: new Date().toISOString().slice(0, 10),
        weight_lbs: num(args.weight),
        body_fat_pct: num(args.bodyFat),
        waist_in: num(args.waist),
        notes: args.notes || null,
        created_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Progress recorded"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not record progress"),
  });

  const addProgressPhoto = useMutation({
    mutationFn: async (args: { file: File; pose: string; notes: string }) => {
      if (!userId) throw new Error("Missing client");
      const { data: auth } = await supabase.auth.getUser();
      const path = `${userId}/${Date.now()}-${args.file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("pt-progress-photos").upload(path, args.file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await (supabase as any).from("pt_progress_photos").insert({
        user_id: userId,
        storage_path: path,
        pose: args.pose || null,
        taken_on: new Date().toISOString().slice(0, 10),
        notes: args.notes || null,
        created_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Photo added"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not add photo"),
  });

  return { saveDraft, complete, sendRecap, createTask, recordProgress, addProgressPhoto };
}
