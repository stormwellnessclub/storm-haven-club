import { useMemo, useState } from "react";
import { ClipboardCheck, CalendarPlus, Plus } from "lucide-react";
import { format } from "date-fns";
import {
  PTShell, PTPageHeader, PTCard, PTKpiCard, PTBadge, PTTable, PTEmptyState, PTModal, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { PTWorkspaceNav } from "@/components/admin/pt/PTWorkspaceNav";
import { usePTReassessments, usePTReassessmentMutations } from "@/hooks/pt/usePTProgressTracking";
import { usePTClientDirectory } from "@/hooks/pt/usePTClientDirectory";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const today = () => new Date().toISOString().slice(0, 10);

export default function PTReassessments() {
  const { data, isLoading } = usePTReassessments();
  const { data: directory = [] } = usePTClientDirectory();
  const { schedule, recordTest } = usePTReassessmentMutations();
  const [scheduling, setScheduling] = useState<any | null>(null);
  const [recording, setRecording] = useState(false);

  const nameOf = useMemo(() => {
    const map: Record<string, string> = {};
    directory.forEach((c: any) => { map[c.userId] = c.name; });
    return map;
  }, [directory]);

  const rows = useMemo(() => {
    const t = today();
    return (data?.programs ?? []).map((p: any) => {
      const lastTest = (data?.tests ?? []).find((x: any) => x.user_id === p.user_id);
      const due = p.next_reassessment as string | null;
      const status = !due ? "unscheduled" : due < t ? "overdue" : due <= addDays(t, 14) ? "due_soon" : "scheduled";
      return { ...p, client: nameOf[p.user_id] ?? "Client", lastTest, due, statusKey: status };
    }).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  }, [data, nameOf]);

  const counts = useMemo(() => ({
    overdue: rows.filter((r) => r.statusKey === "overdue").length,
    dueSoon: rows.filter((r) => r.statusKey === "due_soon").length,
    unscheduled: rows.filter((r) => r.statusKey === "unscheduled").length,
    logged: data?.tests?.length ?? 0,
  }), [rows, data]);

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Programs & Progress"
        title="Reassessments"
        subtitle="Keep every client on a testing cadence and log performance results."
        actions={
          <button className={ptButtonClass("primary")} onClick={() => setRecording(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Record reassessment
          </button>
        }
      />
      <PTWorkspaceNav />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <PTKpiCard label="Overdue" value={counts.overdue} tone="red" icon={ClipboardCheck} />
        <PTKpiCard label="Due within 14 days" value={counts.dueSoon} tone="amber" icon={CalendarPlus} />
        <PTKpiCard label="Unscheduled" value={counts.unscheduled} />
        <PTKpiCard label="Tests logged" value={counts.logged} tone="green" />
      </div>

      <PTCard padded={false} className="mb-4">
        <PTTable
          loading={isLoading}
          rows={rows}
          getRowKey={(r: any) => r.id}
          empty={<PTEmptyState title="No assigned programs" description="Assign a program to a client to track reassessments." />}
          columns={[
            { key: "client", header: "Client", render: (r: any) => <span className="text-[13px] font-medium text-pt-ink">{r.client}</span> },
            { key: "program", header: "Program", render: (r: any) => r.name },
            { key: "due", header: "Next reassessment", render: (r: any) => r.due ? format(new Date(`${r.due}T12:00:00`), "MMM d, yyyy") : "—" },
            { key: "status", header: "Status", render: (r: any) => (
              <PTBadge tone={r.statusKey === "overdue" ? "red" : r.statusKey === "due_soon" ? "amber" : r.statusKey === "scheduled" ? "green" : "neutral"}>
                {r.statusKey.replace("_", " ")}
              </PTBadge>
            ) },
            { key: "last", header: "Last test", render: (r: any) => r.lastTest ? `${r.lastTest.test_name} · ${r.lastTest.tested_on}` : "—" },
            { key: "act", header: "", align: "right", render: (r: any) => (
              <button className={ptButtonClass("outline")} onClick={() => setScheduling(r)}>Schedule</button>
            ) },
          ]}
        />
      </PTCard>

      <PTCard>
        <h2 className="pt-eyebrow mb-3">Recent reassessment results</h2>
        {data?.tests?.length ? (
          <ul className="divide-y divide-pt-line/70 text-[13px]">
            {data.tests.slice(0, 25).map((t: any) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-pt-ink">{nameOf[t.user_id] ?? "Client"} — {t.test_name}</span>
                <span className="text-pt-muted">
                  {t.value != null ? `${t.value}${t.unit ? ` ${t.unit}` : ""}` : t.result_text ?? "—"} · {t.tested_on}
                </span>
              </li>
            ))}
          </ul>
        ) : <PTEmptyState title="Nothing logged yet" description="Record a reassessment to build the history." />}
      </PTCard>

      <PTModal
        open={!!scheduling} onOpenChange={(v) => !v && setScheduling(null)}
        title="Schedule reassessment"
        description={scheduling ? `${scheduling.client} — ${scheduling.name}` : undefined}
      >
        {scheduling && (
          <div className="space-y-3">
            <Label className="pt-eyebrow">Reassessment date</Label>
            <Input type="date" defaultValue={scheduling.due ?? addDays(today(), 28)} id="pt-reassess-date" className="bg-white border-pt-line" />
            <button className={ptButtonClass("primary")} onClick={() => {
              const el = document.getElementById("pt-reassess-date") as HTMLInputElement | null;
              if (!el?.value) return;
              schedule.mutate({ programId: scheduling.id, date: el.value }, { onSuccess: () => setScheduling(null) });
            }}>Save date</button>
          </div>
        )}
      </PTModal>

      <RecordTestModal
        open={recording} onOpenChange={setRecording} clients={directory}
        onSubmit={(v) => recordTest.mutate(v, { onSuccess: () => setRecording(false) })}
      />
    </PTShell>
  );
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function RecordTestModal({ open, onOpenChange, clients, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; clients: any[];
  onSubmit: (v: any) => void;
}) {
  const [form, setForm] = useState({ user_id: "", test_name: "", category: "", value: "", unit: "", result_text: "", tested_on: today(), notes: "" });
  return (
    <PTModal
      open={open} onOpenChange={onOpenChange} title="Record reassessment"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} disabled={!form.user_id || !form.test_name.trim()}
          onClick={() => onSubmit({
            user_id: form.user_id, test_name: form.test_name.trim(), category: form.category || null,
            value: form.value ? Number(form.value) : null, unit: form.unit || null,
            result_text: form.result_text || null, tested_on: form.tested_on, notes: form.notes || null,
          })}>Save result</button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label className="pt-eyebrow">Client</Label>
          <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
            <SelectTrigger className="bg-white border-pt-line"><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent className="bg-white border-pt-line z-50 max-h-72">
              {clients.map((c: any) => <SelectItem key={c.userId} value={c.userId}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="pt-eyebrow">Test name</Label>
          <Input value={form.test_name} onChange={(e) => setForm({ ...form, test_name: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Category</Label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="strength / mobility / conditioning" className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Value</Label>
          <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Unit</Label>
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="lb / sec / reps" className="bg-white border-pt-line" /></div>
        <div className="sm:col-span-2"><Label className="pt-eyebrow">Result (text)</Label>
          <Input value={form.result_text} onChange={(e) => setForm({ ...form, result_text: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Tested on</Label>
          <Input type="date" value={form.tested_on} onChange={(e) => setForm({ ...form, tested_on: e.target.value })} className="bg-white border-pt-line" /></div>
        <div className="sm:col-span-2"><Label className="pt-eyebrow">Notes</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-white border-pt-line min-h-20" /></div>
      </div>
    </PTModal>
  );
}
