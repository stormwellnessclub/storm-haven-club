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
  usePTAppointmentActions, usePTClientPasses, usePTLookupMaps,
} from "@/hooks/pt/usePTSchedule";
import { toast } from "sonner";

export function PTAppointmentDrawer({
  appointment, open, onOpenChange,
}: {
  appointment: PTScheduleAppointment | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const a = appointment;
  const actions = usePTAppointmentActions();
  const { data: trainers = [] } = usePTTrainers();
  const { locationMap, sessionTypeMap, locations } = usePTLookupMaps();
  const { data: people = {} } = usePTPeople(a ? [a.user_id] : []);
  const { data: passes = [] } = usePTClientPasses(a?.user_id);

  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [pendingConflict, setPendingConflict] = useState<{ payload: any; summary: string } | null>(null);

  useEffect(() => {
    if (!a) return;
    setNote(a.notes ?? "");
    setInternalNote(a.internal_notes ?? "");
    setRescheduleAt(fmtDate(parseISO(a.starts_at), "yyyy-MM-dd'T'HH:mm"));
    setCancelReason("");
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
    const payload = { id: a.id, startsAt: new Date(rescheduleAt).toISOString(), force };
    const res = await actions.reschedule.mutateAsync(payload);
    if (!res?.success) {
      const t = res?.conflict?.trainer_conflicts?.length ?? 0;
      const r = res?.conflict?.room_conflicts?.length ?? 0;
      setPendingConflict({
        payload,
        summary: `${t ? `${t} trainer conflict${t > 1 ? "s" : ""}` : ""}${t && r ? " and " : ""}${r ? `${r} room conflict${r > 1 ? "s" : ""}` : ""} at that time.`,
      });
    }
  }

  async function changeTrainer(instructorId: string) {
    if (!a) return;
    const value = instructorId === "unassigned" ? null : instructorId;
    const payload = { id: a.id, instructorId: value };
    const res = await actions.reschedule.mutateAsync(payload);
    if (!res?.success) {
      const t = res?.conflict?.trainer_conflicts?.length ?? 0;
      setPendingConflict({ payload, summary: `That trainer already has ${t} session${t > 1 ? "s" : ""} at this time.` });
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
                <PTBadge tone={person?.isMember ? "gold" : "neutral"}>{person?.isMember ? "Member" : "Non-member"}</PTBadge>
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
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  className={ptButtonClass("outline")}
                  disabled={!!a.package_deducted}
                  onClick={() => actions.setPackageDeducted(a.id, true)}
                >
                  Deduct credit
                </button>
                <button
                  className={ptButtonClass("outline")}
                  disabled={!a.package_deducted}
                  onClick={() => actions.setPackageDeducted(a.id, false)}
                >
                  Restore credit
                </button>
              </div>
            </section>

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

              <Separator className="bg-pt-line" />

              <div className="pt-eyebrow flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5" /> Trainer</div>
              <Select value={a.instructor_id ?? "unassigned"} onValueChange={changeTrainer}>
                <SelectTrigger className="h-9 bg-white border-pt-line"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="pt-eyebrow flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location</div>
              <Select value={a.location_id ?? "none"} onValueChange={changeLocation}>
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

            <button
              className={`${ptButtonClass("danger")} w-full`}
              disabled={lifecycle === "cancelled"}
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

      <PTConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this appointment?"
        description="The client is emailed and any deducted package credit is restored."
        confirmLabel="Cancel session"
        destructive
        onConfirm={() => {
          actions.cancel.mutate({ id: a.id, reason: cancelReason || null });
          setConfirmCancel(false);
        }}
      >
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
        description="No-shows keep the package credit consumed. You can restore the credit manually afterwards."
        confirmLabel="Mark no-show"
        destructive
        onConfirm={() => { setConfirmNoShow(false); actions.markNoShow(a.id); }}
      />

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
