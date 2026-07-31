import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTBadge, ptButtonClass,
} from "@/components/admin/pt/PTUI";

export default function PTTrainers() {
  const navigate = useNavigate();

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: ["pt-trainers-directory"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("instructors")
        .select("id, first_name, last_name, email, phone, specialties, employment_status, schedule_color, is_active, is_public_pt")
        .order("first_name", { ascending: true });
      return (data ?? []).map((t: any) => ({ ...t, name: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() }));
    },
  });

  const { data: upcoming = {} } = useQuery({
    queryKey: ["pt-trainers-upcoming"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data } = await (supabase as any)
        .from("pt_appointments")
        .select("instructor_id")
        .gte("starts_at", new Date().toISOString())
        .eq("status", "scheduled");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (r.instructor_id) counts[r.instructor_id] = (counts[r.instructor_id] || 0) + 1;
      });
      return counts;
    },
  });

  const activeCount = useMemo(() => trainers.filter((t: any) => t.is_active).length, [trainers]);

  const columns: PTColumn<any>[] = [
    {
      key: "name",
      header: "Trainer",
      render: (t) => (
        <div className="flex items-center gap-2.5">
          <span
            className="h-6 w-6 rounded-full border border-pt-line shrink-0"
            style={{ background: t.schedule_color || "hsl(var(--pt-gold))" }}
          />
          <div className="min-w-0">
            <div className="text-pt-ink font-medium">{t.name}</div>
            <div className="text-xs text-pt-muted truncate">{t.email || t.phone || "—"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "specialties",
      header: "Specialties",
      render: (t) => {
        const list: string[] = Array.isArray(t.specialties) ? t.specialties : [];
        if (!list.length) return <span className="text-pt-muted">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {list.slice(0, 3).map((s) => <PTBadge key={s}>{s}</PTBadge>)}
            {list.length > 3 && <PTBadge>+{list.length - 3}</PTBadge>}
          </div>
        );
      },
    },
    {
      key: "employment",
      header: "Employment",
      render: (t) => <span className="capitalize">{(t.employment_status || "—").replace(/_/g, " ")}</span>,
    },
    {
      key: "upcoming",
      header: "Upcoming sessions",
      align: "right",
      render: (t) => upcoming[t.id] ?? 0,
    },
    {
      key: "status",
      header: "",
      align: "right",
      render: (t) => (
        <div className="flex justify-end gap-1">
          {t.is_public_pt && <PTBadge tone="gold">PT</PTBadge>}
          <PTBadge tone={t.is_active ? "green" : "neutral"}>{t.is_active ? "Active" : "Inactive"}</PTBadge>
        </div>
      ),
    },
  ];

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Team"
        title="Trainers"
        subtitle={`${activeCount} active on the roster.`}
        actions={
          <button className={ptButtonClass("outline")} onClick={() => navigate("/admin/personal-training/availability")}>
            <CalendarClock className="h-4 w-4" /> Manage availability
          </button>
        }
      />
      <PTCard padded={false}>
        <PTTable
          columns={columns}
          rows={trainers}
          loading={isLoading}
          getRowKey={(t) => t.id}
          empty={<PTEmptyState icon={Users} title="No trainers yet" description="Add instructors to build the training team." />}
        />
      </PTCard>
    </PTShell>
  );
}
