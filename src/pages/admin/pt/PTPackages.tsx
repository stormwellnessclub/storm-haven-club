import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format as fmtDate } from "date-fns";
import { Package, Plus, Download, ArrowLeftRight, SlidersHorizontal, BellRing, History, CalendarCheck, ClipboardList } from "lucide-react";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTBadge, PTTabs,
  PTKpiCard, PTModal, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { usePTPeople } from "@/hooks/pt/usePTPortal";
import { PT_FORMAT_LABEL, formatCents, PtFormat } from "@/lib/ptFormat";
import { SellPTDialog } from "@/components/admin/SellPTDialog";
import {
  usePTPasses, usePTPacks, usePTPassAdjustments, usePTPassUsage, usePTPackageMutations,
  daysUntil, PTPassRow,
} from "@/hooks/pt/usePTPackages";
import { downloadCsv } from "@/lib/ptExport";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AddExistingPackageDialog, ApplyPastSessionsDialog, RecordHistoricalSessionDialog, PackageHistoryModal,
} from "@/components/admin/pt/PTPackageWorkflows";

type Tab = "active" | "expiring" | "expired" | "usage" | "adjustments" | "catalog";

export default function PTPackages() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("active");
  const [sellOpen, setSellOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adjustPass, setAdjustPass] = useState<PTPassRow | null>(null);
  const [transferFrom, setTransferFrom] = useState<PTPassRow | null>(null);
  const [addExistingMode, setAddExistingMode] = useState<"existing" | "transfer" | null>(null);
  const [applyPastPass, setApplyPastPass] = useState<PTPassRow | null>(null);
  const [historicalPass, setHistoricalPass] = useState<PTPassRow | null>(null);
  const [historyPass, setHistoryPass] = useState<PTPassRow | null>(null);

  const { data: passes = [], isLoading: loadingPasses } = usePTPasses();
  const { data: packs = [], isLoading: loadingPacks } = usePTPacks();
  const { data: adjustments = [], isLoading: loadingAdj } = usePTPassAdjustments();
  const { data: usage = [], isLoading: loadingUsage } = usePTPassUsage();
  const { adjust, transfer, logReminder } = usePTPackageMutations();

  const { data: people = {} } = usePTPeople(passes.map((p) => p.user_id));
  const passById = useMemo(() => Object.fromEntries(passes.map((p) => [p.id, p])), [passes]);
  const nameOf = (userId?: string | null) => (userId ? people[userId]?.name ?? "—" : "—");

  const matches = (p: PTPassRow) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (nameOf(p.user_id).toLowerCase().includes(q) || p.pack_name?.toLowerCase().includes(q));
  };

  const activeRows = passes.filter((p) => p.status === "active" && matches(p));
  const expiringRows = activeRows.filter((p) => daysUntil(p.expires_at) <= 30 && daysUntil(p.expires_at) >= 0);
  const expiredRows = passes.filter((p) => (p.status === "expired" || daysUntil(p.expires_at) < 0) && p.status !== "refunded" && matches(p));

  const stats = useMemo(() => {
    const active = passes.filter((p) => p.status === "active");
    const sold = active.reduce((s, p) => s + (p.sessions_total || 0), 0);
    const used = active.reduce((s, p) => s + ((p.sessions_total || 0) - (p.sessions_remaining || 0)), 0);
    return {
      active: active.length,
      banked: active.reduce((s, p) => s + (p.sessions_remaining || 0), 0),
      lowBalance: active.filter((p) => p.sessions_remaining > 0 && p.sessions_remaining <= 2).length,
      expiring: active.filter((p) => daysUntil(p.expires_at) <= 30 && daysUntil(p.expires_at) >= 0).length,
      utilization: sold ? Math.round((used / sold) * 100) : 0,
    };
  }, [passes]);

  const baseColumns: PTColumn<PTPassRow>[] = [
    { key: "client", header: "Client", render: (p) => nameOf(p.user_id) },
    { key: "pack", header: "Package", render: (p) => p.pack_name },
    { key: "format", header: "Format", render: (p) => PT_FORMAT_LABEL[p.format as PtFormat] ?? p.format },
    {
      key: "sessions", header: "Balance", align: "right",
      render: (p) => (
        <span className={p.sessions_remaining <= 2 ? "text-pt-red font-medium" : ""}>
          {p.sessions_remaining} / {p.sessions_total}
        </span>
      ),
    },
    { key: "activated", header: "Activated", render: (p) => (p.activated_at ? fmtDate(new Date(`${p.activated_at}T12:00:00`), "MMM d, yyyy") : "—") },
    {
      key: "expires", header: "Expires",
      render: (p) => {
        const d = daysUntil(p.expires_at);
        return (
          <span className={d < 0 ? "text-pt-muted" : d <= 14 ? "text-pt-red font-medium" : d <= 30 ? "text-pt-amber" : ""}>
            {p.expires_at ? fmtDate(new Date(`${p.expires_at}T12:00:00`), "MMM d, yyyy") : "—"}
            {d >= 0 && d <= 30 ? ` · ${d}d` : ""}
          </span>
        );
      },
    },
    { key: "paid", header: "Paid", align: "right", render: (p) => formatCents(p.price_cents_charged || 0) },
    {
      key: "actions", header: "", align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <button
            className="text-pt-muted hover:text-pt-gold transition-colors p-1"
            title="Adjust balance"
            onClick={(e) => { e.stopPropagation(); setAdjustPass(p); }}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            className="text-pt-muted hover:text-pt-gold transition-colors p-1"
            title="Transfer sessions"
            onClick={(e) => { e.stopPropagation(); setTransferFrom(p); }}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <button
            className="text-pt-muted hover:text-pt-gold transition-colors p-1"
            title="Apply past sessions"
            onClick={(e) => { e.stopPropagation(); setApplyPastPass(p); }}
          >
            <CalendarCheck className="h-4 w-4" />
          </button>
          <button
            className="text-pt-muted hover:text-pt-gold transition-colors p-1"
            title="Record a historical session"
            onClick={(e) => { e.stopPropagation(); setHistoricalPass(p); }}
          >
            <ClipboardList className="h-4 w-4" />
          </button>
          <button
            className="text-pt-muted hover:text-pt-gold transition-colors p-1"
            title="Package history"
            onClick={(e) => { e.stopPropagation(); setHistoryPass(p); }}
          >
            <History className="h-4 w-4" />
          </button>
          <button
            className="text-pt-muted hover:text-pt-gold transition-colors p-1"
            title="Log renewal reminder"
            onClick={(e) => { e.stopPropagation(); logReminder.mutate({ passId: p.id }); }}
          >
            <BellRing className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const expiringColumns: PTColumn<PTPassRow>[] = [
    ...baseColumns.slice(0, 6),
    {
      key: "reminder", header: "Last reminder",
      render: (p) => (p.renewal_reminder_sent_at
        ? `${fmtDate(new Date(p.renewal_reminder_sent_at), "MMM d")} (${p.renewal_reminder_count})`
        : <span className="text-pt-muted">Never</span>),
    },
    baseColumns[baseColumns.length - 1],
  ];

  const usageColumns: PTColumn<any>[] = [
    { key: "when", header: "Used", render: (u) => fmtDate(new Date(u.used_at), "MMM d, yyyy h:mm a") },
    { key: "client", header: "Client", render: (u) => nameOf(passById[u.pass_id]?.user_id) },
    { key: "pack", header: "Package", render: (u) => passById[u.pass_id]?.pack_name ?? "—" },
    { key: "notes", header: "Notes", render: (u) => u.notes || <span className="text-pt-muted">—</span> },
  ];

  const adjustmentColumns: PTColumn<any>[] = [
    { key: "when", header: "Date & time", render: (a) => fmtDate(new Date(a.created_at), "MMM d, yyyy h:mm a") },
    { key: "client", header: "Client", render: (a) => nameOf(a.user_id) },
    { key: "pack", header: "Package", render: (a) => passById[a.pass_id]?.pack_name ?? "—" },
    { key: "type", header: "Type", render: (a) => <PTBadge tone={a.delta_sessions >= 0 ? "green" : "amber"}><span className="capitalize">{(a.adjustment_type || "manual").replace(/_/g, " ")}</span></PTBadge> },
    { key: "prev", header: "Previous", align: "right", render: (a) => a.sessions_before },
    { key: "delta", header: "Change", align: "right", render: (a) => (a.delta_sessions > 0 ? `+${a.delta_sessions}` : a.delta_sessions) },
    { key: "next", header: "New", align: "right", render: (a) => a.sessions_after },
    { key: "reason", header: "Reason", render: (a) => a.reason || "—" },
    { key: "staff", header: "Staff", render: (a) => nameOf(a.created_by) !== "—" ? nameOf(a.created_by) : (a.created_by ? "Staff" : "System") },
  ];

  const packColumns: PTColumn<any>[] = [
    { key: "name", header: "Package", render: (p) => p.name },
    { key: "format", header: "Format", render: (p) => PT_FORMAT_LABEL[p.format as PtFormat] ?? p.format },
    { key: "sessions", header: "Sessions", align: "right", render: (p) => p.sessions },
    { key: "price", header: "Price", align: "right", render: (p) => formatCents(p.price_cents) },
    { key: "exp", header: "Valid for", align: "right", render: (p) => `${p.expiration_days} days` },
    { key: "plan", header: "Payment plan", render: (p) => (p.allow_payment_plan ? `${p.payment_plan_months} mo` : "—") },
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

  function exportCurrent() {
    if (tab === "adjustments") {
      downloadCsv("pt-package-adjustments", adjustments.map((a) => ({
        date: a.created_at, client: nameOf(a.user_id), package: passById[a.pass_id]?.pack_name ?? "",
        type: a.adjustment_type, previous_balance: a.sessions_before, change: a.delta_sessions,
        new_balance: a.sessions_after, reason: a.reason ?? "", staff: a.created_by ?? "",
      })));
      return;
    }
    if (tab === "usage") {
      downloadCsv("pt-package-usage", usage.map((u) => ({
        used_at: u.used_at, client: nameOf(passById[u.pass_id]?.user_id), package: passById[u.pass_id]?.pack_name ?? "", notes: u.notes ?? "",
      })));
      return;
    }
    if (tab === "catalog") {
      downloadCsv("pt-package-catalog", packs.map((p: any) => ({
        name: p.name, format: p.format, sessions: p.sessions, price: (p.price_cents || 0) / 100,
        expiration_days: p.expiration_days, active: p.is_active, public: p.is_public,
      })));
      return;
    }
    const rows = tab === "expiring" ? expiringRows : tab === "expired" ? expiredRows : activeRows;
    downloadCsv(`pt-packages-${tab}`, rows.map((p) => ({
      client: nameOf(p.user_id), package: p.pack_name, format: p.format,
      remaining: p.sessions_remaining, total: p.sessions_total,
      activated: p.activated_at, expires: p.expires_at, status: p.status,
      paid: (p.price_cents_charged || 0) / 100,
    })));
  }

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Revenue"
        title="Packages"
        subtitle="Balances, expirations, usage history and every manual adjustment."
        actions={
          <>
            <button className={ptButtonClass("outline")} onClick={exportCurrent}>
              <Download className="h-4 w-4" /> Export
            </button>
            <button className={ptButtonClass("outline")} onClick={() => navigate("/admin/personal-training/packs")}>
              Edit catalog
            </button>
            <button className={ptButtonClass("outline")} onClick={() => setAddExistingMode("transfer")}>
              Transferred package
            </button>
            <button className={ptButtonClass("outline")} onClick={() => setAddExistingMode("existing")}>
              <Plus className="h-4 w-4" /> Existing package
            </button>
            <button className={ptButtonClass("primary")} onClick={() => setSellOpen(true)}>
              <Plus className="h-4 w-4" /> Sell package
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 mb-6">
        <PTKpiCard label="Active packages" value={stats.active} icon={Package} />
        <PTKpiCard label="Sessions banked" value={stats.banked} tone="gold" />
        <PTKpiCard label="Low balance" value={stats.lowBalance} tone="amber" hint="2 or fewer left" />
        <PTKpiCard label="Expiring in 30 days" value={stats.expiring} tone="red" />
        <PTKpiCard label="Utilization" value={`${stats.utilization}%`} hint="Sessions used vs sold" />
      </div>

      <PTCard padded={false}>
        <div className="px-3 pt-1 flex flex-wrap items-center justify-between gap-2">
          <PTTabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "active", label: "Active balances", count: activeRows.length },
              { value: "expiring", label: "Expiring", count: expiringRows.length },
              { value: "expired", label: "Expired", count: expiredRows.length },
              { value: "usage", label: "Usage history" },
              { value: "adjustments", label: "Adjustments" },
              { value: "catalog", label: "Catalog", count: packs.length },
            ]}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or package…"
            className="h-9 w-56 border-pt-line bg-white"
          />
        </div>

        {tab === "active" && (
          <PTTable columns={baseColumns} rows={activeRows} loading={loadingPasses} getRowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/admin/pt/clients/${p.user_id}`)}
            empty={<PTEmptyState icon={Package} title="No active packages" description="Sell a package to start tracking balances." />} />
        )}
        {tab === "expiring" && (
          <PTTable columns={expiringColumns} rows={expiringRows} loading={loadingPasses} getRowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/admin/pt/clients/${p.user_id}`)}
            empty={<PTEmptyState icon={BellRing} title="Nothing expiring" description="No active package expires within 30 days." />} />
        )}
        {tab === "expired" && (
          <PTTable columns={baseColumns.slice(0, 7)} rows={expiredRows} loading={loadingPasses} getRowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/admin/pt/clients/${p.user_id}`)}
            empty={<PTEmptyState icon={Package} title="No expired packages" />} />
        )}
        {tab === "usage" && (
          <PTTable columns={usageColumns} rows={usage} loading={loadingUsage} getRowKey={(u) => u.id}
            empty={<PTEmptyState icon={History} title="No session usage recorded yet" />} />
        )}
        {tab === "adjustments" && (
          <PTTable columns={adjustmentColumns} rows={adjustments} loading={loadingAdj} getRowKey={(a) => a.id}
            empty={<PTEmptyState icon={SlidersHorizontal} title="No adjustments" description="Manual balance changes and transfers appear here with full audit detail." />} />
        )}
        {tab === "catalog" && (
          <PTTable columns={packColumns} rows={packs} loading={loadingPacks} getRowKey={(p) => p.id}
            empty={<PTEmptyState icon={Package} title="No packages in the catalog" />} />
        )}
      </PTCard>

      <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} />
      <AddExistingPackageDialog
        open={addExistingMode !== null}
        onOpenChange={(v) => !v && setAddExistingMode(null)}
        mode={addExistingMode ?? "existing"}
      />
      <ApplyPastSessionsDialog
        pass={applyPastPass}
        clientName={applyPastPass ? nameOf(applyPastPass.user_id) : ""}
        onClose={() => setApplyPastPass(null)}
      />
      <RecordHistoricalSessionDialog
        pass={historicalPass}
        clientName={historicalPass ? nameOf(historicalPass.user_id) : ""}
        onClose={() => setHistoricalPass(null)}
      />
      <PackageHistoryModal
        pass={historyPass}
        clientName={historyPass ? nameOf(historyPass.user_id) : ""}
        onClose={() => setHistoryPass(null)}
      />
      <AdjustDialog
        pass={adjustPass}
        clientName={adjustPass ? nameOf(adjustPass.user_id) : ""}
        onClose={() => setAdjustPass(null)}
        onSubmit={async (input) => { await adjust.mutateAsync({ passId: adjustPass!.id, ...input }); setAdjustPass(null); }}
        pending={adjust.isPending}
      />
      <TransferDialog
        from={transferFrom}
        passes={passes}
        nameOf={nameOf}
        onClose={() => setTransferFrom(null)}
        onSubmit={async (input) => { await transfer.mutateAsync({ fromPassId: transferFrom!.id, ...input }); setTransferFrom(null); }}
        pending={transfer.isPending}
      />
    </PTShell>
  );
}

function AdjustDialog({
  pass, clientName, onClose, onSubmit, pending,
}: {
  pass: PTPassRow | null;
  clientName: string;
  onClose: () => void;
  onSubmit: (input: { delta: number; reason: string; adjustmentType: string; newExpiresAt?: string | null }) => Promise<void>;
  pending: boolean;
}) {
  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("");
  const [type, setType] = useState("manual");
  const [expires, setExpires] = useState("");

  const parsed = Number(delta) || 0;
  const after = pass ? Math.max(0, pass.sessions_remaining + parsed) : 0;

  return (
    <PTModal
      open={!!pass}
      onOpenChange={(v) => !v && onClose()}
      title="Adjust package balance"
      description={pass ? `${clientName} · ${pass.pack_name}` : ""}
      size="sm"
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={onClose}>Cancel</button>
          <button
            className={ptButtonClass("primary")}
            disabled={!reason.trim() || !parsed || pending}
            onClick={() => onSubmit({ delta: parsed, reason: reason.trim(), adjustmentType: type, newExpiresAt: expires || null })}
          >
            Save adjustment
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-pt-line bg-pt-cream/40 px-3 py-2 text-sm">
          Previous balance <strong>{pass?.sessions_remaining ?? 0}</strong> → new balance <strong>{after}</strong>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-pt-muted">Session change (+/-)</label>
            <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} className="border-pt-line bg-white" />
          </div>
          <div>
            <label className="text-xs text-pt-muted">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["manual", "comp", "correction", "refund", "expiry_extension", "goodwill"].map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-xs text-pt-muted">New expiration (optional)</label>
          <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="border-pt-line bg-white" />
        </div>
        <div>
          <label className="text-xs text-pt-muted">Reason (required — recorded in the audit log)</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border-pt-line bg-white" />
        </div>
      </div>
    </PTModal>
  );
}

function TransferDialog({
  from, passes, nameOf, onClose, onSubmit, pending,
}: {
  from: PTPassRow | null;
  passes: PTPassRow[];
  nameOf: (id?: string | null) => string;
  onClose: () => void;
  onSubmit: (input: { toPassId: string; sessions: number; reason: string }) => Promise<void>;
  pending: boolean;
}) {
  const [toPassId, setToPassId] = useState("");
  const [sessions, setSessions] = useState("1");
  const [reason, setReason] = useState("");

  const targets = passes.filter((p) => p.id !== from?.id && p.status !== "refunded" && p.status !== "cancelled");

  return (
    <PTModal
      open={!!from}
      onOpenChange={(v) => !v && onClose()}
      title="Transfer sessions"
      description={from ? `From ${nameOf(from.user_id)} · ${from.pack_name} (${from.sessions_remaining} left)` : ""}
      size="sm"
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={onClose}>Cancel</button>
          <button
            className={ptButtonClass("primary")}
            disabled={!toPassId || !reason.trim() || !(Number(sessions) > 0) || pending}
            onClick={() => onSubmit({ toPassId, sessions: Number(sessions), reason: reason.trim() })}
          >
            Transfer
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs text-pt-muted">Destination package</label>
          <Select value={toPassId} onValueChange={setToPassId}>
            <SelectTrigger className="border-pt-line bg-white"><SelectValue placeholder="Choose package" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {targets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {nameOf(p.user_id)} · {p.pack_name} ({p.sessions_remaining} left)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-pt-muted">Sessions to move</label>
          <Input type="number" min={1} value={sessions} onChange={(e) => setSessions(e.target.value)} className="border-pt-line bg-white" />
        </div>
        <div>
          <label className="text-xs text-pt-muted">Reason (required)</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="border-pt-line bg-white" />
        </div>
      </div>
    </PTModal>
  );
}
