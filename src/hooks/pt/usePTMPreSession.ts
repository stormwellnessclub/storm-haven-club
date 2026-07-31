import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PTMChecklistState {
  [key: string]: { done: boolean; at: string; by: string | null; byName?: string | null } | undefined;
}

export interface PTMChecklistItem {
  key: string;
  label: string;
  /** Blocks Start Session without an explicit warning override. */
  required: boolean;
  hint?: string;
}

/** Configurable pre-session preparation checklist. */
export function ptmPrepItems(opts: { identityRequired: boolean; hasRestrictions: boolean }): PTMChecklistItem[] {
  return [
    { key: "arrived", label: "Client arrived", required: true },
    ...(opts.identityRequired
      ? [{ key: "identity", label: "Identity verified", required: true, hint: "First session or flagged account" }]
      : []),
    { key: "health", label: "Health status reviewed", required: true },
    {
      key: "restrictions",
      label: "Restrictions reviewed",
      required: opts.hasRestrictions,
      hint: opts.hasRestrictions ? "Active restrictions on file" : undefined,
    },
    { key: "last_session", label: "Last session reviewed", required: false },
    { key: "plan", label: "Today’s workout plan reviewed", required: true },
    { key: "equipment", label: "Equipment / room prepared", required: false },
  ];
}

/** Full last-session summary for pre-session prep. */
export function usePTMLastSession(userId?: string, excludeAppointmentId?: string) {
  return useQuery({
    queryKey: ["ptm-last-session", userId, excludeAppointmentId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("pt_session_notes")
        .select(
          "id, appointment_id, session_date, subjective, objective, observations, modifications, pain_discomfort, rpe, homework, next_focus, exercise_log, energy_level",
        )
        .eq("user_id", userId)
        .order("session_date", { ascending: false })
        .limit(1);
      if (excludeAppointmentId) q = q.neq("appointment_id", excludeAppointmentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });
}

/** Checklist + autosaved pre-session note persisted on the appointment. */
export function usePTMPreSession(appointmentId?: string, appointment?: any) {
  const qc = useQueryClient();
  const [checklist, setChecklist] = useState<PTMChecklistState>({});
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const hydrated = useRef(false);
  const draftKey = `ptm-pre-draft:${appointmentId ?? "none"}`;

  // Hydrate from server, then recover any newer local draft.
  useEffect(() => {
    if (hydrated.current || !appointment) return;
    hydrated.current = true;
    setChecklist((appointment.prep_checklist as PTMChecklistState) ?? {});
    const serverNote = appointment.pre_session_note ?? "";
    let next = serverNote;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        const serverAt = appointment.pre_session_note_updated_at
          ? new Date(appointment.pre_session_note_updated_at).getTime()
          : 0;
        if (d?.text != null && d.at > serverAt && d.text !== serverNote) {
          next = d.text;
          toast.info("Recovered an unsaved note from this device");
        }
      }
    } catch { /* ignore */ }
    setNote(next);
    setSavedAt(appointment.pre_session_note_updated_at ?? null);
  }, [appointment, draftKey]);

  const save = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!appointmentId) return;
      const { error } = await (supabase as any)
        .from("pt_appointments")
        .update(patch)
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ptm-next-session"] });
      qc.invalidateQueries({ queryKey: ["pt-appointments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const toggleItem = useCallback(
    async (key: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      const current = checklist[key];
      const next: PTMChecklistState = {
        ...checklist,
        [key]: current?.done
          ? undefined
          : { done: true, at: new Date().toISOString(), by: uid, byName: auth?.user?.email ?? null },
      };
      if (!next[key]) delete next[key];
      setChecklist(next);
      save.mutate({ prep_checklist: next });
    },
    [checklist, save],
  );

  // Debounced autosave of the note + local draft mirror.
  const timer = useRef<number | null>(null);
  const onNoteChange = useCallback(
    (text: string) => {
      setNote(text);
      setDirty(true);
      try { localStorage.setItem(draftKey, JSON.stringify({ text, at: Date.now() })); } catch { /* ignore */ }
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const at = new Date().toISOString();
        save.mutate(
          { pre_session_note: text, pre_session_note_updated_at: at },
          {
            onSuccess: () => {
              setDirty(false);
              setSavedAt(at);
              try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
            },
          },
        );
      }, 1200);
    },
    [draftKey, save],
  );

  const flush = useCallback(() => {
    if (!dirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    const at = new Date().toISOString();
    save.mutate({ pre_session_note: note, pre_session_note_updated_at: at });
    setDirty(false);
  }, [dirty, note, save]);

  return { checklist, toggleItem, note, onNoteChange, dirty, savedAt, flush, saving: save.isPending };
}

/** Browser speech-to-text for the note field, when the device supports it. */
export function usePTMDictation(onText: (t: string) => void) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const supported = useMemo(
    () => typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
    [],
  );

  const toggle = useCallback(() => {
    if (!supported) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      const chunk = Array.from(e.results as any)
        .slice(e.resultIndex)
        .map((r: any) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (chunk) onText(chunk);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, onText, supported]);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* ignore */ } }, []);

  return { supported, listening, toggle };
}
