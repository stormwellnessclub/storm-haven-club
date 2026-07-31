import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  Check, Mic, MicOff, Play, UserX, ArrowLeft, ClipboardList, MapPin, Clock,
  ShieldAlert, ChevronRight, Loader2,
} from "lucide-react";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import {
  PTMCard, PTMBadge, PTMLabel, PTMEmpty, PTMError, PTMListSkeleton,
  PTMStickyActions, ptmButtonClass, PTMSectionTitle,
} from "@/components/admin/pt/mobile/PTMobileUI";
import {
  PTMAvatar, PTMConfirm, PTMAlert, PTMPackageBalance, PTMStageIndicator, PTMAccordion,
} from "@/components/admin/pt/mobile/PTMobileParts";
import { usePTMNextSession, ptmListFrom } from "@/hooks/pt/usePTMNextSession";
import { usePTMPreSession, usePTMLastSession, usePTMDictation, ptmPrepItems } from "@/hooks/pt/usePTMPreSession";
import { usePTAppointmentActions } from "@/hooks/pt/usePTSchedule";
import { cn } from "@/lib/utils";

const NOTE_MAX = 500;

export default function PTMPreSession() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = usePTMNextSession(appointmentId);
  const appt = data?.appointment;
  const client = data?.client;

  const pre = usePTMPreSession(appt?.id, appt);
  const { data: lastNote } = usePTMLastSession(client?.userId, appt?.id);
  const dictation = usePTMDictation((t) =>
    pre.onNoteChange(`${pre.note ? `${pre.note} ` : ""}${t}`.slice(0, NOTE_MAX)),
  );
  const actions = usePTAppointmentActions();

  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [starting, setStarting] = useState(false);

  const restrictions = useMemo(() => ptmListFrom(data?.profile?.restrictions), [data]);
  const injuries = useMemo(() => ptmListFrom(data?.profile?.injuries), [data]);
  const hasRestrictions = restrictions.length > 0 || injuries.length > 0 || !!lastNote?.pain_discomfort;
  const identityRequired = !!data?.profile?.identity_verification_required || (data?.overdueForms?.length ?? 0) > 0;

  const items = useMemo(
    () => ptmPrepItems({ identityRequired, hasRestrictions }),
    [identityRequired, hasRestrictions],
  );
  const missingRequired = items.filter((i) => i.required && !pre.checklist[i.key]?.done);

  if (isLoading) {
    return <PTMobileShell title="Pre-Session" back><PTMListSkeleton rows={4} /></PTMobileShell>;
  }
  if (error) {
    return (
      <PTMobileShell title="Pre-Session" back>
        <PTMError message={(error as any)?.message} onRetry={() => refetch()} />
      </PTMobileShell>
    );
  }
  if (!appt || !client) {
    return (
      <PTMobileShell title="Pre-Session" back>
        <PTMEmpty title="Session not found" description="This appointment is no longer available." />
      </PTMobileShell>
    );
  }

  const start = parseISO(appt.starts_at);
  const duration = appt.duration_minutes ?? data?.sessionType?.duration_minutes ?? 60;
  const pass = data?.pass;
  const expDays = pass?.expires_at ? differenceInCalendarDays(parseISO(pass.expires_at), new Date()) : null;
  const willDeduct = !!pass && !appt.package_deducted;

  const doStart = async () => {
    setStarting(true);
    pre.flush();
    const ok = await actions.startSession(appt.id);
    setStarting(false);
    if (ok) navigate(`/admin/pt/m/session/${appt.id}/live`);
  };

  return (
    <PTMobileShell
      title="Pre-Session"
      back
      onBack={() => { pre.flush(); navigate(`/admin/pt/m/session/${appt.id}`); }}
      headerAccessory={
        <div className="px-4 pb-3">
          <PTMStageIndicator stage="pre" />
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        {/* Client summary */}
        <PTMCard className="bg-white p-4">
          <div className="flex items-center gap-3">
            <PTMAvatar name={client.name} src={client.photoUrl} size={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold text-pt-ink">{client.name}</p>
              <p className="truncate text-[13px] text-pt-muted">
                {data?.sessionType?.name ?? String(appt.format ?? "").replace(/_/g, " ") ?? "Session"}
              </p>
            </div>
            <PTMBadge tone={appt.confirmation_status === "confirmed" ? "green" : "amber"}>
              {appt.confirmation_status === "confirmed" ? "Confirmed" : "Unconfirmed"}
            </PTMBadge>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-pt-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />{format(start, "h:mm a")} · {duration} min
            </span>
            {data?.location?.name && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /><span className="truncate">{data.location.name}</span>
              </span>
            )}
          </div>
          {hasRestrictions && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-pt-red/8 px-3 py-2 text-[12px] text-pt-red">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {[...injuries, ...restrictions].slice(0, 3).join(" · ")}
                {lastNote?.pain_discomfort ? ` · ${lastNote.pain_discomfort}` : ""}
              </span>
            </div>
          )}
        </PTMCard>

        {/* Package balance */}
        {pass ? (
          <div>
            <PTMPackageBalance
              label={pass.pack_name ?? "Package"}
              used={Math.max((pass.sessions_total ?? 0) - (pass.sessions_remaining ?? 0), 0)}
              total={pass.sessions_total ?? 0}
            />
            {expDays != null && expDays <= 14 && (
              <p className="mt-1.5 px-1 text-[12px] text-pt-amber">
                Expires {format(parseISO(pass.expires_at!), "MMM d")} ({expDays <= 0 ? "expired" : `${expDays} days`})
              </p>
            )}
          </div>
        ) : (
          <PTMAlert tone="warning" title="No active package" description="This session is not covered by a package." />
        )}

        {/* Preparation checklist */}
        <div>
          <PTMSectionTitle
            action={
              <span className="text-[12px] text-pt-muted">
                {items.filter((i) => pre.checklist[i.key]?.done).length}/{items.length}
              </span>
            }
          >
            Preparation checklist
          </PTMSectionTitle>
          <div className="overflow-hidden rounded-2xl border border-pt-line bg-white">
            {items.map((item, i) => {
              const state = pre.checklist[item.key];
              const done = !!state?.done;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => pre.toggleItem(item.key)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-pt-beige",
                    i > 0 && "border-t border-pt-line",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                      done ? "border-pt-gold bg-pt-gold text-pt-noir" : "border-pt-line bg-pt-cream",
                    )}
                  >
                    {done && <Check className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("text-[14px] text-pt-ink", done && "text-pt-muted line-through")}>
                        {item.label}
                      </span>
                      {item.required && !done && <PTMBadge tone="amber">Required</PTMBadge>}
                    </span>
                    {item.hint && !done && <span className="block text-[12px] text-pt-muted">{item.hint}</span>}
                    {done && state?.at && (
                      <span className="block text-[11px] text-pt-muted">
                        {format(new Date(state.at), "h:mm a")}
                        {state.byName ? ` · ${state.byName}` : ""}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Last session summary */}
        <PTMAccordion
          title="Last session"
          meta={lastNote?.session_date ? format(parseISO(lastNote.session_date), "MMM d, yyyy") : "None on file"}
        >
          {!lastNote ? (
            <p className="text-[13px] text-pt-muted">No previous session notes for this client.</p>
          ) : (
            <div className="space-y-2.5 text-[13px] text-pt-ink">
              {lastNote.next_focus && <p><span className="text-pt-muted">Focus areas · </span>{lastNote.next_focus}</p>}
              {ptmListFrom(lastNote.exercise_log).length > 0 && (
                <p><span className="text-pt-muted">Key exercises · </span>{ptmListFrom(lastNote.exercise_log).slice(0, 6).join(", ")}</p>
              )}
              {(lastNote.observations || lastNote.objective) && (
                <p><span className="text-pt-muted">Observations · </span>{lastNote.observations || lastNote.objective}</p>
              )}
              {lastNote.rpe != null && <p><span className="text-pt-muted">RPE · </span>{lastNote.rpe}/10</p>}
              {(lastNote.pain_discomfort || lastNote.modifications) && (
                <p className="text-pt-red">
                  <span className="text-pt-muted">Flags · </span>
                  {[lastNote.pain_discomfort, lastNote.modifications].filter(Boolean).join(" · ")}
                </p>
              )}
              {lastNote.homework && <p><span className="text-pt-muted">Homework · </span>{lastNote.homework}</p>}
              {lastNote.next_focus && <p><span className="text-pt-muted">Planned next focus · </span>{lastNote.next_focus}</p>}
            </div>
          )}
        </PTMAccordion>

        {/* Pre-session note */}
        <PTMCard className="bg-white p-4">
          <div className="flex items-center justify-between">
            <PTMLabel>Pre-session note</PTMLabel>
            <span className="text-[11px] text-pt-muted">
              {pre.saving ? "Saving…" : pre.dirty ? "Unsaved" : pre.savedAt ? `Saved ${format(new Date(pre.savedAt), "h:mm a")}` : "Autosaves"}
            </span>
          </div>
          <textarea
            value={pre.note}
            onChange={(e) => pre.onNoteChange(e.target.value.slice(0, NOTE_MAX))}
            onBlur={pre.flush}
            rows={4}
            placeholder="Anything to remember going into this session…"
            className="mt-2 w-full resize-none rounded-xl border border-pt-line bg-pt-cream px-3 py-2.5 text-[15px] text-pt-ink outline-none focus:border-pt-gold"
          />
          <div className="mt-2 flex items-center justify-between">
            {dictation.supported ? (
              <button
                type="button"
                onClick={dictation.toggle}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold",
                  dictation.listening ? "bg-pt-red/12 text-pt-red" : "bg-pt-beige text-pt-muted",
                )}
              >
                {dictation.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {dictation.listening ? "Stop dictation" : "Dictate"}
              </button>
            ) : <span />}
            <span className="text-[11px] text-pt-muted">
              {pre.note.length}/{NOTE_MAX} · keep it short and factual
            </span>
          </div>
        </PTMCard>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            className={ptmButtonClass("outline")}
            onClick={() => { pre.flush(); navigate(`/admin/pt/m/session/${appt.id}`); }}
          >
            <ArrowLeft className="h-4 w-4" /> Appointment
          </button>
          <button
            className={ptmButtonClass("outline")}
            onClick={() => { pre.flush(); navigate(`/admin/pt/clients/${client.userId}?tab=programs`); }}
          >
            <ClipboardList className="h-4 w-4" /> Edit plan
          </button>
        </div>
        <button className={cn(ptmButtonClass("outline"), "text-pt-red")} onClick={() => setConfirmNoShow(true)}>
          <UserX className="h-4 w-4" /> Mark as no show
        </button>

        {missingRequired.length > 0 && (
          <PTMAlert
            tone="warning"
            title={`${missingRequired.length} required step${missingRequired.length === 1 ? "" : "s"} outstanding`}
            description={missingRequired.map((i) => i.label).join(" · ")}
          />
        )}
      </div>

      <PTMStickyActions>
        <button
          className={ptmButtonClass("gold")}
          disabled={starting}
          onClick={() => (missingRequired.length > 0 ? setConfirmStart(true) : doStart())}
        >
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Start session
          <ChevronRight className="h-4 w-4" />
        </button>
      </PTMStickyActions>

      <PTMConfirm
        open={confirmStart}
        onOpenChange={setConfirmStart}
        title="Skip required preparation steps?"
        description={`Not yet completed: ${missingRequired.map((i) => i.label).join(", ")}. You can still start, but these safety steps will be recorded as skipped.`}
        confirmLabel="Start anyway"
        onConfirm={() => { setConfirmStart(false); doStart(); }}
      />

      <PTMConfirm
        open={confirmNoShow}
        onOpenChange={setConfirmNoShow}
        title="Mark as no show?"
        destructive
        description={
          willDeduct
            ? "Per the no-show policy this session will be charged and one session will be deducted from the client's package."
            : pass
              ? "The package credit for this session has already been deducted and will not be restored."
              : "There is no active package — no credit will be deducted. Any balance owed must be handled from the payments screen."
        }
        confirmLabel="Mark no show"
        onConfirm={async () => {
          setConfirmNoShow(false);
          const ok = await actions.markNoShow(appt.id);
          if (ok) navigate("/admin/pt/m");
        }}
      />
    </PTMobileShell>
  );
}
