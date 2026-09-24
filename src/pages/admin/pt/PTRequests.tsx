import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format as fmt } from "date-fns";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { PTShell, PTPageHeader, PTCard, PTBadge, PTEmptyState, ptButtonClass, PTAlert } from "@/components/admin/pt/PTUI";
import { usePTTrainers } from "@/hooks/pt/usePTPortal";
import { usePTRequests, usePTSessionTypes, usePTRequestContext, usePTRequestActions, REQUEST_STATUS_LABEL } from "@/hooks/pt/usePTRequests";
import { PTClientPicker } from "@/components/admin/pt/PTClientPicker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPEN = ["requested", "under_review", "alternate_offered"];
const FILTERS = ["open", "requested", "under_review", "alternate_offered", "confirmed", "declined", "cancelled", "all"] as const;

function tone(s: string) {
  return s === "confirmed" ? "green" : s === "declined" || s === "cancelled" ? "red" : s === "alternate_offered" ? "amber" : "gold";
}
function fmtTime(t?: string | null) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function fmtDate(d?: string | null) {
  return d ? fmt(new Date(`${d}T12:00:00`), "EEE, MMM d") : "—";
}

export default function PTRequests() {
  const { data: requests = [], isLoading } = usePTRequests();
  const { data: trainers = [] } = usePTTrainers();
  const { data: types = [] } = usePTSessionTypes();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const trainerName = (id?: string | null) => trainers.find((t: any) => t.id === id)?.name ?? (id ? "Trainer" : "Any trainer");
  const typeName = (r: any) => types.find((t) => t.id === r.pt_session_type_id)?.name ?? r.service;

  const openQueue = useMemo(() => requests.filter((r) => OPEN.includes(r.request_status)), [requests]);
  const rows = useMemo(() => requests.filter((r) =>
    filter === "all" ? true : filter === "open" ? OPEN.includes(r.request_status) : r.request_status === filter), [requests, filter]);
  const selected = requests.find((r) => r.id === selectedId) ?? null;

  return (
    <PTShell>
      <PTPageHeader title="Requests" subtitle="Client training requests, oldest first. Queue position is visible to staff only." />
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={ptButtonClass(filter === f ? "primary" : "outline")}>
            {f === "open" ? `Open (${openQueue.length})` : f === "all" ? "All" : REQUEST_STATUS_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <PTCard className="p-0 overflow-x-auto">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> : rows.length === 0 ? (
            <PTEmptyState icon={Inbox} title="No requests" description="Nothing matches this filter." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{["#", "Client", "Submitted", "Trainer", "Session", "Preferred", "Status"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pos = openQueue.findIndex((q) => q.id === r.id);
                  return (
                    <tr key={r.id} onClick={() => setSelectedId(r.id)}
                      className={`cursor-pointer border-t border-border hover:bg-muted/40 ${selectedId === r.id ? "bg-muted/60" : ""}`}>
                      <td className="px-3 py-2 text-muted-foreground">{pos >= 0 ? pos + 1 : "—"}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.full_name || r.email}</div>
                        <PTBadge tone={r.is_member ? "gold" : "neutral"}>{r.is_member ? "Member" : "Non-member"}</PTBadge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmt(new Date(r.created_at), "MMM d, h:mm a")}</td>
                      <td className="px-3 py-2">{trainerName(r.requested_trainer_id)}</td>
                      <td className="px-3 py-2">{typeName(r)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.preferred_date ? `${fmtDate(r.preferred_date)} · ${fmtTime(r.preferred_time)}` : (r.preferred_times || "—")}
                        {r.flexibility_note && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{r.flexibility_note}</div>}
                      </td>
                      <td className="px-3 py-2"><PTBadge tone={tone(r.request_status) as any}>{REQUEST_STATUS_LABEL[r.request_status]}</PTBadge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </PTCard>
        {selected ? <RequestDetail key={selected.id} r={selected} trainers={trainers} types={types} trainerName={trainerName} typeName={typeName} />
          : <PTCard><p className="text-sm text-muted-foreground">Select a request to review it.</p></PTCard>}
      </div>
    </PTShell>
  );
}

function RequestDetail({ r, trainers, types, trainerName, typeName }: any) {
  const { update, confirm } = usePTRequestActions();
  const ctx = usePTRequestContext(r.client_user_id);
  const open = OPEN.includes(r.request_status);
  const [trainerId, setTrainerId] = useState<string>(r.requested_trainer_id ?? "");
  const [typeId, setTypeId] = useState<string>(r.pt_session_type_id ?? "");
  const [date, setDate] = useState<string>(r.preferred_date ?? "");
  const [time, setTime] = useState<string>(r.preferred_time?.slice(0, 5) ?? "");
  const [mode, setMode] = useState<null | "alt" | "decline" | "cancel">(null);
  const [altDate, setAltDate] = useState(""); const [altTime, setAltTime] = useState(""); const [altTrainer, setAltTrainer] = useState(r.requested_trainer_id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (p: Promise<any>, ok: string) => {
    setError(null);
    try { const res = await p; toast.success(res?.already_confirmed ? "Already confirmed — no new appointment created" : ok); setMode(null); setNote(""); }
    catch (e: any) { setError(e.message); }
  };
  const busy = update.isPending || confirm.isPending;
  const dirty = trainerId !== (r.requested_trainer_id ?? "") || typeId !== (r.pt_session_type_id ?? "") ||
    date !== (r.preferred_date ?? "") || time !== (r.preferred_time?.slice(0, 5) ?? "");

  return (
    <PTCard className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{r.full_name || r.email}</h3>
          <p className="text-xs text-muted-foreground">{r.email} · {r.phone}</p>
        </div>
        <PTBadge tone={tone(r.request_status) as any}>{REQUEST_STATUS_LABEL[r.request_status]}</PTBadge>
      </div>

      {!r.client_user_id && open && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Link to the client's Storm account before confirming:</p>
          <PTClientPicker onChange={(c) => c && run(update.mutateAsync({ id: r.id, action: "details", clientUserId: c.id }), "Client linked")} />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Session type</dt><dd>{typeName(r)}</dd>
        <dt className="text-muted-foreground">Requested trainer</dt><dd>{trainerName(r.requested_trainer_id)}</dd>
        <dt className="text-muted-foreground">Preferred</dt><dd>{r.preferred_date ? `${fmtDate(r.preferred_date)} · ${fmtTime(r.preferred_time)}` : r.preferred_times || "—"}</dd>
        <dt className="text-muted-foreground">Flexibility</dt><dd>{r.flexibility_note || "—"}</dd>
        <dt className="text-muted-foreground">Client message</dt><dd className="whitespace-pre-wrap">{r.client_note || r.goals || "—"}</dd>
        {r.alt_date && <><dt className="text-muted-foreground">Alternate offered</dt><dd>{fmtDate(r.alt_date)} · {fmtTime(r.alt_time)} · {trainerName(r.alt_trainer_id)}{r.alt_note ? ` — ${r.alt_note}` : ""}</dd></>}
        {r.decline_reason && <><dt className="text-muted-foreground">Internal reason</dt><dd>{r.decline_reason}</dd></>}
      </dl>

      {r.client_user_id && (
        <div className="rounded-md border border-border p-3 text-sm space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Training context (read only)</div>
          {ctx.data?.passes.length ? ctx.data.passes.map((p: any) => (
            <div key={p.id}>{p.format.replace(/_/g, " ")} package · {p.sessions_remaining} sessions left · expires {fmtDate(p.expires_at)}</div>
          )) : <div>No active package — confirming books an unpaid session.</div>}
          {!!ctx.data?.failed.length && <div className="text-destructive">{ctx.data.failed.length} failed/past-due payment(s) on file.</div>}
          <Link className="text-xs underline" to={`/admin/pt/clients/${r.client_user_id}/billing`}>Open billing</Link>
        </div>
      )}

      {r.appointment_id && (
        <Link className={ptButtonClass("outline")} to={`/admin/pt/schedule`}>View in PT schedule</Link>
      )}

      {error && <PTAlert tone="red">{error}</PTAlert>}

      {open && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="Session type" /></SelectTrigger>
              <SelectContent>{types.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.duration_minutes}m)</SelectItem>)}</SelectContent>
            </Select>
            <Select value={trainerId} onValueChange={setTrainerId}>
              <SelectTrigger><SelectValue placeholder="Trainer" /></SelectTrigger>
              <SelectContent>{trainers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          {dirty && (
            <button disabled={busy} className={ptButtonClass("outline")} onClick={() => run(update.mutateAsync({
              id: r.id, action: "details", trainerId: trainerId || null, sessionTypeId: typeId || null, date: date || null, time: time || null,
            }), "Request updated")}>Save changes</button>
          )}
          <div className="flex flex-wrap gap-2">
            {r.request_status === "requested" && (
              <button disabled={busy} className={ptButtonClass("ghost")} onClick={() => run(update.mutateAsync({ id: r.id, action: "review" }), "Marked under review")}>Mark under review</button>
            )}
            <button disabled={busy || dirty} className={ptButtonClass("gold")} onClick={() => run(confirm.mutateAsync({ id: r.id, useAlternate: false }), "Confirmed — appointment created")}>Confirm requested time</button>
            {r.request_status === "alternate_offered" && (
              <button disabled={busy} className={ptButtonClass("gold")} onClick={() => run(confirm.mutateAsync({ id: r.id, useAlternate: true }), "Client accepted — appointment created")}>Client accepted alternate</button>
            )}
            <button disabled={busy} className={ptButtonClass("outline")} onClick={() => setMode("alt")}>Offer alternate</button>
            <button disabled={busy} className={ptButtonClass("danger")} onClick={() => setMode("decline")}>Decline</button>
            <button disabled={busy} className={ptButtonClass("ghost")} onClick={() => setMode("cancel")}>Cancel request</button>
          </div>
          {mode === "alt" && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={altDate} onChange={(e) => setAltDate(e.target.value)} />
                <Input type="time" value={altTime} onChange={(e) => setAltTime(e.target.value)} />
              </div>
              <Select value={altTrainer} onValueChange={setAltTrainer}>
                <SelectTrigger><SelectValue placeholder="Trainer" /></SelectTrigger>
                <SelectContent>{trainers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
              <button disabled={busy || !altDate || !altTime} className={ptButtonClass("primary")} onClick={() => run(update.mutateAsync({
                id: r.id, action: "offer_alternate", date: altDate, time: altTime, trainerId: altTrainer || null, reason: note || undefined,
              }), "Alternate recorded")}>Save alternate</button>
            </div>
          )}
          {(mode === "decline" || mode === "cancel") && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Textarea placeholder={mode === "decline" ? "Internal reason (required)" : "Reason (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />
              <button disabled={busy || (mode === "decline" && !note.trim())} className={ptButtonClass("danger")}
                onClick={() => run(update.mutateAsync({ id: r.id, action: mode, reason: note }), mode === "decline" ? "Request declined" : "Request cancelled")}>
                {mode === "decline" ? "Decline request" : "Cancel request"}
              </button>
            </div>
          )}
        </>
      )}

      <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border pt-2">
        <div>Submitted {fmt(new Date(r.created_at), "MMM d, yyyy h:mm a")}</div>
        {r.reviewed_at && <div>Reviewed {fmt(new Date(r.reviewed_at), "MMM d h:mm a")}</div>}
        {r.offered_at && <div>Alternate offered {fmt(new Date(r.offered_at), "MMM d h:mm a")}</div>}
        {r.resolved_at && <div>{REQUEST_STATUS_LABEL[r.request_status]} {fmt(new Date(r.resolved_at), "MMM d h:mm a")}</div>}
      </div>
    </PTCard>
  );
}
