import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format as fmtDate, parseISO } from "date-fns";
import {
  ArrowUpRight, CalendarClock, CheckCircle2, Mail, MapPin, Package, Play, StickyNote,
  Trash2, UserCog, UserX, XCircle,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PTBadge, PTConfirmDialog, ptButtonClass } from "@/components/admin/pt/PTUI";
import { PT_FORMAT_LABEL, formatCents } from "@/lib/ptFormat";
import { usePTPeople, usePTTrainers } from "@/hooks/pt/usePTPortal";
import {
  PTScheduleAppointment, PT_LIFECYCLE_LABEL, PT_LIFECYCLE_STYLE, ptLifecycle,
  usePTAppointmentActions, usePTAppointmentHistory, usePTClientPasses, usePTLookupMaps,
} from "@/hooks/pt/usePTSchedule";
import { useUserRoles } from "@/hooks/useUserRoles";

type CancelOutcome =
  | "timely_client_cancel" | "late_client_cancel" | "staff_cancel" | "facility_cancel"
  | "admin_override_credit" | "admin_override_consume";

const CANCEL_OUTCOMES: { value: CancelOutcome; label: string; hint: string; manager?: boolean }[] = [
  { value: "timely_client_cancel", label: "Client cancelled in time", hint: "Package credit is returned." },
  { value: "late_client_cancel", label: "Client late cancel", hint: "Session is charged per the late-cancel policy." },
  { value: "staff_cancel", label: "Trainer / staff cancelled", hint: "Client keeps their session." },
  { value: "facility_cancel", label: "Facility cancelled", hint: "Client keeps their session." },
  { value: "admin_override_credit", label: "Admin override — return credit", hint: "Manager only. Reason required.", manager: true },
  { value: "admin_override_consume", label: "Admin override — charge session", hint: "Manager only. Reason required.", manager: true },
];

const HISTORY_FIELDS: Record<string, string> = {
  checked_in_at: "Checked in", started_at: "Session started", completed_at: "Completed",
  instructor_id: "Trainer changed", starts_at: "Rescheduled", location_id: "Room changed",
  cancelled_at: "Cancelled", no_show_at: "Marked no-show", cancel_overridden_at: "Administrative override",
  payment_status: "Payment status changed", package_deducted: "Package credit changed", confirmed_at: "Confirmed",
};
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PTSessionCheckoutDialog } from "@/components/admin/pt/PTSessionCheckoutDialog";

