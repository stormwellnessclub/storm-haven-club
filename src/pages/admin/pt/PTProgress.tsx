import { useMemo, useState } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, Trophy, CalendarCheck, Percent, Check, X, Plus, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import {
  PTShell, PTPageHeader, PTCard, PTKpiCard, PTBadge, PTSectionTitle, PTEmptyState, PTModal, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { PTWorkspaceNav } from "@/components/admin/pt/PTWorkspaceNav";
import { usePTClientDirectory } from "@/hooks/pt/usePTClientDirectory";
import { usePTProgressData, usePTProgressSummary, usePTPRMutations } from "@/hooks/pt/usePTProgressTracking";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHART = { grid: "#E7E1D6", gold: "#B08D57", ink: "#2A241E", green: "#4F7A5B", muted: "#8B8177" };

function iso(d: Date) { return d.toISOString().slice(0, 10); }

export default function PTProgress() {
  const { data: directory = [] } = usePTClientDirectory();
  const [userId, setUserId] = useState<string>("");
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date(); from.setMonth(from.getMonth() - 3);
    return { from: iso(from), to: iso(to) };
  });
  const [prOpen, setPrOpen] = useState(false);

  const activeUser = userId || directory[0]?.userId || "";
  const { data, isLoading } = usePTProgressData(activeUser);
  const summary = usePTProgressSummary(data, range);
  const { confirmPR, rejectPR, addManualPR } = usePTPRMutations(activeUser);

  const client = directory.find((c: any) => c.userId === activeUser);

  const circumference = useMemo(
    () => (summary?.circumferenceSeries ?? []).filter((r) => r.waist || r.hips || r.chest || r.arms),
    [summary],
  );

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Programs & Progress"
        title="Progress Tracking"
        subtitle="Attendance, body metrics, strength records and compliance in one view."
        actions={
          <button className={ptButtonClass("outline")} disabled={!activeUser} onClick={() => setPrOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Record result
          </button>
        }
      />
      <PTWorkspaceNav />

      <PTCard className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,260px)_150px_150px]">
          <div>
            <Label className="pt-eyebrow">Client</Label>
            <Select value={activeUser} onValueChange={setUserId}>
              <SelectTrigger className="bg-white border-pt-line h-9 text-[13px]"><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent className="bg-white border-pt-line z-50 max-h-72">
                {directory.map((c: any) => <SelectItem key={c.userId} value={c.userId}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="pt-eyebrow">From</Label>
            <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 bg-white border-pt-line text-[13px]" /></div>
          <div><Label className="pt-eyebrow">To</Label>
            <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 bg-white border-pt-line text-[13px]" /></div>
        </div>
      </PTCard>

      {!activeUser ? (
        <PTEmptyState icon={TrendingUp} title="Select a client" description="Pick a client to see their progress." />
      ) : isLoading ? (
        <PTCard>Loading progress…</PTCard>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PTKpiCard label="Sessions completed" value={summary?.sessionsCompleted ?? 0} hint={`${summary?.sessionsCounted ?? 0} counted in range`} icon={CalendarCheck} />
            <PTKpiCard label="Attendance" value={summary?.attendance != null ? `${summary.attendance}%` : "—"} tone={(summary?.attendance ?? 100) < 75 ? "amber" : "green"} icon={Percent} />
            <PTKpiCard label="Workout compliance" value={summary?.compliance != null ? `${summary.compliance}%` : "—"} icon={TrendingUp} />
            <PTKpiCard label="Confirmed PRs" value={summary?.prsConfirmed.length ?? 0} hint={summary?.prsPending.length ? `${summary.prsPending.length} awaiting confirmation` : undefined} tone="gold" icon={Trophy} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <DeltaCard label="Weight change" delta={summary?.weightDelta} unit="lb" from={summary?.first?.weight_lbs} to={summary?.last?.weight_lbs} />
            <DeltaCard label="Body-fat change" delta={summary?.bodyFatDelta} unit="%" from={summary?.first?.body_fat_pct} to={summary?.last?.body_fat_pct} />
            <DeltaCard label="Waist change" delta={summary?.waistDelta} unit="in" from={summary?.first?.waist_in} to={summary?.last?.waist_in} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PTCard>
              <PTSectionTitle>Weight trend</PTSectionTitle>
              {summary?.weightSeries.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={summary.weightSeries}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: CHART.muted }} domain={["auto", "auto"]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke={CHART.gold} fill={CHART.gold} fillOpacity={0.15} name="Weight (lb)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <PTEmptyState title="No weight data" description="Log body metrics to see the trend." />}
            </PTCard>

            <PTCard>
              <PTSectionTitle>Body-fat trend</PTSectionTitle>
              {summary?.bodyFatSeries.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={summary.bodyFatSeries}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: CHART.muted }} domain={["auto", "auto"]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke={CHART.green} strokeWidth={2} dot={false} name="Body fat (%)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <PTEmptyState title="No body-fat data" description="Log body metrics to see the trend." />}
            </PTCard>

            <PTCard className="xl:col-span-2">
              <PTSectionTitle>Circumference changes</PTSectionTitle>
              {circumference.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={circumference}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: CHART.muted }} domain={["auto", "auto"]} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="waist" stroke={CHART.gold} strokeWidth={2} dot={false} name="Waist" />
                    <Line type="monotone" dataKey="hips" stroke={CHART.green} strokeWidth={2} dot={false} name="Hips" />
                    <Line type="monotone" dataKey="chest" stroke={CHART.ink} strokeWidth={2} dot={false} name="Chest" />
                    <Line type="monotone" dataKey="arms" stroke={CHART.muted} strokeWidth={2} dot={false} name="Arms" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <PTEmptyState title="No circumference data" description="Record waist, hip, chest or arm measurements." />}
            </PTCard>
          </div>

          <PTCard>
            <PTSectionTitle>Personal records</PTSectionTitle>
            {summary?.prsPending.length ? (
              <div className="mb-4 space-y-2">
                <div className="pt-eyebrow">Awaiting trainer confirmation</div>
                {summary.prsPending.map((p: any) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-pt-gold/40 bg-pt-gold/5 px-3 py-2">
                    <div className="text-[13px] text-pt-ink">
                      <span className="font-medium">{p.exercise}</span> — {p.weight_lbs} lb{p.reps ? ` x ${p.reps}` : ""}
                      {p.previous_weight_lbs != null && <span className="text-pt-muted"> (prev {p.previous_weight_lbs} lb)</span>}
                      <span className="text-pt-muted"> · {p.achieved_on}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className={ptButtonClass("primary")} onClick={() => confirmPR.mutate(p.id)}>
                        <Check className="h-3.5 w-3.5 mr-1" />Confirm PR
                      </button>
                      <button className={ptButtonClass("ghost")} onClick={() => rejectPR.mutate(p.id)}>
                        <X className="h-3.5 w-3.5 mr-1" />Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {summary?.prsConfirmed.length ? (
              <ul className="divide-y divide-pt-line/70 text-[13px]">
                {summary.prsConfirmed.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <span className="text-pt-ink">{p.exercise}</span>
                    <span className="text-pt-muted">{p.weight_lbs} lb{p.reps ? ` x ${p.reps}` : ""} · {p.achieved_on}</span>
                  </li>
                ))}
              </ul>
            ) : <PTEmptyState title="No records in range" description="Record a result to detect new PRs." />}
          </PTCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <PTCard>
              <PTSectionTitle>Reassessment status</PTSectionTitle>
              <div className="text-[13px] text-pt-ink">
                {summary?.nextReassessment
                  ? <>Next reassessment <PTBadge tone={summary.nextReassessment < iso(new Date()) ? "red" : "gold"}>
                      {format(new Date(`${summary.nextReassessment}T12:00:00`), "MMM d, yyyy")}
                    </PTBadge></>
                  : <span className="text-pt-muted">No reassessment scheduled.</span>}
              </div>
            </PTCard>

            <PTCard>
              <PTSectionTitle>Progress photos</PTSectionTitle>
              {summary?.photos?.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {summary.photos.slice(0, 6).map((p: any) => (
                    <figure key={p.id} className="rounded-lg overflow-hidden border border-pt-line">
                      <img src={p.url ?? p.photo_url} alt={`Progress photo for ${client?.name ?? "client"} on ${p.taken_on}`}
                        className="h-28 w-full object-cover" loading="lazy" />
                      <figcaption className="text-[11px] text-pt-muted px-2 py-1">{p.taken_on}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <PTEmptyState icon={ImageIcon} title="No photos yet" description="Upload progress photos from the client profile." />
              )}
            </PTCard>
          </div>
        </div>
      )}

      <RecordResultModal
        open={prOpen} onOpenChange={setPrOpen}
        onSubmit={(v) => addManualPR.mutate({ user_id: activeUser, ...v }, { onSuccess: () => setPrOpen(false) })}
      />
    </PTShell>
  );
}

function DeltaCard({ label, delta, unit, from, to }: { label: string; delta?: number | null; unit: string; from?: any; to?: any }) {
  const has = delta != null;
  const tone = !has ? "default" : delta! < 0 ? "green" : delta! > 0 ? "amber" : "default";
  return (
    <PTKpiCard
      label={label}
      value={has ? `${delta! > 0 ? "+" : ""}${delta!.toFixed(1)} ${unit}` : "—"}
      hint={from != null && to != null ? `${from} → ${to} ${unit}` : "Before vs current"}
      tone={tone as any}
    />
  );
}

function RecordResultModal({ open, onOpenChange, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (v: { exercise: string; weight_lbs: number; reps: number | null; achieved_on: string; notes: string | null }) => void;
}) {
  const [form, setForm] = useState({ exercise: "", weight: "", reps: "", date: iso(new Date()), notes: "" });
  return (
    <PTModal
      open={open} onOpenChange={onOpenChange} title="Record result"
      description="Results that beat the confirmed best are proposed as a PR and need trainer confirmation."
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={() => onOpenChange(false)}>Cancel</button>
        <button className={ptButtonClass("primary")} disabled={!form.exercise.trim() || !form.weight}
          onClick={() => onSubmit({
            exercise: form.exercise.trim(), weight_lbs: Number(form.weight),
            reps: form.reps ? Number(form.reps) : null, achieved_on: form.date, notes: form.notes || null,
          })}>Submit</button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label className="pt-eyebrow">Exercise</Label>
          <Input value={form.exercise} onChange={(e) => setForm({ ...form, exercise: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Weight (lb)</Label>
          <Input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Reps</Label>
          <Input type="number" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Date</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-white border-pt-line" /></div>
        <div><Label className="pt-eyebrow">Notes</Label>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-white border-pt-line" /></div>
      </div>
    </PTModal>
  );
}
