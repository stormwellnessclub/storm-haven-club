import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PTSessionNote {
  id: string;
  user_id: string;
  instructor_id: string | null;
  appointment_id: string | null;
  program_id: string | null;
  session_date: string;
  subjective: string | null;
  objective: string | null;
  observations: string | null;
  mobility_issues: string | null;
  pain_discomfort: string | null;
  energy_level: number | null;
  modifications: string | null;
  rpe: number | null;
  homework: string | null;
  next_focus: string | null;
  private_note: string | null;
  is_draft: boolean | null;
  updated_at: string | null;
}

export function usePTSessionNotesList(userId?: string) {
  return useQuery({
    queryKey: ["pt-session-notes-list", userId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any).from("pt_session_notes").select("*")
        .order("session_date", { ascending: false }).limit(300);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PTSessionNote[];
    },
  });
}

/** Context a trainer can reference while writing: last note, restrictions, program, last PR. */
export function usePTSessionContext(userId?: string, currentNoteId?: string) {
  return useQuery({
    queryKey: ["pt-session-context", userId, currentNoteId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: notes }, { data: profile }, { data: programs }, { data: prs }] = await Promise.all([
        (supabase as any).from("pt_session_notes").select("*").eq("user_id", userId)
          .order("session_date", { ascending: false }).limit(5),
        (supabase as any).from("pt_client_profiles").select("*").eq("user_id", userId).maybeSingle(),
        (supabase as any).from("pt_programs").select("id, name, goal, status, next_reassessment")
          .eq("user_id", userId).neq("status", "archived").order("created_at", { ascending: false }),
        (supabase as any).from("pt_prs").select("*").eq("user_id", userId).eq("status", "confirmed")
          .order("achieved_on", { ascending: false }).limit(5),
      ]);
      const previous = (notes ?? []).find((n: any) => n.id !== currentNoteId) ?? null;

      let lastLoads: { exercise: string; load: string | null; sets: number | null; reps: string | null }[] = [];
      const program = (programs ?? [])[0];
      if (program) {
        const { data: days } = await (supabase as any)
          .from("pt_program_days").select("id").eq("program_id", program.id);
        const dayIds = (days ?? []).map((d: any) => d.id);
        if (dayIds.length) {
          const { data: exs } = await (supabase as any)
            .from("pt_program_exercises").select("exercise, load, sets, reps, completed_result")
            .in("day_id", dayIds).limit(50);
          lastLoads = (exs ?? []).map((e: any) => ({
            exercise: e.exercise, load: e.completed_result ?? e.load, sets: e.sets, reps: e.reps,
          }));
        }
      }
      return {
        previous,
        profile: profile ?? null,
        programs: (programs ?? []) as any[],
        prs: (prs ?? []) as any[],
        lastLoads,
      };
    },
  });
}

export function usePTSessionNoteMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["pt-session-notes-list"] });
  const fail = (e: any) => toast.error(e?.message ?? "Could not save note");

  const create = useMutation({
    mutationFn: async (input: Partial<PTSessionNote> & { user_id: string; session_date: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any).from("pt_session_notes")
        .insert({ is_draft: true, created_by: auth?.user?.id ?? null, ...input })
        .select("*").single();
      if (error) throw error;
      return data as PTSessionNote;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_session_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Note deleted"); refresh(); },
    onError: fail,
  });

  return { create, remove };
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** Debounced autosave for the session-note form. Saves drafts automatically. */
export function usePTNoteAutosave(note: PTSessionNote | null) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<PTSessionNote | null>(note);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<number | null>(null);
  const noteId = note?.id;

  useEffect(() => { setDraft(note); setState("idle"); }, [noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(patch: Record<string, any>, id: string) {
    setState("saving");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("pt_session_notes")
      .update({ ...patch, updated_at: new Date().toISOString(), updated_by: auth?.user?.id ?? null })
      .eq("id", id);
    if (error) { setState("error"); toast.error(error.message); return; }
    setState("saved");
    qc.invalidateQueries({ queryKey: ["pt-session-notes-list"] });
  }

  function setField(key: keyof PTSessionNote, value: any) {
    if (!draft) return;
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => persist({ [key]: value }, next.id), 800);
  }

  async function finalize() {
    if (!draft) return;
    if (timer.current) window.clearTimeout(timer.current);
    await persist({ ...stripped(draft), is_draft: false }, draft.id);
    setDraft({ ...draft, is_draft: false });
    toast.success("Session note finalized");
  }

  async function reopen() {
    if (!draft) return;
    await persist({ is_draft: true }, draft.id);
    setDraft({ ...draft, is_draft: true });
  }

  return { draft, setField, state, finalize, reopen };
}

function stripped(n: PTSessionNote) {
  const { id, created_at, updated_at, ...rest } = n as any;
  return rest;
}
