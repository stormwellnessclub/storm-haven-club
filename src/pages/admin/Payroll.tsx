import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildPayroll, payrollCsv, shiftHours, type PayrollSource, type PaySettings } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, CheckCircle2, AlertTriangle } from "lucide-react";

const detroitToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dt.toLocaleDateString("en-CA");
};
const money = (n: number) => `$${n.toFixed(2)}`;
const dept: Record<string, string> = { front_desk: "Front desk", cafe: "Cafe", kids_care: "Kids care", management: "Management" };
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not clocked out";
const toLocalInput = (iso: string | null) =>
  iso ? new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit" })).toLocaleString("sv-SE").slice(0, 16).replace(" ", "T") : "";
/** datetime-local (Detroit wall clock) -> ISO */
const fromLocalInput = (v: string) => {
  const guess = new Date(`${v}:00Z`);
  const offset = new Date(guess.toLocaleString("en-US", { timeZone: "America/Detroit" })).getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess.getTime() - offset).toISOString();
};

export default function AdminPayroll() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [end, setEnd] = useState(addDays(detroitToday(), -1));
  const [start, setStart] = useState(addDays(addDays(detroitToday(), -1), -13));
  const [selected, setSelected] = useState<string | null>(null);

  const sources = useQuery({
    queryKey: ["payroll-sources", start, end],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_payroll_sources", { _start: start, _end: end });
      if (error) throw error;
      return (data ?? []) as PayrollSource[];
    },
  });
  const settings = useQuery({
    queryKey: ["payroll-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("payroll_pay_settings").select("*");
      if (error) throw error;
      return (data ?? []) as PaySettings[];
    },
  });
  const period = useQuery({
    queryKey: ["payroll-period", start, end],
    queryFn: async () => {
      const { data } = await (supabase as any).from("payroll_periods").select("*").eq("start_date", start).eq("end_date", end).maybeSingle();
      return data;
    },
  });

  const lines = useMemo(() => buildPayroll(sources.data ?? [], settings.data ?? []), [sources.data, settings.data]);
  const current = lines.find((l) => l.person_key === selected) ?? null;
  const currentShifts = (sources.data ?? []).filter((s) => s.person_key === selected && s.source === "shift");
  const problems = lines.filter((l) => l.missingRate || l.openShifts > 0).length;
  const total = lines.reduce((a, l) => a + l.grossPay, 0);
  const tips = lines.reduce((a, l) => a + l.tips, 0);

  const saveSetting = async (key: string, patch: Partial<PaySettings>) => {
    const existing = settings.data?.find((s) => s.person_key === key) ?? {};
    const { error } = await (supabase as any)
      .from("payroll_pay_settings")
      .upsert({ ...existing, person_key: key, ...patch, updated_by: user?.id, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payroll-settings"] });
  };

  const download = () => {
    const blob = new Blob([payrollCsv(lines)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-${start}-to-${end}.csv`;
    a.click();
  };

  const approve = async () => {
    if (problems > 0 && !confirm(`${problems} people still need a pay rate or a shift fixed. Approve anyway?`)) return;
    const { error } = await (supabase as any)
      .from("payroll_periods")
      .upsert({ start_date: start, end_date: end, snapshot: lines, approved_by: user?.id, approved_at: new Date().toISOString(), status: "approved" }, { onConflict: "start_date,end_date" });
    if (error) return toast.error(error.message);
    toast.success("Pay period approved");
    qc.invalidateQueries({ queryKey: ["payroll-period", start, end] });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-serif">Payroll</h1>
          <p className="text-sm text-muted-foreground">Hours, services, sessions, classes and tips for the pay period. Gusto pays and files taxes.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <Button variant="outline" onClick={download} disabled={!lines.length}><Download className="mr-1 h-4 w-4" />CSV for Gusto</Button>
          <Button onClick={approve} disabled={!lines.length}><CheckCircle2 className="mr-1 h-4 w-4" />{period.data ? "Re-approve" : "Approve"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">People</div><div className="text-xl">{lines.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Gross pay</div><div className="text-xl">{money(total)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Tips</div><div className="text-xl">{money(tips)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Status</div><div className="text-xl">{period.data ? `Approved ${new Date(period.data.approved_at).toLocaleDateString()}` : problems ? `${problems} need attention` : "Ready to approve"}</div></Card>
      </div>
      <p className="text-xs text-muted-foreground">Sending straight to Gusto turns on once your Gusto account is connected. Until then, download the CSV and upload it in Gusto.</p>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b"><th className="p-2">Name</th><th className="p-2">Hours</th><th className="p-2">Spa</th><th className="p-2">PT</th><th className="p-2">Classes</th><th className="p-2">Tips</th><th className="p-2 text-right">Gross</th></tr>
            </thead>
            <tbody>
              {sources.isLoading && <tr><td className="p-3" colSpan={7}>Loading…</td></tr>}
              {sources.error && <tr><td className="p-3 text-destructive" colSpan={7}>{(sources.error as Error).message}</td></tr>}
              {lines.map((l) => (
                <tr key={l.person_key} onClick={() => setSelected(l.person_key)} className={`cursor-pointer border-b hover:bg-muted/50 ${selected === l.person_key ? "bg-muted" : ""}`}>
                  <td className="p-2">
                    <div className="flex items-center gap-1">{l.name}{(l.missingRate || l.openShifts > 0) && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}</div>
                    <div className="text-xs text-muted-foreground">{l.departments.map((d) => dept[d] ?? d).join(", ")}</div>
                  </td>
                  <td className="p-2">{l.regularHours + l.overtimeHours > 0 ? `${l.regularHours}${l.overtimeHours ? ` + ${l.overtimeHours} OT` : ""}` : "—"}</td>
                  <td className="p-2">{l.spaServices ? `${l.spaServices} · ${money(l.spaCommission)}` : "—"}</td>
                  <td className="p-2">{l.ptSessions ? `${l.ptSessions} · ${money(l.ptPay)}` : "—"}</td>
                  <td className="p-2">{l.classPay ? money(l.classPay) : "—"}</td>
                  <td className="p-2">{l.tips ? money(l.tips) : "—"}</td>
                  <td className="p-2 text-right font-medium">{money(l.grossPay)}</td>
                </tr>
              ))}
              {!sources.isLoading && !lines.length && <tr><td className="p-3 text-muted-foreground" colSpan={7}>No recorded work in these dates.</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card className="space-y-3 p-4">
          {!current ? (
            <p className="text-sm text-muted-foreground">Select a person to set pay rates, link Gusto and fix shifts.</p>
          ) : (
            <PersonPanel key={current.person_key} line={current} shifts={currentShifts} settings={settings.data?.find((s) => s.person_key === current.person_key)} onSave={(p) => saveSetting(current.person_key, p)} onShiftFixed={() => qc.invalidateQueries({ queryKey: ["payroll-sources"] })} />
          )}
        </Card>
      </div>
    </div>
  );
}

function PersonPanel({ line, shifts, settings, onSave, onShiftFixed }: any) {
  const [commission, setCommission] = useState(settings?.spa_commission_pct ?? "");
  const [ptRate, setPtRate] = useState(settings?.per_pt_session ?? "");
  const [gusto, setGusto] = useState(settings?.gusto_employee_id ?? "");
  const isUser = line.person_key.startsWith("user:");
  const num = (v: any) => (v === "" || v == null ? null : Number(v));
  return (
    <>
      <div>
        <h2 className="font-medium">{line.name}</h2>
        {isUser && line.hourlyRate == null && <p className="text-xs text-destructive">No hourly rate. Set it on the Team page of the staff schedule.</p>}
        {isUser && line.hourlyRate != null && <p className="text-xs text-muted-foreground">Hourly rate {money(line.hourlyRate)} (from the Team page)</p>}
      </div>
      {line.person_key.startsWith("therapist:") && (
        <div><Label className="text-xs">Spa commission %</Label><Input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} /></div>
      )}
      {line.person_key.startsWith("instructor:") && (
        <div><Label className="text-xs">Pay per completed PT session ($)</Label><Input type="number" value={ptRate} onChange={(e) => setPtRate(e.target.value)} /></div>
      )}
      <div><Label className="text-xs">Gusto employee ID</Label><Input value={gusto} onChange={(e) => setGusto(e.target.value)} placeholder="From Gusto, used for sending" /></div>
      <Button size="sm" onClick={() => onSave({ spa_commission_pct: num(commission), per_pt_session: num(ptRate), gusto_employee_id: gusto.trim() || null })}>Save</Button>

      {shifts.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground">Shifts</div>
          {shifts.map((s: PayrollSource) => <ShiftRow key={s.detail.id} shift={s.detail} onFixed={onShiftFixed} />)}
        </div>
      )}
    </>
  );
}

function ShiftRow({ shift, onFixed }: any) {
  const [editing, setEditing] = useState(false);
  const [inAt, setInAt] = useState(toLocalInput(shift.clock_in_at));
  const [outAt, setOutAt] = useState(toLocalInput(shift.clock_out_at));
  const [reason, setReason] = useState("");
  const save = async () => {
    const { error } = await (supabase.rpc as any)("admin_adjust_shift_clock", {
      _shift_id: shift.id, _clock_in: fromLocalInput(inAt), _clock_out: outAt ? fromLocalInput(outAt) : null, _reason: reason,
    });
    if (error) return toast.error(error.message);
    toast.success("Shift updated");
    setEditing(false);
    onFixed();
  };
  const flagged = !shift.clock_out_at || shift.auto_closed;
  return (
    <div className="rounded border p-2 text-xs">
      <div className="flex items-center gap-2">
        <span>{fmtTime(shift.clock_in_at)} → {fmtTime(shift.clock_out_at)}</span>
        <span className="text-muted-foreground">{shiftHours(shift).toFixed(2)}h</span>
        {flagged && <Badge variant="destructive" className="text-[10px]">Check</Badge>}
        {shift.admin_adjusted && <Badge variant="secondary" className="text-[10px]">Edited</Badge>}
        <button className="ml-auto underline" onClick={() => setEditing(!editing)}>{editing ? "Close" : "Fix"}</button>
      </div>
      {editing && (
        <div className="mt-2 space-y-1">
          <Input type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} />
          <Input type="datetime-local" value={outAt} onChange={(e) => setOutAt(e.target.value)} />
          <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" onClick={save} disabled={!reason.trim() || !inAt}>Save change</Button>
        </div>
      )}
    </div>
  );
}
