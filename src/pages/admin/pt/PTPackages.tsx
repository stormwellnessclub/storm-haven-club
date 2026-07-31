import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format as fmtDate } from "date-fns";
import { Package, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTBadge, PTTabs,
  PTKpiCard, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { usePTPeople } from "@/hooks/pt/usePTPortal";
import { PT_FORMAT_LABEL, formatCents, PtFormat } from "@/lib/ptFormat";
import { SellPTDialog } from "@/components/admin/SellPTDialog";

type Tab = "sold" | "catalog";

export default function PTPackages() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("sold");
  const [sellOpen, setSellOpen] = useState(false);

  const { data: passes = [], isLoading: loadingPasses } = useQuery({
    queryKey: ["pt-packages-passes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_passes")
        .select("id, user_id, pack_name, format, sessions_total, sessions_remaining, status, activated_at, expires_at, price_cents_charged")
        .order("created_at", { ascending: false })
        .limit(250);
      return data ?? [];
    },
  });

  const { data: packs = [], isLoading: loadingPacks } = useQuery({
    queryKey: ["pt-packages-catalog"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_packs")
        .select("id, name, format, sessions, price_cents, expiration_days, is_active, is_public, display_order")
        .order("display_order", { ascending: true });
      return data ?? [];
    },
  });

  const { data: people = {} } = usePTPeople(passes.map((p: any) => p.user_id));

  const stats = useMemo(() => {
    const active = passes.filter((p: any) => p.status === "active");
    return {
      active: active.length,
      banked: active.reduce((s: number, p: any) => s + (p.sessions_remaining || 0), 0),
      lowBalance: active.filter((p: any) => p.sessions_remaining > 0 && p.sessions_remaining <= 2).length,
      expiringSoon: active.filter((p: any) => {
        const d = new Date(`${p.expires_at}T12:00:00`);
        const days = (d.getTime() - Date.now()) / 86400000;
        return days <= 30;
      }).length,
    };
  }, [passes]);

  const passColumns: PTColumn<any>[] = [
    { key: "client", header: "Client", render: (p) => people[p.user_id]?.name ?? "—" },
    { key: "pack", header: "Package", render: (p) => p.pack_name },
    { key: "format", header: "Format", render: (p) => PT_FORMAT_LABEL[p.format as PtFormat] ?? p.format },
    {
      key: "sessions", header: "Sessions", align: "right",
      render: (p) => (
        <span className={p.sessions_remaining <= 2 ? "text-pt-red font-medium" : ""}>
          {p.sessions_remaining} / {p.sessions_total}
        </span>
      ),
    },
    { key: "activated", header: "Activated", render: (p) => fmtDate(new Date(`${p.activated_at}T12:00:00`), "MMM d, yyyy") },
    { key: "expires", header: "Expires", render: (p) => fmtDate(new Date(`${p.expires_at}T12:00:00`), "MMM d, yyyy") },
    { key: "paid", header: "Paid", align: "right", render: (p) => formatCents(p.price_cents_charged || 0) },
    { key: "status", header: "", align: "right", render: (p) => <PTBadge tone={p.status === "active" ? "green" : "neutral"}><span className="capitalize">{p.status}</span></PTBadge> },
  ];

  const packColumns: PTColumn<any>[] = [
    { key: "name", header: "Package", render: (p) => p.name },
    { key: "format", header: "Format", render: (p) => PT_FORMAT_LABEL[p.format as PtFormat] ?? p.format },
    { key: "sessions", header: "Sessions", align: "right", render: (p) => p.sessions },
    { key: "price", header: "Price", align: "right", render: (p) => formatCents(p.price_cents) },
    { key: "exp", header: "Valid for", align: "right", render: (p) => `${p.expiration_days} days` },
    {
      key: "state", header: "", align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          {p.is_public && <PTBadge tone="gold">Public</PTBadge>}
          <PTBadge tone={p.is_active ? "green" : "neutral"}>{p.is_active ? "Active" : "Archived"}</PTBadge>
        </div>
      ),
    },
  ];

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Revenue"
        title="Packages"
        subtitle="Sold packages, remaining balances and the package catalog."
        actions={
          <>
            <button className={ptButtonClass("outline")} onClick={() => navigate("/admin/personal-training/packs")}>
              Edit catalog
            </button>
            <button className={ptButtonClass("primary")} onClick={() => setSellOpen(true)}>
              <Plus className="h-4 w-4" /> Sell package
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <PTKpiCard label="Active packages" value={stats.active} icon={Package} />
        <PTKpiCard label="Sessions banked" value={stats.banked} tone="gold" />
        <PTKpiCard label="Low balance" value={stats.lowBalance} tone="amber" hint="2 or fewer sessions left" />
        <PTKpiCard label="Expiring in 30 days" value={stats.expiringSoon} tone="red" />
      </div>

      <PTCard padded={false}>
        <div className="px-3 pt-1">
          <PTTabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "sold", label: "Client packages", count: passes.length },
              { value: "catalog", label: "Catalog", count: packs.length },
            ]}
          />
        </div>
        {tab === "sold" ? (
          <PTTable
            columns={passColumns}
            rows={passes}
            loading={loadingPasses}
            getRowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/admin/pt/clients/${p.user_id}`)}
            empty={<PTEmptyState icon={Package} title="No packages sold yet" description="Sell a package to start tracking session balances." />}
          />
        ) : (
          <PTTable
            columns={packColumns}
            rows={packs}
            loading={loadingPacks}
            getRowKey={(p) => p.id}
            empty={<PTEmptyState icon={Package} title="No packages in the catalog" />}
          />
        )}
      </PTCard>

      <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} />
    </PTShell>
  );
}
