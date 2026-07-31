import { useMemo, useState } from "react";
import { format as fmtDate, startOfMonth, subMonths } from "date-fns";
import { BarChart3, Download, CalendarCheck, UserX, Users, DollarSign, FileWarning } from "lucide-react";
import {
  PTShell, PTPageHeader, PTCard, PTKpiCard, PTTable, PTColumn, PTEmptyState, PTSectionTitle, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { formatCents } from "@/lib/ptFormat";
import { usePTReportData, usePTReportLookups, PTReportFilters } from "@/hooks/pt/usePTReportData";
import { usePTPeople } from "@/hooks/pt/usePTPortal";
import { daysUntil } from "@/hooks/pt/usePTPackages";
import { downloadCsv } from "@/lib/ptExport";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function PTReports() {
  const [filters, setFilters] = useState<PTReportFilters>({
    from: iso(startOfMonth(subMonths(new Date(), 2))),
    to: iso(new Date()),
    trainerId: "all",
    clientId: "all",
    locationId: "all",
    sessionTypeId: "all",
  });

  const { data: lookups } = usePTReportLookups();
  const { data, isLoading } = usePTReportData(filters);

  const appts = data?.appointments ?? [];
  const passes = data?.passes ?? [];
  const adjustments = data?.adjustments ?? [];
  const usage = data?.usage ?? [];
  const programs = data?.programs ?? [];
  const tests = data?.performanceTests ?? [];
  const notes = data?.notes ?? [];

  const peopleIds = useMemo(
    () => Array.from(new Set([...appts.map((a: any) => a.user_id), ...passes.map((p: any) => p.user_id)].filter(Boolean))),
    [appts, passes]
  );
  const { data: people = {} } = usePTPeople(peopleIds as string[]);
  const trainerName = useMemo(
    () => Object.fromEntries((lookups?.trainers ?? []).map((t: any) => [t.id, t.name])),
    [lookups]
  );
  const nameOf = (id?: string | null) => (id ? people[id]?.name ?? "—" : "—");

  const kpis = useMemo(() => {
    const booked = appts.length;
    const completed = appts.filter((a: any) => a.status === "completed");
    const noShows = appts.filter((a: any) => a.status === "no_show");
    const cancelled = appts.filter((a: any) => a.status === "cancelled" || a.status === "late_cancel");
    const packageRevenue = passes
      .filter((p: any) => p.activated_at >= filters.from && p.activated_at <= filters.to)
      .reduce((s: number, p: any) => s + (p.price_cents_charged || 0), 0);
    const sessionRevenue = appts
      .filter((a: any) => a.payment_status === "paid")
      .reduce((s: number, a: any) => s + (a.amount_due_cents || 0), 0);
    const completedIds = new Set(completed.map((a: any) => a.id));
    const notedIds = new Set(notes.filter((n: any) => !n.is_draft).map((n: any) => n.appointment_id));
    const outstandingNotes = completed.filter((a: any) => !notedIds.has(a.id)).length;
    const trainedMinutes = completed.reduce((s: number, a: any) => s + (a.duration_minutes || 60), 0);

    return {
      booked,
      completed: completed.length,
      cancelRate: booked ? Math.round((cancelled.length / booked) * 100) : 0,
      noShowRate: booked ? Math.round((noShows.length / booked) * 100) : 0,
      packageRevenue,
      sessionRevenue,
      outstandingNotes,
      trainedHours: Math.round(trainedMinutes / 60),
      completedIds,
      reassessments: tests.filter((t: any) => t.is_reassessment).length,
      packageSessionsUsed: usage.length,
    };
  }, [appts, passes, notes, tests, usage, filters]);

  const trainerRows = useMemo(() => {
    const map = new Map<string, any>();
    appts.forEach((a: any) => {
      const key = a.instructor_id || "unassigned";
      const row = map.get(key) ?? { id: key, name: trainerName[key] ?? "Unassigned", booked: 0, completed: 0, noShow: 0, cancelled: 0, minutes: 0, noted: 0 };
      row.booked += 1;
      if (a.status === "completed") { row.completed += 1; row.minutes += a.duration_minutes || 60; }
      if (a.status === "no_show") row.noShow += 1;
      if (a.status === "cancelled" || a.status === "late_cancel") row.cancelled += 1;
      map.set(key, row);
    });
    const notedIds = new Set(notes.filter((n: any) => !n.is_draft).map((n: any) => n.appointment_id));
    appts.forEach((a: any) => {
      if (a.status === "completed" && notedIds.has(a.id)) {
        const row = map.get(a.instructor_id || "unassigned");
        if (row) row.noted += 1;
      }
    });
    return Array.from(map.values()).map((r) => ({
      ...r,
      utilization: r.booked ? Math.round((r.completed / r.booked) * 100) : 0,
      notesRate: r.completed ? Math.round((r.noted / r.completed) * 100) : 0,
      hours: Math.round(r.minutes / 60),
    })).sort((a, b) => b.completed - a.completed);
  }, [appts, notes, trainerName]);

  const packageRows = useMemo(() => {
    const map = new Map<string, any>();
    passes.forEach((p: any) => {
      const inWindow = p.activated_at >= filters.from && p.activated_at <= filters.to;
      const row = map.get(p.pack_name) ?? { name: p.pack_name, sold: 0, revenue: 0, sessionsSold: 0, sessionsUsed: 0 };
      if (inWindow) { row.sold += 1; row.revenue += p.price_cents_charged || 0; }
      row.sessionsSold += p.sessions_total || 0;
      row.sessionsUsed += (p.sessions_total || 0) - (p.sessions_remaining || 0);
      map.set(p.pack_name, row);
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, utilization: r.sessionsSold ? Math.round((r.sessionsUsed / r.sessionsSold) * 100) : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [passes, filters]);

  const expiringRows = useMemo(
    () => passes
      .filter((p: any) => p.status === "active" && daysUntil(p.expires_at) >= 0 && daysUntil(p.expires_at) <= 45)
      .sort((a: any, b: any) => a.expires_at.localeCompare(b.expires_at)),
    [passes]
  );

  const clientRows = useMemo(() => {
    const map = new Map<string, any>();
    appts.forEach((a: any) => {
      if (!a.user_id) return;
      const row = map.get(a.user_id) ?? { user_id: a.user_id, booked: 0, completed: 0, noShow: 0, cancelled: 0, first: a.starts_at, last: a.starts_at };
      row.booked += 1;
      if (a.status === "completed") row.completed += 1;
      if (a.status === "no_show") row.noShow += 1;
      if (a.status === "cancelled" || a.status === "late_cancel") row.cancelled += 1;
      if (a.starts_at < row.first) row.first = a.starts_at;
      if (a.starts_at > row.last) row.last = a.starts_at;
      map.set(a.user_id, row);
    });
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        attendance: r.booked ? Math.round((r.completed / r.booked) * 100) : 0,
        retained: r.completed > 1,
      }))
      .sort((a, b) => b.completed - a.completed);
  }, [appts]);

  const retentionRate = clientRows.length
    ? Math.round((clientRows.filter((c) => c.retained).length / clientRows.length) * 100)
    : 0;

  const programCompliance = useMemo(() => {
    const active = programs.filter((p: any) => !p.is_template && p.status === "active");
    const rows = active.map((p: any) => {
      const clientCompleted = appts.filter((a: any) => a.user_id === p.user_id && a.status === "completed").length;
      const clientBooked = appts.filter((a: any) => a.user_id === p.user_id).length;
      return {
        id: p.id,
        program: p.name,
        client: nameOf(p.user_id),
        booked: clientBooked,
        completed: clientCompleted,
        compliance: clientBooked ? Math.round((clientCompleted / clientBooked) * 100) : 0,
      };
    });
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.compliance, 0) / rows.length) : 0;
    return { rows, avg, activeCount: active.length };
  }, [programs, appts, people]);

  const set = (patch: Partial<PTReportFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const trainerCols: PTColumn<any>[] = [
    { key: "name", header: "Trainer", render: (r) => r.name },
    { key: "booked", header: "Booked", align: "right", render: (r) => r.booked },
    { key: "completed", header: "Completed", align: "right", render: (r) => r.completed },
    { key: "cancelled", header: "Cancelled", align: "right", render: (r) => r.cancelled },
    { key: "noshow", header: "No-show", align: "right", render: (r) => r.noShow },
    { key: "hours", header: "Hours", align: "right", render: (r) => r.hours },
    { key: "util", header: "Utilization", align: "right", render: (r) => `${r.utilization}%` },
    { key: "notes", header: "Notes done", align: "right", render: (r) => `${r.notesRate}%` },
  ];

  const packageCols: PTColumn<any>[] = [
    { key: "name", header: "Package", render: (r) => r.name },
    { key: "sold", header: "Sold", align: "right", render: (r) => r.sold },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => formatCents(r.revenue) },
    { key: "sessionsSold", header: "Sessions sold", align: "right", render: (r) => r.sessionsSold },
    { key: "sessionsUsed", header: "Sessions used", align: "right", render: (r) => r.sessionsUsed },
    { key: "util", header: "Usage", align: "right", render: (r) => `${r.utilization}%` },
  ];

  const expiringCols: PTColumn<any>[] = [
    { key: "client", header: "Client", render: (p) => nameOf(p.user_id) },
    { key: "pack", header: "Package", render: (p) => p.pack_name },
    { key: "remaining", header: "Remaining", align: "right", render: (p) => p.sessions_remaining },
    { key: "expires", header: "Expires", render: (p) => fmtDate(new Date(`${p.expires_at}T12:00:00`), "MMM d, yyyy") },
    { key: "days", header: "Days left", align: "right", render: (p) => daysUntil(p.expires_at) },
  ];

  const clientCols: PTColumn<any>[] = [
    { key: "client", header: "Client", render: (r) => nameOf(r.user_id) },
    { key: "booked", header: "Booked", align: "right", render: (r) => r.booked },
    { key: "completed", header: "Completed", align: "right", render: (r) => r.completed },
    { key: "noshow", header: "No-show", align: "right", render: (r) => r.noShow },
    { key: "attendance", header: "Attendance", align: "right", render: (r) => `${r.attendance}%` },
    { key: "last", header: "Last session", render: (r) => fmtDate(new Date(r.last), "MMM d, yyyy") },
  ];

  const complianceCols: PTColumn<any>[] = [
    { key: "program", header: "Program", render: (r) => r.program },
    { key: "client", header: "Client", render: (r) => r.client },
    { key: "booked", header: "Booked", align: "right", render: (r) => r.booked },
    { key: "completed", header: "Completed", align: "right", render: (r) => r.completed },
    { key: "compliance", header: "Compliance", align: "right", render: (r) => `${r.compliance}%` },
  ];

  function exportAll() {
    downloadCsv(`pt-report-${filters.from}_${filters.to}`, [
      { metric: "Sessions booked", value: kpis.booked },
      { metric: "Sessions completed", value: kpis.completed },
      { metric: "Cancellation rate %", value: kpis.cancelRate },
      { metric: "No-show rate %", value: kpis.noShowRate },
      { metric: "Package revenue", value: (kpis.packageRevenue / 100).toFixed(2) },
      { metric: "Session revenue", value: (kpis.sessionRevenue / 100).toFixed(2) },
      { metric: "Package sessions used", value: kpis.packageSessionsUsed },
      { metric: "Expiring packages (45d)", value: expiringRows.length },
      { metric: "Client retention %", value: retentionRate },
      { metric: "Program compliance %", value: programCompliance.avg },
      { metric: "Reassessments completed", value: kpis.reassessments },
      { metric: "Outstanding session notes", value: kpis.outstandingNotes },
      { metric: "Manual package adjustments", value: adjustments.length },
    ], ["metric", "value"]);
  }

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Insight"
        title="Reports"
        subtitle="Every figure is calculated from live training records."
        actions={
          <button className={ptButtonClass("primary")} onClick={exportAll}>
            <Download className="h-4 w-4" /> Export summary
          </button>
        }
      />

      <PTCard>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="text-xs text-pt-muted">From</label>
            <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="border-pt-line bg-white" />
          </div>
          <div>
            <label className="text-xs text-pt-muted">To</label>
            <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className="border-pt-line bg-white" />
          </div>
          <div>
            <label className="text-xs text-pt-muted">Trainer</label>
            <Select value={filters.trainerId} onValueChange={(v) => set({ trainerId: v })}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trainers</SelectItem>
                {(lookups?.trainers ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-pt-muted">Client</label>
            <Select value={filters.clientId} onValueChange={(v) => set({ clientId: v })}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All clients</SelectItem>
                {clientRows.map((c) => <SelectItem key={c.user_id} value={c.user_id}>{nameOf(c.user_id)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-pt-muted">Location</label>
            <Select value={filters.locationId} onValueChange={(v) => set({ locationId: v })}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {(lookups?.locations ?? []).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-pt-muted">Session type</label>
            <Select value={filters.sessionTypeId} onValueChange={(v) => set({ sessionTypeId: v })}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {(lookups?.sessionTypes ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PTCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 my-6">
        <PTKpiCard label="Sessions booked" value={kpis.booked} icon={CalendarCheck} />
        <PTKpiCard label="Sessions completed" value={kpis.completed} tone="gold" hint={`${kpis.trainedHours} training hours`} />
        <PTKpiCard label="Cancellation rate" value={`${kpis.cancelRate}%`} tone="amber" />
        <PTKpiCard label="No-show rate" value={`${kpis.noShowRate}%`} tone="red" icon={UserX} />
        <PTKpiCard label="Package revenue" value={formatCents(kpis.packageRevenue)} icon={DollarSign} />
        <PTKpiCard label="Session revenue" value={formatCents(kpis.sessionRevenue)} />
        <PTKpiCard label="Client retention" value={`${retentionRate}%`} icon={Users} hint="Clients with repeat sessions" />
        <PTKpiCard label="Outstanding notes" value={kpis.outstandingNotes} tone="amber" icon={FileWarning} />
        <PTKpiCard label="Package sessions used" value={kpis.packageSessionsUsed} />
        <PTKpiCard label="Expiring packages" value={expiringRows.length} tone="red" hint="Within 45 days" />
        <PTKpiCard label="Program compliance" value={`${programCompliance.avg}%`} hint={`${programCompliance.activeCount} active programs`} />
        <PTKpiCard label="Reassessments" value={kpis.reassessments} icon={BarChart3} />
      </div>

      <div className="space-y-6">
        <ReportBlock
          title="Trainer utilization"
          onExport={() => downloadCsv("pt-trainer-utilization", trainerRows)}
          columns={trainerCols} rows={trainerRows} loading={isLoading}
        />
        <ReportBlock
          title="Revenue and usage by package"
          onExport={() => downloadCsv("pt-package-revenue", packageRows.map((r) => ({ ...r, revenue: (r.revenue / 100).toFixed(2) })))}
          columns={packageCols} rows={packageRows} loading={isLoading}
        />
        <ReportBlock
          title="Expiring packages"
          onExport={() => downloadCsv("pt-expiring-packages", expiringRows.map((p: any) => ({
            client: nameOf(p.user_id), package: p.pack_name, remaining: p.sessions_remaining, expires: p.expires_at,
          })))}
          columns={expiringCols} rows={expiringRows} loading={isLoading}
        />
        <ReportBlock
          title="Client attendance and retention"
          onExport={() => downloadCsv("pt-client-attendance", clientRows.map((c) => ({
            client: nameOf(c.user_id), booked: c.booked, completed: c.completed, no_shows: c.noShow,
            attendance_rate: c.attendance, retained: c.retained, last_session: c.last,
          })))}
          columns={clientCols} rows={clientRows} loading={isLoading}
        />
        <ReportBlock
          title="Program compliance"
          onExport={() => downloadCsv("pt-program-compliance", programCompliance.rows)}
          columns={complianceCols} rows={programCompliance.rows} loading={isLoading}
        />
      </div>
    </PTShell>
  );
}

function ReportBlock({
  title, columns, rows, loading, onExport,
}: {
  title: string;
  columns: PTColumn<any>[];
  rows: any[];
  loading: boolean;
  onExport: () => void;
}) {
  return (
    <div>
      <PTSectionTitle action={<button className={ptButtonClass("outline")} onClick={onExport}><Download className="h-3.5 w-3.5" /> Export</button>}>
        {title}
      </PTSectionTitle>
      <PTCard padded={false}>
        <PTTable
          columns={columns}
          rows={rows}
          loading={loading}
          getRowKey={(r: any, i: number) => r.id ?? r.user_id ?? r.name ?? String(i)}
          empty={<PTEmptyState icon={BarChart3} title="No data in this range" description="Adjust the filters above to widen the report window." />}
        />
      </PTCard>
    </div>
  );
}
