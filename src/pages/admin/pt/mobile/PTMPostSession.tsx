import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2, CalendarPlus, Mail, ListTodo, LineChart, Camera, Package,
  AlertTriangle, Trophy, Loader2, Save, ShieldAlert, Mic,
} from "lucide-react";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import {
  PTMCard, PTMBadge, PTMLabel, PTMError, PTMListSkeleton, PTMStickyActions,
  ptmButtonClass, PTMSectionTitle,
} from "@/components/admin/pt/mobile/PTMobileUI";
import { PTMSheet, PTMAlert, PTMStageIndicator, PTMAccordion } from "@/components/admin/pt/mobile/PTMobileParts";
import { usePTMNextSession } from "@/hooks/pt/usePTMNextSession";
import { usePTMLiveSession } from "@/hooks/pt/usePTMLiveSession";
import {
  ptmBuildSummary, usePTMPostActions, usePTMPostDoc, usePTMSessionNote, PTMPostDoc,
} from "@/hooks/pt/usePTMPostSession";
import { usePTMDictation } from "@/hooks/pt/usePTMPreSession";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-pt-line bg-white px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-pt-muted">{label}</p>
      <p className={cn("mt-0.5 text-[18px] font-semibold text-pt-ink", accent && "text-pt-gold")}>{value}</p>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, rows = 3, hint, dictate,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; hint?: string; dictate?: boolean;
}) {
  const dictation = usePTMDictation((t) => onChange(`${value}${value ? " " : ""}${t}`));
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <PTMLabel>{label}</PTMLabel>
        {dictate && dictation.supported && (
          <button
            type="button"
            onClick={dictation.listening ? dictation.stop : dictation.start}
            className={cn(
              "flex h-7 items-center gap-1 rounded-full border border-pt-line px-2 text-[11px]",
              dictation.listening ? "bg-pt-gold text-pt-noir" : "bg-white text-pt-muted",
            )}
          >
            <Mic className="h-3 w-3" /> {dictation.listening ? "Listening" : "Dictate"}
          </button>
        )}
      </div>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-pt-line bg-white px-3 py-2 text-[15px] text-pt-ink outline-none focus:border-pt-gold"
      />
      {hint && <p className="mt-1 text-[11px] text-pt-muted">{hint}</p>}
    </div>
  );
}

