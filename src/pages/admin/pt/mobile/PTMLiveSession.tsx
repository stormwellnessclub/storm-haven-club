import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Pause, Play, MoreHorizontal, ChevronLeft, ChevronRight, Plus, Trash2, Check,
  Undo2, Repeat, SkipForward, ListChecks, ShieldAlert, Camera, StickyNote,
  Trophy, WifiOff, AlertTriangle, Copy, MessageSquare, ArrowUp, ArrowDown, X, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompress";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import {
  PTMCard, PTMBadge, PTMLabel, PTMError, PTMListSkeleton, PTMStickyActions, ptmButtonClass, PTMSectionTitle,
} from "@/components/admin/pt/mobile/PTMobileUI";
import { PTMSheet, PTMConfirm, PTMAlert, PTMStageIndicator } from "@/components/admin/pt/mobile/PTMobileParts";
import { usePTMNextSession, ptmListFrom } from "@/hooks/pt/usePTMNextSession";
import {
  usePTMLiveSession, usePTMLiveActions, usePTMPreviousPerformance, usePTMSeedWorkout,
  usePTMSessionTimer, usePTMOnline, ptmFormatClock, PTMSessionExercise, PTMSessionSet,
} from "@/hooks/pt/usePTMLiveSession";
import { usePTAppointmentActions } from "@/hooks/pt/usePTSchedule";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SKIP_REASONS = ["Time ran out", "Pain / discomfort", "Equipment unavailable", "Client request", "Substituted"];

function NumField({
  label, value, onChange, step = 1, suffix,
}: { label: string; value: number | null; onChange: (v: number | null) => void; step?: number; suffix?: string }) {
  return (
    <div className="min-w-0">
      <PTMLabel>{label}</PTMLabel>
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          className="h-10 w-9 shrink-0 rounded-l-xl border border-pt-line bg-pt-beige text-[18px] text-pt-ink active:bg-pt-line"
          onClick={() => onChange(Math.max(0, (value ?? 0) - step))}
        >
          −
        </button>
        <input
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="h-10 w-full min-w-0 border-y border-pt-line bg-white px-1 text-center text-[16px] font-semibold text-pt-ink outline-none focus:border-pt-gold"
        />
        <button
          type="button"
          className="h-10 w-9 shrink-0 rounded-r-xl border border-pt-line bg-pt-beige text-[18px] text-pt-ink active:bg-pt-line"
          onClick={() => onChange((value ?? 0) + step)}
        >
          +
        </button>
      </div>
      {suffix && <p className="mt-0.5 text-center text-[10px] uppercase tracking-widest text-pt-muted">{suffix}</p>}
    </div>
  );
}

