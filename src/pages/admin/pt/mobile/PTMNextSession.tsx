import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, differenceInMinutes, parseISO, differenceInCalendarDays } from "date-fns";
import {
  MessageSquare, Phone, User, CalendarClock, MoreHorizontal, XCircle,
  ChevronRight, MapPin, Clock, ShieldAlert,
} from "lucide-react";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import {
  PTMCard, PTMBadge, PTMLabel, PTMEmpty, PTMError, PTMListSkeleton,
  PTMStickyActions, ptmButtonClass,
} from "@/components/admin/pt/mobile/PTMobileUI";
import {
  PTMAvatar, PTMSheet, PTMConfirm, PTMAlert, PTMPackageBalance,
} from "@/components/admin/pt/mobile/PTMobileParts";
import { usePTMNextSession, ptmListFrom } from "@/hooks/pt/usePTMNextSession";
import { usePTAppointmentActions } from "@/hooks/pt/usePTSchedule";
import { usePTMobileAccess } from "@/hooks/pt/usePTMobileAccess";

function countdown(startsAt: string) {
  const mins = differenceInMinutes(parseISO(startsAt), new Date());
  if (mins <= 0 && mins > -180) return "Starting now";
  if (mins < 0) return "Past";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `in ${h}h ${mins % 60}m`;
  const d = Math.floor(h / 24);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

export default function PTMNextSession() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const access = usePTMobileAccess();
  const { data, isLoading, error, refetch } = usePTMNextSession(appointmentId);
  const actions = usePTAppointmentActions();

  const [moreOpen, setMoreOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "cancel" | "reschedule">(null);

  const appt = data?.appointment;
  const client = data?.client;

  const important = useMemo(() => {
    if (!data) return [] as { tone: "info" | "warning" | "danger"; text: string }[];
    const out: { tone: "info" | "warning" | "danger"; text: string }[] = [];
    ptmListFrom(data.profile?.restrictions).forEach((r) => out.push({ tone: "warning", text: `Restriction · ${r}` }));
    ptmListFrom(data.profile?.injuries).forEach((i) => out.push({ tone: "danger", text: `Injury · ${i}` }));
    if (data.lastNote?.pain_discomfort) out.push({ tone: "danger", text: `Discomfort · ${data.lastNote.pain_discomfort}` });
    if (data.lastNote?.modifications) out.push({ tone: "warning", text: `Limitation · ${data.lastNote.modifications}` });
    if (data.lastNote?.next_focus) out.push({ tone: "info", text: `Focus · ${data.lastNote.next_focus}` });
    if (data.lastNote?.session_date)
      out.push({ tone: "info", text: `Last session · ${format(parseISO(data.lastNote.session_date), "MMM d, yyyy")}` });
    data.overdueForms.forEach((f) =>
      out.push({ tone: "warning", text: `Form outstanding · ${f.title || f.doc_type}` }));
    if (data.reassessmentDue) {
      const days = differenceInCalendarDays(parseISO(data.reassessmentDue), new Date());
      out.push({
        tone: days <= 0 ? "danger" : days <= 14 ? "warning" : "info",
        text: `Reassessment ${days <= 0 ? "overdue" : `due ${format(parseISO(data.reassessmentDue), "MMM d")}`}`,
      });
    }
    data.alerts.filter((a) => a.severity === "high" || a.severity === "critical")
      .forEach((a) => out.push({ tone: "danger", text: a.message }));
    return out;
  }, [data]);

  if (isLoading) {
    return (
      <PTMobileShell title="Next Session" back>
        <PTMListSkeleton rows={4} />
      </PTMobileShell>
    );
  }

  if (error) {
    return (
      <PTMobileShell title="Next Session" back>
        <PTMError message={(error as any)?.message} onRetry={() => refetch()} />
      </PTMobileShell>
    );
  }

  if (!appt || !client) {
    return (
      <PTMobileShell title="Next Session" back>
        <PTMEmpty
          title="No upcoming session"
          description="Once a session is booked it will appear here with everything you need to prepare."
        />
      </PTMobileShell>
    );
  }

  const start = parseISO(appt.starts_at);
  const duration = appt.duration_minutes ?? data?.sessionType?.duration_minutes ?? 60;
  const confirmed = appt.confirmation_status === "confirmed";
  const pass = data?.pass;
  const expDays = pass?.expires_at ? differenceInCalendarDays(parseISO(pass.expires_at), new Date()) : null;
  const lowPackage = (pass?.sessions_remaining ?? 99) <= 2;
  const expiringSoon = expDays != null && expDays <= 14;

  return (
    <PTMobileShell title="Next Session" back>
      <div className="space-y-4">
        {/* Hero */}
        <PTMCard className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <PTMLabel>{format(start, "EEEE, MMM d")}</PTMLabel>
              <p className="mt-1 text-[34px] font-semibold leading-none text-pt-ink">{format(start, "h:mm")}</p>
              <p className="text-[13px] font-semibold uppercase tracking-widest text-pt-muted">
                {format(start, "a")} · {duration} min
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <PTMBadge tone="gold">{countdown(appt.starts_at)}</PTMBadge>
              <PTMBadge tone={confirmed ? "green" : "amber"}>{confirmed ? "Confirmed" : "Unconfirmed"}</PTMBadge>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-pt-line pt-4">
            <PTMAvatar name={client.name} src={client.photoUrl} size={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold text-pt-ink">{client.name}</p>
              <p className="truncate text-[13px] text-pt-muted">
                {data?.sessionType?.name ?? String(appt.format ?? "").replace(/_/g, " ")}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-[13px] text-pt-muted">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{data?.location?.name ?? "Location TBD"}</span>
            </p>
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{data?.trainer?.name ?? "Trainer unassigned"}</span>
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{format(start, "h:mm a")} – {format(new Date(start.getTime() + duration * 60000), "h:mm a")}</span>
            </p>
          </div>
        </PTMCard>

        {/* Package */}
        <div>
          <PTMLabel className="mb-2 px-1">Package</PTMLabel>
          {pass ? (
            <div className="space-y-2">
              <PTMPackageBalance
                label={pass.pack_name ?? "Training package"}
                used={Math.max((pass.sessions_total ?? 0) - (pass.sessions_remaining ?? 0), 0)}
                total={pass.sessions_total ?? 0}
              />
              <p className="px-1 text-[12px] text-pt-muted">
                {pass.expires_at ? `Expires ${format(parseISO(pass.expires_at), "MMM d, yyyy")}` : "No expiration"}
              </p>
              {(lowPackage || expiringSoon) && (
                <PTMAlert tone="warning" title={lowPackage ? "Package running low" : "Package expiring soon"}>
                  {lowPackage
                    ? `${pass.sessions_remaining ?? 0} session${pass.sessions_remaining === 1 ? "" : "s"} remaining — discuss renewal.`
                    : `Expires in ${expDays} day${expDays === 1 ? "" : "s"}.`}
                </PTMAlert>
              )}
            </div>
          ) : (
            <PTMAlert tone="warning" title="No active package">
              This session is not covered by a package. Confirm payment before starting.
            </PTMAlert>
          )}
        </div>

        {/* Important to know */}
        <div>
          <PTMLabel className="mb-2 px-1">Important to know</PTMLabel>
          {important.length === 0 ? (
            <PTMCard className="p-4">
              <p className="text-[13px] text-pt-muted">No restrictions or outstanding items on file.</p>
            </PTMCard>
          ) : (
            <PTMCard className="divide-y divide-pt-line">
              {important.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                  <ShieldAlert
                    className={
                      "mt-0.5 h-4 w-4 shrink-0 " +
                      (item.tone === "danger" ? "text-pt-red" : item.tone === "warning" ? "text-pt-amber" : "text-pt-muted")
                    }
                  />
                  <p className="min-w-0 flex-1 break-words text-[13px] text-pt-ink">{item.text}</p>
                </div>
              ))}
            </PTMCard>
          )}
        </div>

        {/* Secondary actions */}
        <PTMCard className="divide-y divide-pt-line">
          {access.canMessageClients && (
            <button
              onClick={() => navigate(`/admin/pt/messages?client=${client.userId}`)}
              className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left"
            >
              <MessageSquare className="h-5 w-5 text-pt-ink" />
              <span className="flex-1 text-[15px] text-pt-ink">Message client</span>
              <ChevronRight className="h-4 w-4 text-pt-muted" />
            </button>
          )}
          {client.phone && (
            <a href={`tel:${client.phone}`} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left">
              <Phone className="h-5 w-5 text-pt-ink" />
              <span className="flex-1 text-[15px] text-pt-ink">Call {client.phone}</span>
              <ChevronRight className="h-4 w-4 text-pt-muted" />
            </a>
          )}
          <button
            onClick={() => navigate(`/admin/pt/clients/${client.userId}`)}
            className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left"
          >
            <User className="h-5 w-5 text-pt-ink" />
            <span className="flex-1 text-[15px] text-pt-ink">View client</span>
            <ChevronRight className="h-4 w-4 text-pt-muted" />
          </button>
        </PTMCard>
      </div>

      {/* Sticky primary actions */}
      <PTMStickyActions>
        <div className="flex gap-2">
          <button
            className={ptmButtonClass("gold")}
            onClick={() => navigate(`/admin/pt/m/session/${appt.id}/pre`)}
          >
            Open Session
          </button>
          <button
            aria-label="More actions"
            className={ptmButtonClass("outline") + " !w-[56px] shrink-0 px-0"}
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </PTMStickyActions>

      {/* More menu */}
      <PTMSheet open={moreOpen} onOpenChange={setMoreOpen} title="Session options">
        <div className="divide-y divide-pt-line overflow-hidden rounded-2xl border border-pt-line">
          {access.canManageSessions && (
            <button
              onClick={() => { setMoreOpen(false); setConfirm("reschedule"); }}
              className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left"
            >
              <CalendarClock className="h-5 w-5 text-pt-ink" />
              <span className="flex-1 text-[15px] text-pt-ink">Reschedule</span>
            </button>
          )}
          {access.canManageSessions && (
            <button
              onClick={() => { setMoreOpen(false); setConfirm("cancel"); }}
              className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left"
            >
              <XCircle className="h-5 w-5 text-pt-red" />
              <span className="flex-1 text-[15px] text-pt-red">Cancel appointment</span>
            </button>
          )}
          {!access.canManageSessions && (
            <p className="px-4 py-6 text-center text-sm text-pt-muted">
              Your role can view this session but not change it.
            </p>
          )}
        </div>
      </PTMSheet>

      <PTMConfirm
        open={confirm === "cancel"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Cancel this session?"
        description="The client is notified and any package credit used for this session is restored."
        confirmLabel="Cancel session"
        destructive
        onConfirm={() => {
          setConfirm(null);
          actions.cancel.mutate({ id: appt.id, reason: "Cancelled from mobile" });
        }}
      />

      <PTMConfirm
        open={confirm === "reschedule"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Reschedule this session?"
        description="You'll pick a new time on the schedule. The client's package is unaffected until the change is saved."
        confirmLabel="Continue"
        onConfirm={() => {
          setConfirm(null);
          navigate(`/admin/pt/schedule?appointment=${appt.id}&action=reschedule`);
        }}
      />
    </PTMobileShell>
  );
}
