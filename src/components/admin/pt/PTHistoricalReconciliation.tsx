import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePTPeople, usePTTrainerMap } from "@/hooks/pt/usePTPortal";
import { PTCard } from "@/components/admin/pt/PTUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = {
  id: string; user_id: string; instructor_id: string | null; format: string; session_type_name: string | null;
  starts_at: string; status: string; pass_id: string | null; pack_name: string | null;
  sessions_remaining: number | null; sessions_total: number | null; package_deducted: boolean; reservation_state: string;
  consumed_usage_count: number; payment_status: string | null; amount_due_cents: number | null;
  invoice_count: number; allocation_count: number; eligible_pass_id: string | null; eligible_pack_name: string | null;
  eligible_sessions_remaining: number | null; needs_review: boolean; review_reasons: string[] | null;
};

const OUTCOMES = [
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-show" },
  { value: "late_client_cancel", label: "Late cancellation" },
  { value: "timely_client_cancel", label: "Timely client cancellation" },
  { value: "staff_cancel", label: "Staff cancellation" },
  { value: "facility_cancel", label: "Facility cancellation" },
];
const CONSUMING = ["completed", "no_show", "late_client_cancel"];

const fmtDetroit = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const detroitDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
const money = (c: number | null) => `$${((c ?? 0) / 100).toFixed(2)}`;

function creditLabel(r: Row) {
  if (r.package_deducted) return `Used (${r.consumed_usage_count > 0 ? "history entry" : "no history entry"})`;
  if (r.reservation_state === "reserved") return "Reserved";
  return "None";
}

/** Plain-language consequence using the same rules the saving functions apply. */
export function consequence(r: Row, outcome: string, usePackage: boolean): string {
  const consuming = CONSUMING.includes(outcome);
  if (r.package_deducted) {
    const rem = r.sessions_remaining ?? 0;
    return consuming ? `Session already used — no additional deduction (stays ${rem} remaining).`
      : `Restore 1 session to ${r.pack_name ?? "package"} (${rem} → ${rem + 1} remaining).`;
  }
  if (r.reservation_state === "reserved") {
    return consuming ? "Reserved package session becomes used." : "Reserved package session is released.";
  }
  if (consuming && r.eligible_pass_id) {
    return usePackage
      ? `Uses 1 session from ${r.eligible_pack_name} (${r.eligible_sessions_remaining} → ${(r.eligible_sessions_remaining ?? 1) - 1} remaining).`
      : `Client has a current package (${r.eligible_pack_name}). You must confirm package use before saving.`;
  }
  if (outcome === "completed") return `No package. Stays an unpaid session: ${money(r.amount_due_cents)} owed.`;
  if (consuming) return `No package to draw from. Unpaid amount ${money(r.amount_due_cents)} stays on the account.`;
  return r.payment_status === "unpaid" ? `No charge — ${money(r.amount_due_cents)} owed is cleared to $0.` : "No package or payment change.";
}