export function PTAppointmentDrawer({
  appointment, open, onOpenChange,
}: {
  appointment: PTScheduleAppointment | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const a = appointment;
  const actions = usePTAppointmentActions();
  const { data: trainers = [] } = usePTTrainers();
  const { locationMap, sessionTypeMap, locations } = usePTLookupMaps();
  const { data: people = {} } = usePTPeople(a ? [a.user_id] : []);
  const { data: passes = [] } = usePTClientPasses(a?.user_id);
  const { data: history } = usePTAppointmentHistory(open ? a?.id : undefined);
  const { hasRole, isAdmin } = useUserRoles();
  const isManager = isAdmin() || hasRole("manager" as any);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancelOutcome, setCancelOutcome] = useState<CancelOutcome>("staff_cancel");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideAction, setOverrideAction] = useState<"restore_credit" | "consume_credit" | "waive_charge" | null>(null);

  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [pendingConflict, setPendingConflict] = useState<{ payload: any; summary: string } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!a) return;
    setNote(a.notes ?? "");
    setInternalNote(a.internal_notes ?? "");
    setRescheduleAt(fmtDate(parseISO(a.starts_at), "yyyy-MM-dd'T'HH:mm"));
    setCancelReason("");
    setRescheduleReason("");
    setCancelOutcome("staff_cancel");
    setOverrideReason("");
  }, [a?.id]);

  const person = a ? people[a.user_id] : undefined;
  const lifecycle = a ? ptLifecycle(a) : "scheduled";
  const activePass = useMemo(
    () => passes.find((p: any) => p.status === "active" && p.sessions_remaining > 0) ?? passes[0],
    [passes],
  );

  if (!a) return null;

  const sessionType = a.session_type_id ? sessionTypeMap[a.session_type_id] : undefined;
  const location = a.location_id ? locationMap[a.location_id] : undefined;
  const terminal = lifecycle === "cancelled" || lifecycle === "completed" || lifecycle === "no_show";

  async function submitReschedule(force = false) {
    if (!a || !rescheduleAt) return;
    const payload = { id: a.id, startsAt: new Date(rescheduleAt).toISOString(), force, reason: rescheduleReason || null };
    const res = await actions.reschedule.mutateAsync(payload);
    if (!res?.success) {
      setPendingConflict({ payload, summary: conflictSummary(res?.conflict) });
    }
  }

  async function changeTrainer(instructorId: string) {
    if (!a) return;
    const value = instructorId === "unassigned" ? null : instructorId;
    const payload = value ? { id: a.id, instructorId: value } : { id: a.id, clearInstructor: true };
    const res = await actions.reschedule.mutateAsync(payload);
    if (!res?.success) {
      setPendingConflict({ payload, summary: conflictSummary(res?.conflict) });
    }
  }

  async function changeLocation(locationId: string) {
    if (!a) return;
    const payload = { id: a.id, locationId: locationId === "none" ? null : locationId };
    const res = await actions.reschedule.mutateAsync(payload);
    if (!res?.success) {
      const r = res?.conflict?.room_conflicts?.length ?? 0;
      setPendingConflict({ payload, summary: `That room is already booked for ${r} session${r > 1 ? "s" : ""} at this time.` });
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto bg-pt-cream p-0">
          <div className="bg-pt-noir text-pt-cream p-5">
            <SheetHeader className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <PTBadge tone={PT_LIFECYCLE_STYLE[lifecycle].badge}>{PT_LIFECYCLE_LABEL[lifecycle]}</PTBadge>
                {a.is_waitlist && <PTBadge tone="neutral">Waitlist #{a.waitlist_position ?? 1}</PTBadge>}
                {a.package_deducted && <PTBadge tone="gold">Credit used</PTBadge>}
              </div>
              <SheetTitle className="pt-serif text-2xl text-pt-cream">
                {person?.name ?? "Client"}
              </SheetTitle>
              <SheetDescription className="text-pt-cream/70">
                {fmtDate(parseISO(a.starts_at), "EEEE, MMMM d · h:mm a")} – {fmtDate(parseISO(a.ends_at), "h:mm a")}
                {" · "}{a.duration_minutes} min
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="p-5 space-y-5">
            {/* Client summary */}
            <section className="rounded-xl border border-pt-line bg-white p-4">
              <div className="pt-eyebrow mb-2">Client</div>
              <div className="text-sm text-pt-ink">{person?.name ?? "—"}</div>
              <div className="text-xs text-pt-muted">{person?.email ?? "—"}{person?.phone ? ` · ${person.phone}` : ""}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <PTBadge tone={person?.isMember ? "gold" : "neutral"}>{person?.relationship ?? (person?.isMember ? "Member" : "Non-member")}</PTBadge>
                <PTBadge>{sessionType?.name ?? PT_FORMAT_LABEL[a.format]}</PTBadge>
                {sessionType && <PTBadge>Capacity {sessionType.capacity}</PTBadge>}
                {location && <PTBadge><MapPin className="h-3 w-3" />{location.name}</PTBadge>}
              </div>
              <button
                className={`${ptButtonClass("outline")} mt-3 w-full`}
                onClick={() => { onOpenChange(false); navigate(`/admin/pt/clients/${a.user_id}`); }}
              >
                Open full client profile <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </section>

            {/* Package balance */}
            <section className="rounded-xl border border-pt-line bg-white p-4">
              <div className="pt-eyebrow mb-2 flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Package balance</div>
              {activePass ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-pt-ink truncate">{activePass.pack_name}</div>
                    <div className="text-xs text-pt-muted">
                      Expires {fmtDate(new Date(`${activePass.expires_at}T12:00:00`), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="pt-serif text-2xl text-pt-gold shrink-0">
                    {activePass.sessions_remaining}/{activePass.sessions_total}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-pt-muted">No active package.
                  {a.payment_status === "unpaid" && a.amount_due_cents
                    ? ` ${formatCents(a.amount_due_cents)} due for this session.`
                    : ""}
                </div>
              )}
              <Separator className="bg-pt-line my-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-pt-muted">This session</span>
                <span className="text-pt-ink">
                  {a.package_deducted ? "Paid by package credit" : (a as any).reservation_state === "reserved" ? "Credit reserved" : (a.payment_status ?? "—").replace(/_/g, " ")}
                </span>
              </div>
              {(a as any).cancel_outcome_reason && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-pt-muted">Outcome</span>
                  <span className="text-pt-ink">{String((a as any).cancel_outcome_reason).replace(/_/g, " ")} · {String((a as any).cancel_credit_outcome ?? "").replace(/_/g, " ")}</span>
                </div>
              )}
              {(a.payment_status === "unpaid" || a.payment_status === "past_due") && !a.package_deducted
                && lifecycle !== "cancelled" && (
                <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <div className="text-xs font-semibold text-destructive">
                    UNPAID SESSION{(a.amount_due_cents ?? 0) > 0 ? ` · ${formatCents(a.amount_due_cents ?? 0)} due` : ""}
                  </div>
                  <button
                    className={`${ptButtonClass("primary")} mt-2 w-full`}
                    onClick={() => setCheckoutOpen(true)}
                  >
                    Pay for this session — charge card, record payment or use a credit
                  </button>
                  <button
                    className="mt-2 w-full text-center text-[11px] text-pt-muted underline"
                    onClick={() => { onOpenChange(false); navigate(`/admin/pt/clients/${a.user_id}/billing`); }}
                  >
                    Open full PT billing
                  </button>
                </div>
              )}
              {(a as any).cancel_override_reason && (
                <div className="text-[11px] text-pt-muted mt-2">Override: {(a as any).cancel_override_reason}</div>
              )}
            </section>

            {isManager && (
              <section className="rounded-xl border border-pt-line bg-white p-4 space-y-2">
                <div className="pt-eyebrow">Administrative override</div>
                <div className="text-[11px] text-pt-muted">Managers only. Recorded on the package ledger with your name.</div>
                <div className="grid grid-cols-3 gap-2">
                  <button className={ptButtonClass("outline")} disabled={!a.package_deducted && (a as any).reservation_state !== "reserved"} onClick={() => setOverrideAction("restore_credit")}>Return credit</button>
                  <button className={ptButtonClass("outline")} disabled={!!a.package_deducted} onClick={() => setOverrideAction("consume_credit")}>Charge credit</button>
                  <button className={ptButtonClass("outline")} disabled={!(a.payment_status === "unpaid" || a.payment_status === "past_due")} onClick={() => setOverrideAction("waive_charge")}>Waive charge</button>
                </div>
              </section>
            )}

            {/* Session lifecycle */}
            <section className="rounded-xl border border-pt-line bg-white p-4">
              <div className="pt-eyebrow mb-3">Session actions</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={ptButtonClass("outline")}
                  disabled={terminal || !!a.checked_in_at}
                  onClick={() => actions.checkIn(a.id)}
                >
                  <CheckCircle2 className="h-4 w-4" /> {a.checked_in_at ? "Checked in" : "Check in"}
                </button>
                <button
                  className={ptButtonClass("outline")}
                  disabled={terminal || !!a.started_at}
                  onClick={() => actions.startSession(a.id)}
                >
                  <Play className="h-4 w-4" /> {a.started_at ? "Started" : "Start session"}
                </button>
                <button
                  className={ptButtonClass("primary")}
                  disabled={terminal}
                  onClick={() => setConfirmComplete(true)}
                >
                  Complete session
                </button>
                <button
                  className={ptButtonClass("outline")}
                  disabled={terminal}
                  onClick={() => setConfirmNoShow(true)}
                >
                  <UserX className="h-4 w-4" /> Mark no-show
                </button>
                <button
                  className={ptButtonClass("outline")}
                  disabled={a.confirmation_status === "confirmed"}
                  onClick={() => actions.confirm(a.id)}
                >
                  Mark confirmed
                </button>
                <button
                  className={ptButtonClass("outline")}
                  onClick={() => actions.sendConfirmation.mutate(a.id)}
                  disabled={actions.sendConfirmation.isPending}
                >
                  <Mail className="h-4 w-4" /> Send confirmation
                </button>
              </div>
              {a.confirmation_email_sent_at && (
                <div className="text-[11px] text-pt-muted mt-2">
                  Last confirmation sent {fmtDate(parseISO(a.confirmation_email_sent_at), "MMM d, h:mm a")}
                </div>
              )}
            </section>

            {/* Reschedule & trainer */}
            <section className="rounded-xl border border-pt-line bg-white p-4 space-y-3">
              <div className="pt-eyebrow flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Reschedule</div>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={rescheduleAt}
                  onChange={(e) => setRescheduleAt(e.target.value)}
                  className="h-9 bg-white border-pt-line"
                />
                <button
                  className={ptButtonClass("outline")}
                  disabled={terminal || actions.reschedule.isPending}
                  onClick={() => submitReschedule(false)}
                >
                  Move
                </button>
              </div>
              <Input
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Reason for the change (optional)"
                className="h-9 bg-white border-pt-line"
              />

              <Separator className="bg-pt-line" />

              <div className="pt-eyebrow flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5" /> Trainer</div>
              <Select value={a.instructor_id ?? "unassigned"} onValueChange={changeTrainer} disabled={terminal}>
                <SelectTrigger className="h-9 bg-white border-pt-line"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="pt-eyebrow flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location</div>
              <Select value={a.location_id ?? "none"} onValueChange={changeLocation} disabled={terminal}>
                <SelectTrigger className="h-9 bg-white border-pt-line"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No location</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </section>

            {/* Notes */}
            <section className="rounded-xl border border-pt-line bg-white p-4 space-y-3">
              <div className="pt-eyebrow flex items-center gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Notes</div>
              <label htmlFor="pt-appt-note" className="sr-only">Client-facing note</label>
              <Textarea
                id="pt-appt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Client-facing note"
                className="bg-white border-pt-line min-h-[70px]"
              />
              <label htmlFor="pt-appt-internal-note" className="sr-only">Internal staff note (not visible to the client)</label>
              <Textarea
                id="pt-appt-internal-note"
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Internal staff note — never shown to the client"
                className="bg-white border-pt-line min-h-[70px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <button className={ptButtonClass("outline")} onClick={() => actions.addNote(a.id, note, false)}>Save note</button>
                <button className={ptButtonClass("outline")} onClick={() => actions.addNote(a.id, internalNote, true)}>Save internal</button>
              </div>
            </section>

            {/* History */}
            <section className="rounded-xl border border-pt-line bg-white p-4">
              <div className="pt-eyebrow mb-2">Activity</div>
              <ol className="space-y-1.5">
                {buildHistory(history, trainers).map((h, i) => (
                  <li key={i} className="flex justify-between gap-3 text-xs">
                    <span className="text-pt-ink">{h.label}</span>
                    <span className="text-pt-muted shrink-0">{fmtDate(parseISO(h.at), "MMM d, h:mm a")}</span>
                  </li>
                ))}
                {!history && <li className="text-xs text-pt-muted">Loading…</li>}
              </ol>
            </section>

            <button
              className={`${ptButtonClass("danger")} w-full`}
              disabled={terminal}
              onClick={() => setConfirmCancel(true)}
            >
              <XCircle className="h-4 w-4" /> Cancel appointment
            </button>
            {a.cancel_reason && (
              <div className="text-xs text-pt-muted -mt-3">Cancelled: {a.cancel_reason}</div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {checkoutOpen && (
        <PTSessionCheckoutDialog
          sessions={[{
            id: a.id, user_id: a.user_id, starts_at: a.starts_at, instructor_id: a.instructor_id,
            format: a.format, status: a.status, payment_status: a.payment_status ?? "unpaid",
            amount_due_cents: a.amount_due_cents ?? 0, pass_id: (a as any).pass_id ?? null,
            session_type_id: a.session_type_id ?? null, package_deducted: a.package_deducted ?? false,
          }]}
          clientName={person?.name ?? "Client"}
          onClose={() => {
            setCheckoutOpen(false);
            qc.invalidateQueries({ queryKey: ["pt-appointments"] });
            qc.invalidateQueries({ queryKey: ["pt-passes"] });
            qc.invalidateQueries({ queryKey: ["pt-pass-balances"] });
            onOpenChange(false);
          }}
        />
      )}

      <PTConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this appointment?"
        description={CANCEL_OUTCOMES.find((o) => o.value === cancelOutcome)?.hint ?? ""}
        confirmLabel="Cancel session"
        destructive
        onConfirm={() => {
          const isOverride = cancelOutcome.startsWith("admin_override");
          if (isOverride && !overrideReason.trim()) { toast.error("An override reason is required"); return; }
          actions.cancel.mutate({
            id: a.id, reason: cancelReason || null, outcome: cancelOutcome,
            overrideReason: isOverride ? overrideReason.trim() : null,
          });
          setConfirmCancel(false);
        }}
      >
        <Select value={cancelOutcome} onValueChange={(v) => setCancelOutcome(v as CancelOutcome)}>
          <SelectTrigger className="bg-white border-pt-line"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CANCEL_OUTCOMES.filter((o) => !o.manager || isManager).map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cancelOutcome.startsWith("admin_override") && (
          <Input
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Override reason (required)"
            className="bg-white border-pt-line"
          />
        )}
        <Input
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Reason (optional)"
          className="bg-white border-pt-line"
        />
      </PTConfirmDialog>

      <PTConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Complete this session?"
        description={
          a.package_deducted
            ? "A package credit was already used for this session, so no further credit will be deducted."
            : activePass
              ? `This will mark the session complete and deduct 1 credit from ${activePass.pack_name}.`
              : "This client has no active package, so no credit will be deducted."
        }
        confirmLabel="Complete session"
        onConfirm={async () => {
          setConfirmComplete(false);
          await actions.completeSession(a.id, !a.package_deducted && !!activePass);
        }}
      />

      <PTConfirmDialog
        open={confirmNoShow}
        onOpenChange={setConfirmNoShow}
        title="Mark this client as a no-show?"
        description="No-shows are charged per policy (package credit used, or the session stays unpaid). A manager can override afterwards."
        confirmLabel="Mark no-show"
        destructive
        onConfirm={() => { setConfirmNoShow(false); actions.markNoShow(a.id); }}
      />

      <PTConfirmDialog
        open={!!overrideAction}
        onOpenChange={(v) => { if (!v) { setOverrideAction(null); setOverrideReason(""); } }}
        title={overrideAction === "restore_credit" ? "Return this session's credit?" : overrideAction === "consume_credit" ? "Charge a package credit for this session?" : "Waive this session's charge?"}
        description="Recorded with your name. A note is optional."
        confirmLabel="Apply"
        onConfirm={async () => {
          if (!overrideAction) return;
          await actions.override.mutateAsync({ id: a.id, action: overrideAction, reason: overrideReason.trim() }).catch(() => {});
          setOverrideAction(null); setOverrideReason("");
        }}
      >
        <Input
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Note (optional)"
          className="bg-white border-pt-line"
        />
      </PTConfirmDialog>

      <PTConfirmDialog
        open={!!pendingConflict}
        onOpenChange={(v) => !v && setPendingConflict(null)}
        title="Scheduling conflict"
        description={`${pendingConflict?.summary ?? ""} Book anyway?`}
        confirmLabel="Book anyway"
        destructive
        onConfirm={async () => {
          if (!pendingConflict) return;
          const res = await actions.reschedule.mutateAsync({ ...pendingConflict.payload, force: true });
          if (res?.success) toast.success("Saved with a conflict override");
          setPendingConflict(null);
        }}
      />
    </>
  );
}

function conflictSummary(c: any): string {
  const t = c?.trainer_conflicts?.length ?? 0;
  const r = c?.room_conflicts?.length ?? 0;
  const k = c?.client_conflicts?.length ?? 0;
  const parts = [
    t ? `${t} trainer conflict${t > 1 ? "s" : ""}` : "",
    r ? `${r} room conflict${r > 1 ? "s" : ""}` : "",
    k ? `the client already has ${k} session${k > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return `${parts.join(", ") || "A conflict"} at that time.`;
}

function buildHistory(
  h: { audit: any[]; usage: any[] } | undefined,
  trainers: { id: string; name: string }[],
): { label: string; at: string }[] {
  if (!h) return [];
  const tname = (id?: string | null) => (id ? trainers.find((t) => t.id === id)?.name ?? "trainer" : "unassigned");
  const out: { label: string; at: string }[] = [];
  h.audit.forEach((row) => {
    if (row.action === "insert") { out.push({ label: "Booked", at: row.created_at }); return; }
    const b = row.before_data ?? {}; const f = row.after_data ?? {};
    (row.changed_fields ?? []).forEach((k: string) => {
      if (!HISTORY_FIELDS[k] || (!f[k] && k !== "instructor_id" && k !== "package_deducted")) return;
      if (k === "package_deducted") return; // shown from the ledger below
      let label = HISTORY_FIELDS[k];
      if (k === "instructor_id") label = `Trainer: ${tname(b[k])} → ${tname(f[k])}`;
      if (k === "starts_at") label = `Rescheduled from ${fmtDate(parseISO(b[k]), "MMM d, h:mm a")}${f.reschedule_note ? ` — ${f.reschedule_note}` : ""}`;
      if (k === "cancelled_at" && f.cancel_outcome_reason) label = `Cancelled · ${String(f.cancel_outcome_reason).replace(/_/g, " ")}`;
      if (k === "payment_status") label = `Payment: ${String(f[k]).replace(/_/g, " ")}`;
      if (k === "cancel_overridden_at" && f.cancel_override_reason) label = `Override · ${f.cancel_override_reason}`;
      out.push({ label, at: row.created_at });
    });
  });
  h.usage.forEach((u) => {
    out.push({
      label: `Package ${u.quantity < 0 ? "credit used" : "credit returned"}${u.reason ? ` — ${u.reason}` : ""}`,
      at: u.created_at,
    });
  });
  return out.sort((x, y) => x.at.localeCompare(y.at));
}
