import { useEffect, useMemo, useRef, useState } from "react";
import { format as fmtDate } from "date-fns";
import { AlertTriangle, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PTModal, PTAlert, PTBadge, PTEmptyState, ptButtonClass } from "@/components/admin/pt/PTPrimitives";
import { PTClientPicker, PTClientOption } from "@/components/admin/pt/PTClientPicker";
import { PT_FORMAT_LABEL, PT_FORMATS, PtFormat, formatCents } from "@/lib/ptFormat";
import { usePTPacks, PTPassRow } from "@/hooks/pt/usePTPackages";
import {
  usePTFinancialMutations, usePTEligiblePastAppointments, usePTPassHistory, ptEventLabel,
} from "@/hooks/pt/usePTFinancials";

const FINANCIAL_STATUS = [
  { value: "paid_in_full", label: "Already paid in full" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "payment_plan", label: "Active payment plan" },
  { value: "outstanding", label: "Outstanding balance" },
  { value: "legacy", label: "Historical / legacy purchase" },
  { value: "complimentary", label: "Complimentary" },
  { value: "other", label: "Other authorized status" },
];

const SOURCE_SYSTEMS = ["Mindbody", "Previous Storm system", "Spreadsheet / manual record", "Other"];

const toDollars = (v: string) => Math.round((Number(v) || 0) * 100);

/* ============================================================
   ADD EXISTING ACTIVE PACKAGE  /  TRANSFER EXISTING PACKAGE
   ============================================================ */

