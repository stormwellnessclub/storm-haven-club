import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format as fmtDate } from "date-fns";
import { TrendingUp, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTTabs, PTBadge,
} from "@/components/admin/pt/PTUI";
import { usePTPeople } from "@/hooks/pt/usePTPortal";
import { Input } from "@/components/ui/input";

type Tab = "metrics" | "prs" | "tests" | "milestones";

export default function PTProgress() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("metrics");
  const [q, setQ] = useState("");

  const { data: metrics = [], isLoading: loadingMetrics } = useQuery({
    queryKey: ["pt-progress-metrics"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_body_metrics")
        .select("id, user_id, measured_on, weight_lbs, body_fat_pct, muscle_mass_lbs, waist_in")
        .order("measured_on", { ascending: false }).limit(150);
      return data ?? [];
    },
  });
  const { data: prs = [], isLoading: loadingPrs } = useQuery({
    queryKey: ["pt-progress-prs"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_prs").select("id, user_id, exercise, weight_lbs, reps, achieved_on")
        .order("achieved_on", { ascending: false }).limit(150);
      return data ?? [];
    },
  });
  const { data: tests = [], isLoading: loadingTests } = useQuery({
    queryKey: ["pt-progress-tests"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_performance_tests").select("id, user_id, test_name, value, unit, tested_on, is_reassessment")
        .order("tested_on", { ascending: false }).limit(150);
      return data ?? [];
    },
  });
  const { data: milestones = [], isLoading: loadingMs } = useQuery({
    queryKey: ["pt-progress-milestones"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_milestones").select("id, user_id, title, milestone_type, achieved_on, target_date, is_achieved")
        .order("created_at", { ascending: false }).limit(150);
      return data ?? [];
    },
  });

  const allIds = useMemo(
    () => [...metrics, ...prs, ...tests, ...milestones].map((r: any) => r.user_id),
    [metrics, prs, tests, milestones],
  );
  const { data: people = {} } = usePTPeople(allIds);

  const filter = (rows: any[]) => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => (people[r.user_id]?.name ?? "").toLowerCase().includes(term));
  };

  const clientCol: PTColumn<any> = {
    key: "client", header: "Client", render: (r) => people[r.user_id]?.name ?? "—",
  };

  const configs: Record<Tab, { rows: any[]; loading: boolean; columns: PTColumn<any>[]; empty: string }> = {
    metrics: {
      rows: filter(metrics), loading: loadingMetrics, empty: "No body measurements recorded yet",
      columns: [
        { key: "d", header: "Date", render: (r) => fmtDate(new Date(`${r.measured_on}T12:00:00`), "MMM d, yyyy") },
        clientCol,
        { key: "w", header: "Weight", align: "right", render: (r) => (r.weight_lbs ? `${r.weight_lbs} lb` : "—") },
        { key: "bf", header: "Body fat", align: "right", render: (r) => (r.body_fat_pct ? `${r.body_fat_pct}%` : "—") },
        { key: "mm", header: "Muscle", align: "right", render: (r) => (r.muscle_mass_lbs ? `${r.muscle_mass_lbs} lb` : "—") },
        { key: "wa", header: "Waist", align: "right", render: (r) => (r.waist_in ? `${r.waist_in} in` : "—") },
      ],
    },
    prs: {
      rows: filter(prs), loading: loadingPrs, empty: "No personal records logged yet",
      columns: [
        { key: "d", header: "Date", render: (r) => fmtDate(new Date(`${r.achieved_on}T12:00:00`), "MMM d, yyyy") },
        clientCol,
        { key: "e", header: "Exercise", render: (r) => r.exercise },
        { key: "l", header: "Result", align: "right", render: (r) => `${r.weight_lbs ?? "—"} lb × ${r.reps ?? "—"}` },
      ],
    },
    tests: {
      rows: filter(tests), loading: loadingTests, empty: "No performance tests recorded yet",
      columns: [
        { key: "d", header: "Date", render: (r) => fmtDate(new Date(`${r.tested_on}T12:00:00`), "MMM d, yyyy") },
        clientCol,
        { key: "t", header: "Test", render: (r) => r.test_name },
        { key: "v", header: "Result", align: "right", render: (r) => [r.value, r.unit].filter(Boolean).join(" ") || "—" },
        { key: "r", header: "", align: "right", render: (r) => (r.is_reassessment ? <PTBadge tone="gold">Reassessment</PTBadge> : null) },
      ],
    },
    milestones: {
      rows: filter(milestones), loading: loadingMs, empty: "No milestones set yet",
      columns: [
        clientCol,
        { key: "t", header: "Milestone", render: (r) => r.title },
        { key: "ty", header: "Type", render: (r) => r.milestone_type ?? "—" },
        { key: "d", header: "Target", render: (r) => (r.target_date ? fmtDate(new Date(`${r.target_date}T12:00:00`), "MMM d, yyyy") : "—") },
        { key: "s", header: "", align: "right", render: (r) => (r.is_achieved ? <PTBadge tone="green">Achieved</PTBadge> : <PTBadge>In progress</PTBadge>) },
      ],
    },
  };

  const cfg = configs[tab];

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Results"
        title="Progress Tracking"
        subtitle="Measurements, strength records, performance tests and milestones."
      />
      <PTCard padded={false}>
        <div className="px-3 pt-1">
          <PTTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "metrics", label: "Measurements", count: metrics.length },
              { value: "prs", label: "Strength PRs", count: prs.length },
              { value: "tests", label: "Performance tests", count: tests.length },
              { value: "milestones", label: "Milestones", count: milestones.length },
            ]}
          />
        </div>
        <div className="p-3 border-b border-pt-line flex items-center gap-2">
          <Search className="h-4 w-4 text-pt-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by client name"
            className="h-8 border-pt-line bg-white text-[13px]"
          />
        </div>
        <PTTable
          columns={cfg.columns}
          rows={cfg.rows}
          loading={cfg.loading}
          getRowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/admin/pt/clients/${r.user_id}`)}
          empty={<PTEmptyState icon={TrendingUp} title={cfg.empty} description="Records added from a client profile show up here." />}
        />
      </PTCard>
    </PTShell>
  );
}