export default function PTMLiveSession() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const online = usePTMOnline();

  const { data: session, isLoading: sessionLoading, error: sessionError, refetch: refetchSession } = usePTMNextSession(appointmentId);
  const appt = session?.appointment;
  const client = session?.client;

  const { data: exercises = [], isLoading, error, refetch } = usePTMLiveSession(appointmentId);
  const actions = usePTMLiveActions(appointmentId, appt?.user_id);
  const apptActions = usePTAppointmentActions();
  const seed = usePTMSeedWorkout(appointmentId, appt?.user_id);
  const { data: previous = {} } = usePTMPreviousPerformance(
    appt?.user_id, appointmentId, exercises.map((e) => e.exercise),
  );

  const timer = usePTMSessionTimer(appointmentId, appt?.live_state, (s) => actions.saveLiveState(s));
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(t);
  }, []);

  const [index, setIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [substituteFor, setSubstituteFor] = useState<PTMSessionExercise | null>(null);
  const [skipFor, setSkipFor] = useState<PTMSessionExercise | null>(null);
  const [newName, setNewName] = useState("");
  const [noteSheet, setNoteSheet] = useState<null | "note" | "cue" | "modification" | "pain">(null);
  const [noteText, setNoteText] = useState("");
  const [removeSet, setRemoveSet] = useState<PTMSessionSet | null>(null);
  const [prCandidate, setPrCandidate] = useState<null | { set: PTMSessionSet; ex: PTMSessionExercise; prev: number | null }>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /** Real upload: compress, push to the progress-photo bucket, record the row. */
  const attachPhoto = async (file: File) => {
    if (!appt?.user_id || uploadingPhoto) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const { data: auth } = await supabase.auth.getUser();
      const path = `${appt.user_id}/${Date.now()}-${compressed.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("pt-progress-photos")
        .upload(path, compressed, { upsert: false, contentType: compressed.type });
      if (upErr) throw upErr;
      const { error } = await (supabase as any).from("pt_progress_photos").insert({
        user_id: appt.user_id,
        storage_path: path,
        taken_on: new Date().toISOString().slice(0, 10),
        notes: "Captured during live session",
        created_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
      setMoreOpen(false);
      toast.success("Photo saved to this client's progress photos");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload the photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Seed today's plan once, then auto-start the clock.
  useEffect(() => {
    if (!appointmentId || !appt?.user_id || isLoading) return;
    if (exercises.length === 0 && !seed.isPending && !seed.isSuccess) seed.mutate();
  }, [appointmentId, appt?.user_id, exercises.length, isLoading, seed]);

  useEffect(() => {
    if (appt && !timer.running && (timer.seconds === 0)) timer.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt?.id]);

  useEffect(() => {
    if (timer.currentIndex && timer.currentIndex !== index) setIndex(timer.currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.currentIndex]);

  // Warn before leaving an active session.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const active = exercises[Math.min(index, Math.max(exercises.length - 1, 0))];
  const doneCount = exercises.filter((e) => e.status === "done" || e.status === "skipped").length;
  const restrictions = useMemo(
    () => [...ptmListFrom(session?.profile?.injuries), ...ptmListFrom(session?.profile?.restrictions)],
    [session],
  );
  const prev = active ? previous[active.exercise.toLowerCase()] : undefined;

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(i, exercises.length - 1));
    setIndex(next);
    timer.setIndex(next);
    setListOpen(false);
  };

  const completeSet = async (s: PTMSessionSet) => {
    await actions.updateSet(s.id, { completed: true, completed_at: new Date().toISOString() });
    const best = prev?.best ?? 0;
    if (s.weight_lbs != null && best > 0 && Number(s.weight_lbs) > best && active) {
      setPrCandidate({ set: s, ex: active, prev: best });
    }
  };

  const finish = async () => {
    setFinishing(true);
    timer.pause();
    await actions.saveLiveState({ elapsed: timer.seconds, runningSince: null, currentIndex: index });
    const ok = await apptActions.completeSession(appt!.id);
    setFinishing(false);
    if (ok !== false) navigate(`/admin/pt/m/session/${appt!.id}/post`);
  };

  if (isLoading || sessionLoading) {
    return <PTMobileShell title="Live Session" back><PTMListSkeleton rows={5} /></PTMobileShell>;
  }
  if (error || sessionError || !appt || !client) {
    return (
      <PTMobileShell title="Live Session" back>
        <PTMError
          message={(error as any)?.message ?? (sessionError as any)?.message ?? "Session unavailable"}
          onRetry={() => { refetch(); refetchSession(); }}
        />
      </PTMobileShell>
    );
  }

  return (
    <PTMobileShell
      title="Live Session"
      back
      onBack={() => setConfirmExit(true)}
      /* Hide the tab bar so a stray tap can't drop out of a live session. */
      hideNav
      headerAccessory={
        <div className="space-y-2 px-4 pb-3">
          <PTMStageIndicator stage="live" />
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-pt-noir/90 px-3 py-2.5 text-pt-cream">
            <div className="min-w-0">
              <p className="font-mono text-[26px] font-semibold leading-none tabular-nums">{ptmFormatClock(timer.seconds)}</p>
              <p className="truncate text-[11px] uppercase tracking-widest text-pt-cream/60">
                {client.name} · {format(now, "h:mm a")} · {timer.running ? "In progress" : "Paused"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-pt-gold text-pt-noir"
                onClick={() => (timer.running ? timer.pause() : timer.start())}
                aria-label={timer.running ? "Pause session" : "Resume session"}
              >
                {timer.running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-pt-cream/25"
                onClick={() => setMoreOpen(true)}
                aria-label="More actions"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-6">
        {!online && (
          <div className="flex items-center gap-2 rounded-xl bg-pt-amber/15 px-3 py-2 text-[12px] text-pt-amber">
            <WifiOff className="h-4 w-4" /> Offline — entries are kept on this device and retried when you reconnect.
          </div>
        )}

        {/* Progress + navigation */}
        <div className="flex items-center gap-2">
          <button className={cn(ptmButtonClass("outline"), "w-11 px-0")} disabled={index === 0} onClick={() => goTo(index - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className={cn(ptmButtonClass("outline"), "flex-1")} onClick={() => setListOpen(true)}>
            <ListChecks className="h-4 w-4" />
            {exercises.length ? `Exercise ${Math.min(index + 1, exercises.length)} of ${exercises.length}` : "Workout"}
          </button>
          <button
            className={cn(ptmButtonClass("outline"), "w-11 px-0")}
            disabled={index >= exercises.length - 1}
            onClick={() => goTo(index + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-pt-line">
          <div
            className="h-full rounded-full bg-pt-gold transition-all"
            style={{ width: `${exercises.length ? (doneCount / exercises.length) * 100 : 0}%` }}
          />
        </div>

        {!active ? (
          <PTMCard className="bg-white p-5 text-center">
            <p className="text-[15px] font-semibold text-pt-ink">No exercises yet</p>
            <p className="mt-1 text-[13px] text-pt-muted">Add the first movement to start logging sets.</p>
            <button className={cn(ptmButtonClass("gold"), "mt-3")} onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add exercise
            </button>
          </PTMCard>
        ) : (
          <>
            {/* Current exercise */}
            <PTMCard className="bg-white p-4">
              <div className="flex gap-3">
                {active.media_url ? (
                  <img src={active.media_url} alt={`${active.exercise} demonstration`} loading="lazy"
                       className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-pt-beige text-[20px] font-semibold text-pt-muted">
                    {active.exercise.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-semibold text-pt-ink">{active.exercise}</p>
                  <p className="text-[13px] text-pt-muted">
                    {(active.planned_sets ?? active.sets.length ?? 0) || "—"} × {active.planned_reps ?? "—"}
                    {active.planned_load ? ` · ${active.planned_load}` : ""}
                    {active.rest ? ` · rest ${active.rest}` : ""}
                  </p>
                  {prev && (
                    <p className="mt-0.5 text-[12px] text-pt-muted">
                      Last time · {prev.weight ?? "—"} lb × {prev.reps ?? "—"}
                      {prev.when ? ` (${format(parseISO(prev.when), "MMM d")})` : ""}
                    </p>
                  )}
                  {active.substituted_from && (
                    <p className="mt-0.5 text-[12px] text-pt-muted">Substituted for {active.substituted_from}</p>
                  )}
                </div>
              </div>

              {active.cues && (
                <p className="mt-3 rounded-xl bg-pt-beige px-3 py-2 text-[13px] text-pt-ink">Cue · {active.cues}</p>
              )}
              {(active.modification || restrictions.length > 0) && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-pt-red/8 px-3 py-2 text-[12px] text-pt-red">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{active.modification ?? restrictions.slice(0, 3).join(" · ")}</span>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className={ptmButtonClass("outline")} onClick={() => setSubstituteFor(active)}>
                  <Repeat className="h-4 w-4" /> Substitute
                </button>
                <button className={ptmButtonClass("outline")} onClick={() => setSkipFor(active)}>
                  <SkipForward className="h-4 w-4" /> Skip
                </button>
              </div>
            </PTMCard>

            {/* Set logging */}
            <div>
              <PTMSectionTitle
                action={
                  <button
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-pt-gold"
                    onClick={() =>
                      actions.addSet(active.id, (active.sets.at(-1)?.set_number ?? 0) + 1, {
                        weight_lbs: active.sets.at(-1)?.weight_lbs ?? (prev?.weight ?? null),
                        reps: active.sets.at(-1)?.reps ?? (prev?.reps ?? null),
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> Add set
                  </button>
                }
              >
                Sets
              </PTMSectionTitle>

              {active.sets.length === 0 && (
                <PTMCard className="bg-white p-4 text-center">
                  <p className="text-[13px] text-pt-muted">No sets logged yet.</p>
                  <button
                    className={cn(ptmButtonClass("gold"), "mt-2")}
                    onClick={() => actions.addSet(active.id, 1, { weight_lbs: prev?.weight ?? null, reps: prev?.reps ?? null })}
                  >
                    <Plus className="h-4 w-4" /> Log first set
                  </button>
                </PTMCard>
              )}

              <div className="space-y-2">
                {active.sets.map((s) => (
                  <PTMCard key={s.id} className={cn("bg-white p-3", s.completed && "border-pt-gold/50 bg-pt-gold/5")}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pt-beige text-[13px] font-semibold text-pt-ink">
                          {s.set_number}
                        </span>
                        {s.is_pr && <PTMBadge tone="gold">PR</PTMBadge>}
                        {s.pain_flag && <PTMBadge tone="red">Pain</PTMBadge>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {prev?.weight != null && !s.completed && (
                          <button
                            className="inline-flex items-center gap-1 rounded-full bg-pt-beige px-2.5 py-1.5 text-[11px] font-semibold text-pt-muted"
                            onClick={() => actions.updateSet(s.id, { weight_lbs: prev.weight, reps: prev.reps })}
                          >
                            <Copy className="h-3 w-3" /> {prev.weight} lb
                          </button>
                        )}
                        <button
                          className="rounded-full p-2 text-pt-muted active:bg-pt-beige"
                          onClick={() => setRemoveSet(s)}
                          aria-label={`Remove set ${s.set_number}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full",
                            s.completed ? "bg-pt-beige text-pt-muted" : "bg-pt-gold text-pt-noir",
                          )}
                          aria-label={s.completed ? "Undo set" : "Complete set"}
                          onClick={() =>
                            s.completed
                              ? actions.updateSet(s.id, { completed: false, completed_at: null })
                              : completeSet(s)
                          }
                        >
                          {s.completed ? <Undo2 className="h-4 w-4" /> : <Check className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <NumField label="Weight" suffix="lb" step={5} value={s.weight_lbs == null ? null : Number(s.weight_lbs)}
                                onChange={(v) => actions.updateSet(s.id, { weight_lbs: v })} />
                      <NumField label="Reps" value={s.reps} onChange={(v) => actions.updateSet(s.id, { reps: v })} />
                      <NumField label="RPE" step={0.5} value={s.rpe == null ? null : Number(s.rpe)}
                                onChange={(v) => actions.updateSet(s.id, { rpe: v })} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <NumField label="Time" suffix="sec" step={5} value={s.duration_seconds}
                                onChange={(v) => actions.updateSet(s.id, { duration_seconds: v })} />
                      <NumField label="Distance" suffix="m" step={5} value={s.distance == null ? null : Number(s.distance)}
                                onChange={(v) => actions.updateSet(s.id, { distance: v })} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={s.notes ?? ""}
                        placeholder="Set note"
                        onChange={(e) => actions.updateSet(s.id, { notes: e.target.value })}
                        className="h-9 min-w-0 flex-1 rounded-xl border border-pt-line bg-pt-cream px-3 text-[13px] text-pt-ink outline-none focus:border-pt-gold"
                      />
                      <button
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                          s.pain_flag ? "border-pt-red bg-pt-red/10 text-pt-red" : "border-pt-line text-pt-muted",
                        )}
                        aria-label="Flag pain or restriction"
                        onClick={() => actions.updateSet(s.id, { pain_flag: !s.pain_flag })}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </button>
                    </div>
                  </PTMCard>
                ))}
              </div>
            </div>

            <button
              className={ptmButtonClass("primary")}
              onClick={async () => {
                await actions.updateExercise(active.id, { status: "done" });
                if (index < exercises.length - 1) goTo(index + 1);
              }}
            >
              <Check className="h-4 w-4" /> Mark exercise complete
            </button>
          </>
        )}
      </div>

      <PTMStickyActions>
        <div className="grid w-full grid-cols-2 gap-2">
          <button className={ptmButtonClass("outline")} onClick={() => { setNoteText(""); setNoteSheet("note"); }}>
            <StickyNote className="h-4 w-4" /> Note
          </button>
          <button className={ptmButtonClass("gold")} onClick={() => setConfirmFinish(true)} disabled={finishing}>
            {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Finish
          </button>
        </div>
      </PTMStickyActions>

      {/* Full workout list */}
      <PTMSheet open={listOpen} onOpenChange={setListOpen} title="Workout" description={`${doneCount} of ${exercises.length} complete`}>
        <div className="space-y-2">
          {exercises.map((e, i) => (
            <div key={e.id} className={cn("flex items-center gap-2 rounded-xl border border-pt-line bg-white p-3", i === index && "border-pt-gold")}>
              <button className="min-w-0 flex-1 text-left" onClick={() => goTo(i)}>
                <p className="truncate text-[14px] font-semibold text-pt-ink">{i + 1}. {e.exercise}</p>
                <p className="text-[12px] text-pt-muted">
                  {e.sets.filter((s) => s.completed).length}/{e.planned_sets ?? e.sets.length} sets
                  {e.status === "skipped" ? ` · skipped${e.skip_reason ? ` (${e.skip_reason})` : ""}` : ""}
                  {e.status === "done" ? " · complete" : ""}
                </p>
              </button>
              <button className="rounded-lg p-1.5 text-pt-muted active:bg-pt-beige" aria-label="Move up"
                      disabled={i === 0 || e.status === "done"}
                      onClick={() => actions.reorder(exercises.map((x) => x.id).map((id, idx, arr) =>
                        idx === i - 1 ? arr[i] : idx === i ? arr[i - 1] : id))}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button className="rounded-lg p-1.5 text-pt-muted active:bg-pt-beige" aria-label="Move down"
                      disabled={i === exercises.length - 1 || e.status === "done"}
                      onClick={() => actions.reorder(exercises.map((x) => x.id).map((id, idx, arr) =>
                        idx === i + 1 ? arr[i] : idx === i ? arr[i + 1] : id))}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button className="rounded-lg p-1.5 text-pt-muted active:bg-pt-beige" aria-label="Remove exercise"
                      onClick={() => actions.removeExercise(e.id)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button className={ptmButtonClass("outline")} onClick={() => { setListOpen(false); setAddOpen(true); }}>
            <Plus className="h-4 w-4" /> Add exercise
          </button>
        </div>
      </PTMSheet>

      {/* Add / substitute exercise */}
      <PTMSheet
        open={addOpen || !!substituteFor}
        onOpenChange={(v) => { if (!v) { setAddOpen(false); setSubstituteFor(null); setNewName(""); } }}
        title={substituteFor ? `Substitute ${substituteFor.exercise}` : "Add exercise"}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Exercise name"
          className="h-11 w-full rounded-xl border border-pt-line bg-pt-cream px-3 text-[15px] text-pt-ink outline-none focus:border-pt-gold"
        />
        <button
          className={cn(ptmButtonClass("gold"), "mt-3")}
          disabled={!newName.trim()}
          onClick={async () => {
            const name = newName.trim();
            if (substituteFor) {
              await actions.updateExercise(substituteFor.id, {
                exercise: name, substituted_from: substituteFor.substituted_from ?? substituteFor.exercise,
                exercise_id: null, media_url: null,
              });
            } else {
              await actions.addExercise({ exercise: name, display_order: exercises.length, status: "pending" } as any);
            }
            setNewName(""); setAddOpen(false); setSubstituteFor(null);
          }}
        >
          {substituteFor ? "Substitute" : "Add to workout"}
        </button>
      </PTMSheet>

      {/* Skip with reason */}
      <PTMSheet open={!!skipFor} onOpenChange={(v) => !v && setSkipFor(null)} title="Skip exercise" description="Choose a reason for the record.">
        <div className="space-y-2">
          {SKIP_REASONS.map((r) => (
            <button
              key={r}
              className={ptmButtonClass("outline")}
              onClick={async () => {
                await actions.updateExercise(skipFor!.id, { status: "skipped", skip_reason: r });
                setSkipFor(null);
                if (index < exercises.length - 1) goTo(index + 1);
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </PTMSheet>

      {/* Quick actions */}
      <PTMSheet open={moreOpen} onOpenChange={setMoreOpen} title="Session actions">
        <div className="space-y-2">
          <button className={ptmButtonClass("outline")} onClick={() => { setMoreOpen(false); setNoteText(""); setNoteSheet("cue"); }}>
            <MessageSquare className="h-4 w-4" /> Add trainer cue
          </button>
          <button className={ptmButtonClass("outline")} onClick={() => { setMoreOpen(false); setNoteText(""); setNoteSheet("modification"); }}>
            <Repeat className="h-4 w-4" /> Record modification
          </button>
          <button className={cn(ptmButtonClass("outline"), "text-pt-red")} onClick={() => { setMoreOpen(false); setNoteText(""); setNoteSheet("pain"); }}>
            <AlertTriangle className="h-4 w-4" /> Add pain alert
          </button>
          <label className={cn(ptmButtonClass("outline"), "cursor-pointer", uploadingPhoto && "opacity-60")}>
            <Camera className="h-4 w-4" /> {uploadingPhoto ? "Uploading photo…" : "Attach photo"}
            <input type="file" accept="image/*" capture="environment" className="hidden"
                   disabled={uploadingPhoto}
                   onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attachPhoto(f); }} />
          </label>
          <button className={ptmButtonClass("outline")} onClick={() => { setMoreOpen(false); setListOpen(true); }}>
            <ListChecks className="h-4 w-4" /> Full workout
          </button>
          <button className={ptmButtonClass("outline")} onClick={() => { setMoreOpen(false); navigate(`/admin/pt/m/session/${appt.id}/pre`); }}>
            <ShieldAlert className="h-4 w-4" /> Restrictions & prior session
          </button>
          <button className={ptmButtonClass("outline")} onClick={() => { timer.pause(); setMoreOpen(false); }}>
            <Pause className="h-4 w-4" /> Pause session
          </button>
        </div>
      </PTMSheet>

      {/* Note / cue / modification / pain capture */}
      <PTMSheet
        open={!!noteSheet}
        onOpenChange={(v) => !v && setNoteSheet(null)}
        title={
          noteSheet === "cue" ? "Trainer cue"
            : noteSheet === "modification" ? "Modification"
            : noteSheet === "pain" ? "Pain alert" : "Session note"
        }
      >
        <textarea
          rows={4}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="w-full resize-none rounded-xl border border-pt-line bg-pt-cream px-3 py-2.5 text-[15px] text-pt-ink outline-none focus:border-pt-gold"
          placeholder="Keep it short and factual"
        />
        <button
          className={cn(ptmButtonClass("gold"), "mt-3")}
          disabled={!noteText.trim()}
          onClick={async () => {
            const text = noteText.trim();
            if (noteSheet === "cue" && active) await actions.updateExercise(active.id, { cues: text });
            else if (noteSheet === "modification" && active) await actions.updateExercise(active.id, { modification: text });
            else if (noteSheet === "pain" && active) {
              await actions.updateExercise(active.id, { modification: `Pain · ${text}` });
              const last = active.sets.at(-1);
              if (last) await actions.updateSet(last.id, { pain_flag: true, notes: text });
            } else if (active) {
              await actions.updateExercise(active.id, { notes: [active.notes, text].filter(Boolean).join(" · ") });
            }
            setNoteSheet(null); setNoteText("");
            toast.success("Saved to this session");
          }}
        >
          Save
        </button>
      </PTMSheet>

      <PTMConfirm
        open={!!removeSet}
        onOpenChange={(v) => !v && setRemoveSet(null)}
        title={`Remove set ${removeSet?.set_number ?? ""}?`}
        description="The logged values for this set will be deleted."
        destructive
        confirmLabel="Remove set"
        onConfirm={async () => { await actions.removeSet(removeSet!.id); setRemoveSet(null); }}
      />

      <PTMConfirm
        open={!!prCandidate}
        onOpenChange={(v) => !v && setPrCandidate(null)}
        title="New personal record?"
        description={
          prCandidate
            ? `${prCandidate.ex.exercise} at ${prCandidate.set.weight_lbs} lb × ${prCandidate.set.reps ?? "—"} beats the previous best of ${prCandidate.prev} lb. Save it permanently?`
            : undefined
        }
        confirmLabel="Save PR"
        onConfirm={async () => {
          const c = prCandidate!;
          setPrCandidate(null);
          await actions.savePR({
            exercise: c.ex.exercise,
            weight: c.set.weight_lbs == null ? null : Number(c.set.weight_lbs),
            reps: c.set.reps,
            previousWeight: c.prev,
            programExerciseId: c.ex.program_exercise_id,
            setId: c.set.id,
          });
        }}
      />

      <PTMConfirm
        open={confirmExit}
        onOpenChange={setConfirmExit}
        title="Leave the live session?"
        description="The timer keeps running and every logged set is saved. You can return from Today."
        confirmLabel="Leave session"
        onConfirm={() => navigate("/admin/pt/m")}
      />

      <PTMConfirm
        open={confirmFinish}
        onOpenChange={setConfirmFinish}
        title="Finish session?"
        description={
          doneCount < exercises.length
            ? `${exercises.length - doneCount} exercise${exercises.length - doneCount === 1 ? " is" : "s are"} still open. Finishing moves you to session notes.`
            : "This marks the session complete and moves you to session notes."
        }
        confirmLabel="Finish session"
        onConfirm={() => { setConfirmFinish(false); finish(); }}
      />

      {prCandidate && (
        <div className="pointer-events-none fixed inset-x-4 top-24 z-40 flex items-center gap-2 rounded-xl bg-pt-gold px-3 py-2 text-[13px] font-semibold text-pt-noir">
          <Trophy className="h-4 w-4" /> Possible PR detected
        </div>
      )}

      {!online && <PTMAlert tone="warning" title="Offline">Reconnect to sync the remaining entries.</PTMAlert>}
    </PTMobileShell>
  );
}