export function AddExistingPackageDialog({
  open, onOpenChange, mode, presetUser,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "existing" | "transfer";
  presetUser?: { id: string; label: string };
}) {
  const isTransfer = mode === "transfer";
  const { data: packs = [] } = usePTPacks();
  const { addExistingPackage } = usePTFinancialMutations();
  const keyRef = useRef<string | null>(null);

  const [client, setClient] = useState<PTClientOption | null>(null);
  const [packId, setPackId] = useState<string>("custom");
  const [customName, setCustomName] = useState("");
  const [format, setFormat] = useState<PtFormat>("one_on_one");
  const [original, setOriginal] = useState("20");
  const [used, setUsed] = useState("0");
  const [remaining, setRemaining] = useState("20");
  const [activatedAt, setActivatedAt] = useState(fmtDate(new Date(), "yyyy-MM-dd"));
  const [expiresAt, setExpiresAt] = useState("");
  const [financialStatus, setFinancialStatus] = useState(isTransfer ? "legacy" : "paid_in_full");
  const [packageValue, setPackageValue] = useState("");
  const [paid, setPaid] = useState("");
  const [outstanding, setOutstanding] = useState("");
  const [newRevenue, setNewRevenue] = useState("0");
  const [originalPurchaseDate, setOriginalPurchaseDate] = useState("");
  const [sourceSystem, setSourceSystem] = useState(isTransfer ? "Mindbody" : "");
  const [sourceReference, setSourceReference] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const userId = presetUser?.id ?? client?.id;
  const pack = packs.find((p: any) => p.id === packId);

  useEffect(() => {
    if (!open) return;
    keyRef.current = crypto.randomUUID();
  }, [open]);

  useEffect(() => {
    if (!pack) return;
    setFormat(pack.format as PtFormat);
    setOriginal(String(pack.sessions));
    setRemaining(String(Math.max(0, pack.sessions - (Number(used) || 0))));
  }, [packId]); // eslint-disable-line react-hooks/exhaustive-deps

  const nOriginal = Number(original) || 0;
  const nUsed = Number(used) || 0;
  const nRemaining = Number(remaining) || 0;
  const mathOk = nOriginal > 0 && nOriginal === nUsed + nRemaining;

  const packageName = pack?.name ?? customName.trim();
  const canSubmit = !!userId && !!packageName && mathOk && !!expiresAt && !!activatedAt;

  async function submit() {
    if (!userId || !keyRef.current) return;
    await addExistingPackage.mutateAsync({
      idempotencyKey: keyRef.current,
      userId,
      packId: pack?.id ?? null,
      packName: packageName,
      format,
      sessionsOriginal: nOriginal,
      sessionsUsed: nUsed,
      sessionsRemaining: nRemaining,
      activatedAt,
      expiresAt,
      sourceType: isTransfer ? "transfer" : "existing",
      financialStatus,
      packageValueCents: toDollars(packageValue),
      paidCents: toDollars(paid),
      outstandingCents: toDollars(outstanding),
      newRevenueCents: toDollars(newRevenue),
      originalPurchaseDate: originalPurchaseDate || null,
      sourceSystem: sourceSystem || null,
      sourceReference: sourceReference || null,
      notes: notes || null,
      internalNotes: internalNotes || null,
    });
    onOpenChange(false);
  }

  return (
    <PTModal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isTransfer ? "Transfer existing PT package / sessions" : "Add existing active package"}
      description={
        isTransfer
          ? "Bring a package in from another system. This is not a new sale."
          : "Record a current client's real package. This is not automatically a new sale."
      }
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={() => onOpenChange(false)}>Cancel</button>
          <button
            className={ptButtonClass("primary")}
            disabled={!canSubmit || addExistingPackage.isPending}
            onClick={submit}
          >
            {isTransfer ? "Transfer package in" : "Record package"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Client</FieldLabel>
          {presetUser ? (
            <div className="rounded-lg border border-pt-line bg-pt-cream/40 px-3 py-2 text-sm">{presetUser.label}</div>
          ) : (
            <PTClientPicker value={client?.id} label={client ? `${client.name} · ${client.email}` : undefined} onChange={setClient} />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Package</FieldLabel>
            <Select value={packId} onValueChange={setPackId}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom / historical package</SelectItem>
                {packs.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} · {p.sessions} sessions</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel>Format</FieldLabel>
            <Select value={format} onValueChange={(v) => setFormat(v as PtFormat)}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PT_FORMATS.map((f) => <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {packId === "custom" && (
          <div>
            <FieldLabel>Package name</FieldLabel>
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. 20 Session Legacy Package" className="border-pt-line bg-white" />
          </div>
        )}

        <div className="rounded-xl border border-pt-line p-3 space-y-3">
          <div className="text-[13px] font-medium text-pt-ink">Existing usage</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumField label="Original sessions purchased" value={original} onChange={setOriginal} />
            <NumField label="Sessions already completed" value={used} onChange={setUsed} />
            <NumField label="Sessions remaining" value={remaining} onChange={setRemaining} />
          </div>
          {!mathOk ? (
            <PTAlert tone="warning" title="Session counts do not reconcile">
              Original ({nOriginal}) must equal already used ({nUsed}) + remaining ({nRemaining}).
            </PTAlert>
          ) : (
            <div className="text-xs text-pt-muted">
              {nOriginal} original = {nUsed} used + {nRemaining} remaining. The {nUsed} completed session(s) are
              recorded in the package ledger as historical usage.
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Activation / start date</FieldLabel>
            <Input type="date" value={activatedAt} onChange={(e) => setActivatedAt(e.target.value)} className="border-pt-line bg-white" />
          </div>
          <div>
            <FieldLabel>{isTransfer ? "New expiration" : "Expiration"}</FieldLabel>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="border-pt-line bg-white" />
          </div>
        </div>

        <div className="rounded-xl border border-pt-line p-3 space-y-3">
          <div className="text-[13px] font-medium text-pt-ink">Existing financial position</div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <Select value={financialStatus} onValueChange={setFinancialStatus}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FINANCIAL_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MoneyField label="Original package value" value={packageValue} onChange={setPackageValue} />
            <MoneyField label="Amount previously paid" value={paid} onChange={setPaid} />
            <MoneyField label="Amount currently outstanding" value={outstanding} onChange={setOutstanding} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyField label="New Storm revenue collected NOW" value={newRevenue} onChange={setNewRevenue} />
            <div>
              <FieldLabel>Original purchase date</FieldLabel>
              <Input type="date" value={originalPurchaseDate} onChange={(e) => setOriginalPurchaseDate(e.target.value)} className="border-pt-line bg-white" />
            </div>
          </div>
          <PTAlert tone="info" title="Historical value is not new revenue">
            Historical package value and previously collected money stay separate from Storm revenue recorded today.
            New revenue defaults to $0 for transfers and existing packages.
          </PTAlert>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Source system</FieldLabel>
            <Select value={sourceSystem || "none"} onValueChange={(v) => setSourceSystem(v === "none" ? "" : v)}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {SOURCE_SYSTEMS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel>Source / reference</FieldLabel>
            <Input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="Invoice, contract or record id" className="border-pt-line bg-white" />
          </div>
        </div>

        <div>
          <FieldLabel>Internal note (staff only)</FieldLabel>
          <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="border-pt-line bg-white" />
        </div>
        <div>
          <FieldLabel>Package note</FieldLabel>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="border-pt-line bg-white" />
        </div>
      </div>
    </PTModal>
  );
}

/* ============================================================
   APPLY PAST COMPLETED APPOINTMENTS
   ============================================================ */

export function ApplyPastSessionsDialog({
  pass, clientName, onClose,
}: {
  pass: PTPassRow | null;
  clientName: string;
  onClose: () => void;
}) {
  const { data: appts = [], isLoading } = usePTEligiblePastAppointments(pass?.user_id);
  const { applyPastAppointments } = usePTFinancialMutations();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("Historical session reconciliation");

  useEffect(() => { setSelected([]); }, [pass?.id]);

  const eligible = appts.filter((a) => !a.already_applied);
  const after = Math.max(0, (pass?.sessions_remaining ?? 0) - selected.length);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <PTModal
      open={!!pass}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Apply past sessions to this package"
      description={pass ? `${clientName} · ${pass.pack_name}` : ""}
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={onClose}>Cancel</button>
          <button
            className={ptButtonClass("primary")}
            disabled={selected.length === 0 || applyPastAppointments.isPending}
            onClick={async () => {
              await applyPastAppointments.mutateAsync({ passId: pass!.id, appointmentIds: selected, reason });
              onClose();
            }}
          >
            Apply {selected.length || ""} session{selected.length === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-pt-line bg-pt-cream/40 px-3 py-2 text-sm">
          <div><strong>{pass?.pack_name}</strong> · current balance <strong>{pass?.sessions_remaining ?? 0}</strong></div>
          <div>Completed appointments selected: <strong>{selected.length}</strong></div>
          <div>Result: <strong>{after} remaining</strong></div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-pt-muted">Loading appointments…</div>
        ) : appts.length === 0 ? (
          <PTEmptyState icon={History} title="No completed appointments" description="This client has no completed PT appointments yet." />
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-pt-line divide-y divide-pt-line/60">
            {appts.map((a) => (
              <label
                key={a.id}
                className={`flex items-center gap-3 px-3 py-2 text-[13px] ${a.already_applied ? "opacity-55" : "cursor-pointer hover:bg-pt-beige/40"}`}
              >
                <input
                  type="checkbox"
                  disabled={a.already_applied}
                  checked={selected.includes(a.id)}
                  onChange={() => toggle(a.id)}
                  className="h-4 w-4 accent-[hsl(var(--pt-gold,45_60%_50%))]"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-pt-ink">
                    {fmtDate(new Date(a.starts_at), "EEE MMM d, yyyy · h:mm a")}
                  </span>
                  <span className="block text-xs text-pt-muted">
                    {PT_FORMAT_LABEL[a.format as PtFormat] ?? a.format} · {a.status} · {a.payment_status}
                    {a.amount_due_cents ? ` · ${formatCents(a.amount_due_cents)} due` : ""}
                  </span>
                </span>
                {a.already_applied
                  ? <PTBadge tone="neutral">Already applied</PTBadge>
                  : <PTBadge tone="gold">Not applied</PTBadge>}
              </label>
            ))}
          </div>
        )}

        {eligible.length === 0 && appts.length > 0 && (
          <PTAlert tone="info" title="Everything is already reconciled">
            Every completed appointment for this client already has a package session applied.
          </PTAlert>
        )}

        <div>
          <FieldLabel>Reason (recorded on every ledger entry)</FieldLabel>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} className="border-pt-line bg-white" />
        </div>

        <div className="flex items-start gap-2 text-xs text-pt-muted">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Appointments are never re-created or re-completed. Each appointment can only ever consume one package session.
        </div>
      </div>
    </PTModal>
  );
}

/* ============================================================
   HISTORICAL SESSION WITHOUT AN APPOINTMENT
   ============================================================ */

export function RecordHistoricalSessionDialog({
  pass, clientName, onClose,
}: {
  pass: PTPassRow | null;
  clientName: string;
  onClose: () => void;
}) {
  const { recordHistoricalSession } = usePTFinancialMutations();
  const [date, setDate] = useState(fmtDate(new Date(), "yyyy-MM-dd"));
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => { setReason(""); setNote(""); setQuantity("1"); }, [pass?.id]);

  const qty = Number(quantity) || 0;

  return (
    <PTModal
      open={!!pass}
      onOpenChange={(v) => !v && onClose()}
      title="Record a historical PT session"
      description={pass ? `${clientName} · ${pass.pack_name}` : ""}
      size="sm"
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={onClose}>Cancel</button>
          <button
            className={ptButtonClass("primary")}
            disabled={!reason.trim() || qty <= 0 || recordHistoricalSession.isPending}
            onClick={async () => {
              await recordHistoricalSession.mutateAsync({
                passId: pass!.id, sessionDate: date, quantity: qty, reason: reason.trim(), note: note || null,
              });
              onClose();
            }}
          >
            Record session
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <PTAlert tone="warning" title="Only when there is no appointment">
          Use this when a session genuinely happened but no PT appointment exists. It never creates a fake appointment.
        </PTAlert>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Session date</FieldLabel>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-pt-line bg-white" />
          </div>
          <NumField label="Quantity" value={quantity} onChange={setQuantity} />
        </div>
        <div>
          <FieldLabel>Source / reason (required)</FieldLabel>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Mindbody export, trainer paper log" className="border-pt-line bg-white" />
        </div>
        <div>
          <FieldLabel>Internal note</FieldLabel>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="border-pt-line bg-white" />
        </div>
        <div className="rounded-lg border border-pt-line bg-pt-cream/40 px-3 py-2 text-sm">
          Balance {pass?.sessions_remaining ?? 0} → <strong>{Math.max(0, (pass?.sessions_remaining ?? 0) - qty)}</strong>
        </div>
      </div>
    </PTModal>
  );
}

/* ============================================================
   PACKAGE HISTORY
   ============================================================ */

export function PackageHistoryModal({
  pass, clientName, onClose,
}: {
  pass: PTPassRow | null;
  clientName: string;
  onClose: () => void;
}) {
  const { data: history = [], isLoading } = usePTPassHistory(pass?.id);
  const [technical, setTechnical] = useState(false);

  const rows = useMemo(() => history.slice().sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  ), [history]);

  return (
    <PTModal
      open={!!pass}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Package history"
      description={pass ? `${clientName} · ${pass.pack_name} · ${pass.sessions_remaining}/${pass.sessions_total} remaining` : ""}
      footer={<button className={ptButtonClass("outline")} onClick={onClose}>Close</button>}
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-pt-muted">
          <input type="checkbox" checked={technical} onChange={(e) => setTechnical(e.target.checked)} className="h-3.5 w-3.5" />
          Technical audit mode (show raw event names and record source)
        </label>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-pt-muted">Loading history…</div>
        ) : rows.length === 0 ? (
          <PTEmptyState icon={History} title="No history yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-pt-line">
            <table className="w-full text-[13px]">
              <thead className="bg-pt-beige/50 text-pt-muted">
                <tr>
                  <Th>Date &amp; time</Th>
                  <Th>Event</Th>
                  <Th align="right">Before</Th>
                  <Th align="right">Change</Th>
                  <Th align="right">After</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h, i) => (
                  <tr key={`${h.occurred_at}-${i}`} className="border-t border-pt-line/60">
                    <Td>{fmtDate(new Date(h.occurred_at), "MMM d, yyyy h:mm a")}</Td>
                    <Td>
                      <PTBadge tone={h.delta >= 0 ? "green" : "amber"}>
                        {technical ? `${h.source}:${h.event_type}` : ptEventLabel(h.event_type)}
                      </PTBadge>
                      {h.appointment_id && <span className="ml-2 text-xs text-pt-muted">linked appointment</span>}
                    </Td>
                    <Td align="right">{h.sessions_before ?? "—"}</Td>
                    <Td align="right">{h.delta > 0 ? `+${h.delta}` : h.delta}</Td>
                    <Td align="right">{h.sessions_after ?? "—"}</Td>
                    <Td>{h.reason || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PTModal>
  );
}

/* ------------------------------------------------------------------ atoms */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs text-pt-muted">{children}</label>;
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} className="border-pt-line bg-white" />
    </div>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input type="number" min={0} step="0.01" placeholder="0.00" value={value} onChange={(e) => onChange(e.target.value)} className="border-pt-line bg-white" />
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return <th className={`px-3 py-2 text-xs font-medium ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right tabular-nums" : ""}`}>{children}</td>;
}
