import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Dumbbell, CalendarClock, Package, ChevronRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PTShell, PTPageHeader, PTCard, PTSectionTitle, PTBadge, PTTable, PTColumn, PTEmptyState,
} from "@/components/admin/pt/PTUI";

export default function PTSettings() {
  const navigate = useNavigate();

  const { data: locations = [], isLoading: loadingLoc } = useQuery({
    queryKey: ["pt-settings-locations"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_locations").select("id, name, description, is_active").order("name");
      return data ?? [];
    },
  });

  const { data: sessionTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ["pt-settings-session-types"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_session_types")
        .select("id, name, duration_minutes, capacity, required_format, is_active")
        .order("name");
      return data ?? [];
    },
  });

  const locationColumns: PTColumn<any>[] = [
    { key: "n", header: "Location", render: (r) => r.name },
    { key: "d", header: "Notes", render: (r) => <span className="text-pt-muted">{r.description || "—"}</span> },
    { key: "s", header: "", align: "right", render: (r) => <PTBadge tone={r.is_active ? "green" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</PTBadge> },
  ];

  const typeColumns: PTColumn<any>[] = [
    { key: "n", header: "Session type", render: (r) => r.name },
    { key: "d", header: "Duration", align: "right", render: (r) => `${r.duration_minutes} min` },
    { key: "c", header: "Capacity", align: "right", render: (r) => r.capacity },
    { key: "f", header: "Requires", render: (r) => <span className="capitalize">{(r.required_format || "—").replace(/_/g, " ")}</span> },
    { key: "s", header: "", align: "right", render: (r) => <PTBadge tone={r.is_active ? "green" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</PTBadge> },
  ];

  const links = [
    { label: "Package catalog & pricing", description: "Create, price and archive PT packages.", to: "/admin/personal-training/packs", icon: Package },
    { label: "Trainer availability", description: "Set weekly working hours and time off.", to: "/admin/personal-training/availability", icon: CalendarClock },
    { label: "Unpaid session payments", description: "Charge or invoice sessions billed later.", to: "/admin/personal-training/unpaid", icon: FileText },
  ];

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Configuration"
        title="Settings"
        subtitle="Locations, session formats and everything that shapes the training operation."
      />

      <PTSectionTitle>Shortcuts</PTSectionTitle>
      <div className="grid gap-3 md:grid-cols-3 mb-8">
        {links.map((l) => (
          <button
            key={l.to}
            onClick={() => navigate(l.to)}
            className="text-left rounded-xl border border-pt-line bg-white p-4 hover:border-pt-gold hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <l.icon className="h-5 w-5 text-pt-gold" />
              <ChevronRight className="h-4 w-4 text-pt-muted group-hover:text-pt-gold transition-colors" />
            </div>
            <div className="mt-3 text-pt-ink font-medium">{l.label}</div>
            <div className="text-xs text-pt-muted mt-0.5">{l.description}</div>
          </button>
        ))}
      </div>

      <PTSectionTitle>Locations</PTSectionTitle>
      <PTCard padded={false} className="mb-8">
        <PTTable
          columns={locationColumns}
          rows={locations}
          loading={loadingLoc}
          getRowKey={(r) => r.id}
          empty={<PTEmptyState icon={MapPin} title="No locations configured" />}
        />
      </PTCard>

      <PTSectionTitle>Session types</PTSectionTitle>
      <PTCard padded={false}>
        <PTTable
          columns={typeColumns}
          rows={sessionTypes}
          loading={loadingTypes}
          getRowKey={(r) => r.id}
          empty={<PTEmptyState icon={Dumbbell} title="No session types configured" />}
        />
      </PTCard>
    </PTShell>
  );
}
