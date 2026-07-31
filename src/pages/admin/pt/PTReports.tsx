import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, subMonths, format as fmtDate } from "date-fns";
import { BarChart3, DollarSign, CalendarCheck, UserX, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PTShell, PTPageHeader, PTCard, PTKpiCard, PTTable, PTColumn, PTEmptyState, PTSectionTitle,
} from "@/components/admin/pt/PTUI";
import { formatCents } from "@/lib/ptFormat";

export default function PTReports() {
  const since = useMemo(() => startOfMonth(subMonths(new Date(), 5)), []);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data: appts = [], isLoading: loadingAppts } = useQuery({
    queryKey: ["pt-reports-appts", sinceDate],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_appointments")
        .select("id, instructor_id, session_date, status, payment_status, price_cents")
        .gte("session_date", sinceDate)
        .limit(2000);
      return data ?? [];
    },
  });

  const { data: passes = [] } = useQuery({
    queryKey: ["pt-reports-passes", sinceDate],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_passes")
        .select("id, price_cents_charged, activated_at")
        .gte("activated_at", sinceDate)
        .limit(2000);
      return data ?? [];
    },
  });

  const { data: trainers = [] } = useQuery({
    queryKey: ["pt-reports-trainers"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("instructors").select("id, name");
      return data ?? [];
    },
  });

  const trainerName = useMemo(() => {
    const m: Record<string, string> = {};
    trainers.forEach((t: any) => { m[t.id] = t.name; });
    return m;
  }, [trainers]);

  const kpis = useMemo(() => {
    const completed = appts.filter((a: any) => a.status === "completed");
    const noShows = appts.filter((a: any) => a.status === "no_show");
    const cancelled = appts.filter((a: any) => a.status === "cancelled");
    const packageRevenue = passes.reduce((s: number, p: any) => s + (p.price_cents_charged || 0), 0);
    const sessionRevenue = appts
      .filter((a: any) => a.payment_status === "paid")
      .reduce((s: number, a: any) => s + (a.price_cents || 0), 0);
    const unpaid = appts.filter((a: any) => a.payment_status === "unpaid");
    return {
      completed: completed.length,
      noShowRate: appts.length ? Math.round((noShows.length / appts.length) * 100) : 0,
      cancelled: cancelled.length,
      revenue: packageRevenue + sessionRevenue,
      outstanding: unpaid.reduce((s: number, a: any) => s + (a.price_cents || 0), 0),
    };
  }, [appts, passes]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; completed: number; noShow: number; cancelled: number }>();
    appts.forEach((a: any) => {
      const key = a.session_date.slice(0, 7);
      const row = map.get(key) ?? { month: key, completed: 0, noShow: 0, cancelled: 0 };
      if (a.status === "completed") row.completed += 1;
      if (a.status === "no_show") row.noShow += 1;
      if (a.status === "cancelled") row.cancelled += 1;
      map.set(key, row);
    });
    return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [appts]);

  const byTrainer = useMemo(() => {
    const map = new Map<string, { id: string; completed: number; noShow: number; total: number }>();
    appts.forEach((a: any) => {
      if (!a.instructor_id) return;
      const row = map.get(a.instructor_id) ?? { id: a.instructor_id, completed: 0, noShow: 0, total: 0 };
      row.total += 1;
      if (a.status === "completed") row.completed += 1;
      if (a.status === "no_show") row.noShow += 1;
      map.set(a.instructor_id, row);
    });
    return [...map.values()].sort((a, b) => b.completed - a.completed);
  }, [appts]);

  const monthColumns: PTColumn<any>[] = [
    { key: "m", header: "Month", render: (r) => fmtDate(new Date(`${r.month}-01T12:00:00`), "MMMM yyyy") },
    { key: "c", header: "Completed", align: "right", render: (r) => r.completed },
    { key: "n", header: "No-shows", align: "right", render: (r) => r.noShow },
    { key: "x", header: "Cancelled", align: "right", render: (r) => r.cancelled },
  ];

  const trainerColumns: PTColumn<any>[] = [
    { key: "t", header: "Trainer", render: (r) => trainerName[r.id] ?? "—" },
    { key: "total", header: "Booked", align: "right", render: (r) => r.total },
    { key: "c", header: "Completed", align: "right", render: (r) => r.completed },
    { key: "n", header: "No-shows", align: "right", render: (r) => r.noShow },
    {
      key: "rate", header: "Show rate", align: "right",
      render: (r) => (r.total ? `${Math.round((r.completed / r.total) * 100)}%` : "—"),
    },
  ];

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Insights"
        title="Reports"
        subtitle={`Personal training performance since ${fmtDate(since, "MMMM yyyy")}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <PTKpiCard label="Sessions completed" value={kpis.completed} icon={CalendarCheck} />
        <PTKpiCard label="Revenue" value={formatCents(kpis.revenue)} icon={DollarSign} tone="gold" />
        <PTKpiCard label="No-show rate" value={`${kpis.noShowRate}%`} icon={UserX} tone={kpis.noShowRate > 10 ? "red" : "default"} />
        <PTKpiCard label="Unpaid sessions" value={formatCents(kpis.outstanding)} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <PTSectionTitle>Sessions by month</PTSectionTitle>
          <PTCard padded={false}>
            <PTTable
              columns={monthColumns}
              rows={byMonth}
              loading={loadingAppts}
              getRowKey={(r) => r.month}
              empty={<PTEmptyState icon={BarChart3} title="No session data yet" />}
            />
          </PTCard>
        </div>
        <div>
          <PTSectionTitle>Trainer performance</PTSectionTitle>
          <PTCard padded={false}>
            <PTTable
              columns={trainerColumns}
              rows={byTrainer}
              loading={loadingAppts}
              getRowKey={(r) => r.id}
              empty={<PTEmptyState icon={Users} title="No trainer activity yet" />}
            />
          </PTCard>
        </div>
      </div>
    </PTShell>
  );
}