export function PTHistoricalReconciliation() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pt-unresolved-past"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any).rpc("pt_historical_unresolved_list");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: people = {} } = usePTPeople(rows.map((r) => r.user_id));
  const trainers = usePTTrainerMap();

  const [fClient, setFClient] = useState("");
  const [fTrainer, setFTrainer] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fType, setFType] = useState("all");
  const [fPkg, setFPkg] = useState("all");
  const [fUnpaid, setFUnpaid] = useState(false);
  const [fReview, setFReview] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [usePackage, setUsePackage] = useState(false);

  const typeOf = (r: Row) => r.session_type_name ?? r.format.replace(/_/g, " ");
  const types = useMemo(() => Array.from(new Set(rows.map(typeOf))).sort(), [rows]);
  const trainerIds = useMemo(() => Array.from(new Set(rows.map((r) => r.instructor_id ?? "none"))), [rows]);

  const filtered = rows.filter((r) => {
    const name = (people[r.user_id]?.name ?? "").toLowerCase();
    if (fClient && !name.includes(fClient.toLowerCase())) return false;
    if (fTrainer !== "all" && (r.instructor_id ?? "none") !== fTrainer) return false;
    const d = detroitDate(r.starts_at);
    if (fFrom && d < fFrom) return false;
    if (fTo && d > fTo) return false;
    if (fType !== "all" && typeOf(r) !== fType) return false;
    const hasPkg = !!r.pass_id || !!r.eligible_pass_id;
    if (fPkg === "yes" && !hasPkg) return false;
    if (fPkg === "no" && hasPkg) return false;
    if (fUnpaid && !(r.payment_status === "unpaid" && (r.amount_due_cents ?? 0) > 0)) return false;
    if (fReview && !r.needs_review) return false;
    return true;
  });

  const selRows = rows.filter((r) => selected.has(r.id));
  const needsPkgConfirm = CONSUMING.includes(outcome) && selRows.some((r) => !r.package_deducted && r.reservation_state !== "reserved" && r.eligible_pass_id);

  const save = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { data, error } = ids.length === 1
        ? await (supabase as any).rpc("pt_resolve_historical_appointment_v2", { p_appointment_id: ids[0], p_outcome: outcome, p_note: note || null, p_use_package: usePackage })
        : await (supabase as any).rpc("pt_resolve_historical_appointments_batch", { p_ids: ids, p_outcome: outcome, p_note: note || null, p_use_package: usePackage });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`${selected.size} appointment${selected.size === 1 ? "" : "s"} resolved`);
      setSelected(new Set()); setOutcome(""); setNote(""); setUsePackage(false);
      ["pt-unresolved-past", "pt-pass-balances", "pt-appointments", "pt-outstanding"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Could not resolve").replace(/^PACKAGE_CONFIRM_REQUIRED:\s*/, "")),
  });

  if (isLoading || rows.length === 0) return null;
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShown = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <PTCard padded={false} className="mb-4">
      <div className="p-4 border-b border-border space-y-1">
        <div className="font-medium">Unresolved past appointments ({rows.length})</div>
        <div className="text-sm text-muted-foreground">
          These sessions are in the past but still say Scheduled. Tick the ones you know the answer for, pick what really happened, and review the result before saving. Nothing is ever decided automatically.
        </div>
      </div>

      <div className="grid gap-2 p-4 border-b border-border sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Client name" value={fClient} onChange={(e) => setFClient(e.target.value)} />
        <Select value={fTrainer} onValueChange={setFTrainer}>
          <SelectTrigger><SelectValue placeholder="Trainer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trainers</SelectItem>
            {trainerIds.map((t) => <SelectItem key={t} value={t}>{t === "none" ? "No trainer" : trainers[t] ?? "Unknown"}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fType} onValueChange={setFType}>
          <SelectTrigger><SelectValue placeholder="Session type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All session types</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPkg} onValueChange={setFPkg}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Package: any</SelectItem>
            <SelectItem value="yes">Has package</SelectItem>
            <SelectItem value="no">No package</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} aria-label="From date" />
        <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} aria-label="To date" />
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={fUnpaid} onCheckedChange={(v) => setFUnpaid(!!v)} />Unpaid only</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={fReview} onCheckedChange={(v) => setFReview(!!v)} />Needs review only</label>
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2"><Checkbox checked={allShown} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); filtered.forEach((r) => v ? n.add(r.id) : n.delete(r.id)); return n; })} aria-label="Select shown" /></th>
              <th className="p-2">Client</th><th className="p-2">Trainer</th><th className="p-2">Date/time</th><th className="p-2">Type</th>
              <th className="p-2">Status</th><th className="p-2">Package</th><th className="p-2">Credit</th><th className="p-2">Payment</th>
              <th className="p-2">Due</th><th className="p-2">Invoice/payment</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-2"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                <td className="p-2">{people[r.user_id]?.name ?? "—"}
                  {r.needs_review && <div className="mt-1 space-y-0.5">{(r.review_reasons ?? []).map((x) => <Badge key={x} variant="outline" className="text-[10px] font-normal">{x}</Badge>)}</div>}
                </td>
                <td className="p-2">{r.instructor_id ? trainers[r.instructor_id] ?? "—" : "—"}</td>
                <td className="p-2 whitespace-nowrap">{fmtDetroit(r.starts_at)}</td>
                <td className="p-2">{typeOf(r)}</td>
                <td className="p-2">Scheduled</td>
                <td className="p-2">{r.pack_name ? `${r.pack_name} (${r.sessions_remaining}/${r.sessions_total})` : r.eligible_pack_name ? `None attached · current: ${r.eligible_pack_name}` : "—"}</td>
                <td className="p-2">{creditLabel(r)}</td>
                <td className="p-2">{r.payment_status ?? "—"}</td>
                <td className="p-2">{money(r.amount_due_cents)}</td>
                <td className="p-2">{r.invoice_count + r.allocation_count > 0 ? `${r.invoice_count} invoice · ${r.allocation_count} payment` : "None"}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">No appointments match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="text-sm font-medium">{selected.size} selected — apply the same known outcome</div>
          <div className="flex flex-wrap items-start gap-3">
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Select true outcome" /></SelectTrigger>
              <SelectContent>{OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea className="min-h-[40px] flex-1 min-w-[200px]" placeholder="Optional reconciliation note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {outcome && (
            <div className="rounded-md border border-border bg-muted p-3 text-sm space-y-1 max-h-60 overflow-auto">
              {selRows.map((r) => (
                <div key={r.id}><span className="text-muted-foreground">{people[r.user_id]?.name ?? "—"}, {fmtDetroit(r.starts_at)}:</span> {consequence(r, outcome, usePackage)}</div>
              ))}
            </div>
          )}
          {needsPkgConfirm && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={usePackage} onCheckedChange={(v) => setUsePackage(!!v)} />
              I confirm these sessions should use the client's current package
            </label>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={!outcome || save.isPending || (needsPkgConfirm && !usePackage)} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : `Save outcome for ${selected.size}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
          </div>
        </div>
      )}
    </PTCard>
  );
}