export default function PTMPostSession() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const { data: session, isLoading: sessionLoading, error: sessionError, refetch } = usePTMNextSession(appointmentId);
  const appt = session?.appointment;
  const client = session?.client;
  const pass = session?.pass;

  const { data: exercises = [], isLoading: exLoading } = usePTMLiveSession(appointmentId);
  const { data: note } = usePTMSessionNote(appointmentId);

  const elapsed = (appt?.live_state?.elapsed as number | undefined) ?? null;
  const summary = useMemo(() => ptmBuildSummary(exercises, appt, elapsed), [exercises, appt, elapsed]);
  const { doc, update, dirty, clearDraft, missing } = usePTMPostDoc(appointmentId, note, summary);
  const actions = usePTMPostActions(appointmentId, appt?.user_id);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [sheet, setSheet] = useState<null | "task" | "progress" | "photo" | "recap">(null);
  const [deduct, setDeduct] = useState(true);

  // Sheet-local state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDetail, setTaskDetail] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [metrics, setMetrics] = useState({ weight: "", bodyFat: "", waist: "", notes: "" });
  const [photo, setPhoto] = useState<{ file: File | null; pose: string; notes: string }>({ file: null, pose: "front", notes: "" });

  const alreadyCompleted = appt?.status === "completed";
  const sessionDate = appt?.starts_at ? format(parseISO(appt.starts_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  const unresolvedPain = summary.painFlags.length > 0 && !doc.pain_discomfort.trim();

  if (sessionLoading || exLoading) {
    return (
      <PTMobileShell title="Post-Session" back hideNav>
        <PTMListSkeleton rows={5} />
      </PTMobileShell>
    );
  }
  if (sessionError || !appt) {
    return (
      <PTMobileShell title="Post-Session" back hideNav>
        <PTMError message={(sessionError as any)?.message ?? "Session not found"} onRetry={() => refetch()} />
      </PTMobileShell>
    );
  }

  const saveDraft = () =>
    actions.saveDraft.mutate(
      { doc, exercises, summary, sessionDate },
      { onSuccess: () => clearDraft() },
    );

  const runComplete = () => {
    actions.complete.mutate(
      { doc, exercises, summary, deduct: deduct && !appt.package_deducted },
      {
        onSuccess: () => {
          clearDraft();
          setReviewOpen(false);
          navigate("/admin/pt/m/today");
        },
      },
    );
  };

  return (
    <PTMobileShell
      title="Post-Session"
      back
      hideNav
      headerAccessory={<div className="px-4 pb-3"><PTMStageIndicator stage="post" /></div>}
    >
      {/* Client */}
      <PTMCard className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold text-pt-ink">{client?.name ?? "Client"}</p>
            <p className="text-[12px] text-pt-muted">
              {appt.starts_at ? format(parseISO(appt.starts_at), "EEE MMM d · h:mm a") : "—"}
              {session?.trainer?.name ? ` · ${session.trainer.name}` : ""}
            </p>
          </div>
          <PTMBadge tone={alreadyCompleted ? "green" : "gold"}>{alreadyCompleted ? "Completed" : "Awaiting sign-off"}</PTMBadge>
        </div>
      </PTMCard>

      {/* Summary */}
      <PTMSectionTitle>Session summary</PTMSectionTitle>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Metric label="Duration" value={summary.durationMinutes != null ? `${summary.durationMinutes} min` : "—"} />
        <Metric label="Completion" value={`${summary.completionPct}%`} accent />
        <Metric label="Exercises" value={`${summary.exercisesCompleted}/${summary.exercisesPlanned}`} />
        <Metric label="Sets" value={`${summary.completedSets}/${summary.totalSets}`} />
        <Metric label="Volume" value={summary.totalVolume != null ? `${summary.totalVolume.toLocaleString()} lb` : "—"} />
        <Metric label="Avg RPE" value={summary.averageRpe != null ? String(summary.averageRpe) : "—"} />
      </div>

      {summary.prs.length > 0 && (
        <PTMCard className="mb-3 border-pt-gold/60 bg-pt-gold/10">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-pt-ink">
            <Trophy className="h-4 w-4 text-pt-gold" /> {summary.prs.length} personal record{summary.prs.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-pt-muted">
            {summary.prs.map((p, i) => (
              <li key={i}>{p.exercise} — {p.weight ?? "—"} lb × {p.reps ?? "—"}</li>
            ))}
          </ul>
        </PTMCard>
      )}

      {summary.modifications.length > 0 && (
        <PTMAccordion title={`Modifications used (${summary.modifications.length})`}>
          <ul className="space-y-1 text-[13px] text-pt-ink">
            {summary.modifications.map((m, i) => <li key={i}><strong>{m.exercise}:</strong> {m.modification}</li>)}
          </ul>
        </PTMAccordion>
      )}

      {summary.painFlags.length > 0 && (
        <div className="mt-3">
          <PTMAlert tone="danger" title={`${summary.painFlags.length} pain / restriction flag${summary.painFlags.length > 1 ? "s" : ""} logged`}>
            <ul className="space-y-0.5">
              {summary.painFlags.map((p, i) => <li key={i}>{p.exercise}{p.note ? ` — ${p.note}` : ""}</li>)}
            </ul>
          </PTMAlert>
        </div>
      )}

      {/* Documentation */}
      <div className="mt-4">
        <PTMSectionTitle
          action={
            <span className="text-[11px] text-pt-muted">{dirty ? "Unsaved" : actions.saveDraft.isPending ? "Saving…" : "Saved"}</span>
          }
        >
          Trainer documentation
        </PTMSectionTitle>
      </div>
      <PTMCard>
        <Field
          label="Session summary *"
          value={doc.subjective}
          onChange={(v) => update("subjective", v)}
          placeholder="What was covered this session"
          dictate
        />
        <Field label="Client performance" value={doc.objective} onChange={(v) => update("objective", v)} dictate />
        <Field label="Trainer observations" value={doc.observations} onChange={(v) => update("observations", v)} dictate />
        <Field
          label={`Pain / restriction changes${summary.painFlags.length ? " *" : ""}`}
          value={doc.pain_discomfort}
          onChange={(v) => update("pain_discomfort", v)}
          hint={summary.painFlags.length ? "Required — pain flags were logged during this session" : undefined}
          dictate
        />
        <Field
          label="Modifications used"
          value={doc.modifications}
          onChange={(v) => update("modifications", v)}
          hint="Pre-filled from the logged workout"
          rows={2}
        />
        <div className="mb-3">
          <PTMLabel>Session RPE</PTMLabel>
          <input
            inputMode="decimal"
            value={doc.rpe}
            onChange={(e) => update("rpe", e.target.value)}
            className="mt-1 h-11 w-24 rounded-xl border border-pt-line bg-white px-3 text-[15px] text-pt-ink outline-none focus:border-pt-gold"
          />
        </div>
        <Field label="Client-facing recap" value={doc.client_recap} onChange={(v) => update("client_recap", v)} dictate />
        <Field label="Homework" value={doc.homework} onChange={(v) => update("homework", v)} rows={2} dictate />
        <Field label="Next-session focus *" value={doc.next_focus} onChange={(v) => update("next_focus", v)} rows={2} dictate />
        <Field label="Private internal note" value={doc.private_note} onChange={(v) => update("private_note", v)} rows={2} hint="Never shown to the client" />
      </PTMCard>

      {/* Actions */}
      <div className="mt-4">
        <PTMSectionTitle>Post-session actions</PTMSectionTitle>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className={ptmButtonClass("outline")} onClick={() => navigate(`/admin/pt/schedule?client=${appt.user_id}`)}>
          <CalendarPlus className="mr-2 h-4 w-4" /> Schedule next
        </button>
        <button
          className={ptmButtonClass("outline")}
          onClick={() => (doc.client_recap.trim() ? setSheet("recap") : toast.error("Write a client-facing recap first"))}
        >
          <Mail className="mr-2 h-4 w-4" /> Send recap
        </button>
        <button className={ptmButtonClass("outline")} onClick={() => setSheet("task")}>
          <ListTodo className="mr-2 h-4 w-4" /> Follow-up task
        </button>
        <button className={ptmButtonClass("outline")} onClick={() => setSheet("progress")}>
          <LineChart className="mr-2 h-4 w-4" /> Record progress
        </button>
        <button className={ptmButtonClass("outline")} onClick={() => setSheet("photo")}>
          <Camera className="mr-2 h-4 w-4" /> Progress photo
        </button>
        <button className={ptmButtonClass("outline")} onClick={() => setReviewOpen(true)}>
          <Package className="mr-2 h-4 w-4" /> Package review
        </button>
      </div>

      <div className="h-4" />

      <PTMStickyActions>
        <button className={ptmButtonClass("outline")} onClick={saveDraft} disabled={actions.saveDraft.isPending}>
          {actions.saveDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save draft
        </button>
        <button className={ptmButtonClass("gold")} onClick={() => setReviewOpen(true)} disabled={alreadyCompleted}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> {alreadyCompleted ? "Session completed" : "Complete session"}
        </button>
      </PTMStickyActions>

      {/* Completion review */}
      <PTMSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title="Review before completing"
        description="Confirm the package charge and documentation."
        footer={
          <button
            className={ptmButtonClass("gold")}
            onClick={runComplete}
            disabled={actions.complete.isPending || alreadyCompleted || missing.length > 0}
          >
            {actions.complete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Complete session
          </button>
        }
      >
        <div className="space-y-3">
          <PTMCard>
            <p className="text-[11px] uppercase tracking-[0.16em] text-pt-muted">Package being charged</p>
            {appt.package_deducted ? (
              <p className="mt-1 text-[14px] text-pt-ink">Already deducted for this session — no further charge.</p>
            ) : pass ? (
              <>
                <p className="mt-1 text-[15px] font-semibold text-pt-ink">{pass.pack_name ?? "Session package"}</p>
                <p className="text-[13px] text-pt-muted">
                  Deducting 1 session · balance {pass.sessions_remaining ?? 0} → {Math.max(0, (pass.sessions_remaining ?? 0) - (deduct ? 1 : 0))}
                </p>
                <label className="mt-2 flex items-center gap-2 text-[13px] text-pt-ink">
                  <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />
                  Deduct a session from this package
                </label>
              </>
            ) : (
              <p className="mt-1 flex items-start gap-2 text-[13px] text-pt-red">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                No active package with a remaining session. Completion will fail unless you uncheck the deduction and bill this session separately.
              </p>
            )}
            {!pass && !appt.package_deducted && (
              <label className="mt-2 flex items-center gap-2 text-[13px] text-pt-ink">
                <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />
                Deduct a session from a package
              </label>
            )}
          </PTMCard>

          {missing.length > 0 && (
            <PTMAlert tone="danger" title="Missing required documentation">
              <ul className="list-disc pl-4">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </PTMAlert>
          )}

          {unresolvedPain && (
            <PTMAlert tone="warning" title="Unresolved pain / restriction alert">
              Pain was flagged during this session and has not been documented.
            </PTMAlert>
          )}

          <PTMCard>
            <p className="text-[11px] uppercase tracking-[0.16em] text-pt-muted">Will be saved</p>
            <ul className="mt-1 space-y-0.5 text-[13px] text-pt-muted">
              <li>{summary.completedSets} logged sets across {summary.exercisesPlanned} exercises</li>
              <li>{summary.prs.length} confirmed personal record{summary.prs.length === 1 ? "" : "s"}</li>
              <li>Session marked completed with timestamp and added to visit history</li>
            </ul>
          </PTMCard>
        </div>
      </PTMSheet>

      {/* Send recap */}
      <PTMSheet
        open={sheet === "recap"}
        onOpenChange={(v) => !v && setSheet(null)}
        title="Send client recap"
        footer={
          <button
            className={ptmButtonClass("gold")}
            disabled={actions.sendRecap.isPending}
            onClick={() =>
              actions.sendRecap.mutate(
                { recap: doc.client_recap, homework: doc.homework },
                { onSuccess: () => setSheet(null) },
              )
            }
          >
            {actions.sendRecap.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Send email
          </button>
        }
      >
        <p className="mb-2 text-[13px] text-pt-muted">Sending to {client?.email ?? "client on file"}.</p>
        <PTMCard>
          <p className="whitespace-pre-wrap text-[14px] text-pt-ink">{doc.client_recap}</p>
          {doc.homework && <p className="mt-3 whitespace-pre-wrap text-[13px] text-pt-muted"><strong>Homework:</strong> {doc.homework}</p>}
        </PTMCard>
      </PTMSheet>

      {/* Follow-up task */}
      <PTMSheet
        open={sheet === "task"}
        onOpenChange={(v) => !v && setSheet(null)}
        title="Create follow-up task"
        footer={
          <button
            className={ptmButtonClass("gold")}
            disabled={!taskTitle.trim() || actions.createTask.isPending}
            onClick={() =>
              actions.createTask.mutate(
                {
                  title: taskTitle,
                  detail: taskDetail,
                  dueAt: taskDue ? new Date(taskDue).toISOString() : null,
                  instructorId: appt.instructor_id ?? null,
                },
                { onSuccess: () => { setSheet(null); setTaskTitle(""); setTaskDetail(""); setTaskDue(""); } },
              )
            }
          >
            Create task
          </button>
        }
      >
        <PTMLabel>Title</PTMLabel>
        <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
          className="mb-3 mt-1 h-11 w-full rounded-xl border border-pt-line bg-white px-3 text-[15px] outline-none focus:border-pt-gold" />
        <Field label="Detail" value={taskDetail} onChange={setTaskDetail} rows={2} />
        <PTMLabel>Due</PTMLabel>
        <input type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-pt-line bg-white px-3 text-[15px] outline-none focus:border-pt-gold" />
      </PTMSheet>

      {/* Record progress */}
      <PTMSheet
        open={sheet === "progress"}
        onOpenChange={(v) => !v && setSheet(null)}
        title="Record progress"
        footer={
          <button
            className={ptmButtonClass("gold")}
            disabled={actions.recordProgress.isPending}
            onClick={() => actions.recordProgress.mutate(metrics, { onSuccess: () => setSheet(null) })}
          >
            Save measurements
          </button>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {(["weight", "bodyFat", "waist"] as const).map((k) => (
            <div key={k}>
              <PTMLabel>{k === "weight" ? "Weight (lb)" : k === "bodyFat" ? "Body fat %" : "Waist (in)"}</PTMLabel>
              <input inputMode="decimal" value={metrics[k]} onChange={(e) => setMetrics({ ...metrics, [k]: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border border-pt-line bg-white px-3 text-[15px] outline-none focus:border-pt-gold" />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Field label="Notes" value={metrics.notes} onChange={(v) => setMetrics({ ...metrics, notes: v })} rows={2} />
        </div>
      </PTMSheet>

      {/* Progress photo */}
      <PTMSheet
        open={sheet === "photo"}
        onOpenChange={(v) => !v && setSheet(null)}
        title="Add progress photo"
        footer={
          <button
            className={ptmButtonClass("gold")}
            disabled={!photo.file || actions.addProgressPhoto.isPending}
            onClick={() =>
              photo.file &&
              actions.addProgressPhoto.mutate(
                { file: photo.file, pose: photo.pose, notes: photo.notes },
                { onSuccess: () => { setSheet(null); setPhoto({ file: null, pose: "front", notes: "" }); } },
              )
            }
          >
            {actions.addProgressPhoto.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            Upload photo
          </button>
        }
      >
        <input type="file" accept="image/*" capture="environment"
          onChange={(e) => setPhoto({ ...photo, file: e.target.files?.[0] ?? null })}
          className="mb-3 w-full text-[13px]" />
        <PTMLabel>Pose</PTMLabel>
        <select value={photo.pose} onChange={(e) => setPhoto({ ...photo, pose: e.target.value })}
          className="mb-3 mt-1 h-11 w-full rounded-xl border border-pt-line bg-white px-3 text-[15px] outline-none focus:border-pt-gold">
          {["front", "side", "back"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <Field label="Notes" value={photo.notes} onChange={(v) => setPhoto({ ...photo, notes: v })} rows={2} />
      </PTMSheet>
    </PTMobileShell>
  );
}
