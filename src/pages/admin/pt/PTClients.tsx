import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format as fmtDate, parseISO, differenceInCalendarDays } from "date-fns";
import { Search, Plus, Users, Star, Bookmark, X, AlertTriangle } from "lucide-react";
import { formatCents, PT_FORMAT_LABEL } from "@/lib/ptFormat";
import {
  PTShell, PTPageHeader, PTCard, PTStatus, PTBadge, PTTable, PTEmptyState,
  ptButtonClass, PTKpiCard, PTModal,
} from "@/components/admin/pt/PTUI";
import { usePTTrainerMap, usePTTrainers } from "@/hooks/pt/usePTPortal";
import {
  usePTClientDirectory, usePTDirectoryFacets, usePTSavedViews, usePTSavedViewMutations,
  applyPTClientFilters, PT_DEFAULT_FILTERS, type PTClientFilters, type PTDirectoryRow,
} from "@/hooks/pt/usePTClientDirectory";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SellPTDialog } from "@/components/admin/SellPTDialog";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { PTNewClientDialog } from "@/components/admin/pt/PTNewClientDialog";

const fmt = (iso: string | null, pattern = "MMM d") => (iso ? fmtDate(parseISO(iso), pattern) : "—");

function Avatar({ row }: { row: PTDirectoryRow }) {
  if (row.photoUrl) {
    return <img src={row.photoUrl} alt={`${row.name} headshot`} className="h-8 w-8 rounded-full object-cover" loading="lazy" />;
  }
  return (
    <span className="h-8 w-8 rounded-full grid place-items-center bg-pt-beige text-[11px] font-medium text-pt-ink">
      {row.initials}
    </span>
  );
}

export default function PTClients() {
  const { data: rows = [], isLoading } = usePTClientDirectory();
  const { data: trainers = [] } = usePTTrainers();
  const trainerMap = usePTTrainerMap();
  const facets = usePTDirectoryFacets(rows);
  const { data: savedViews = [] } = usePTSavedViews();
  const { save, remove } = usePTSavedViewMutations();

  const [filters, setFilters] = useState<PTClientFilters>(PT_DEFAULT_FILTERS);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewShared, setViewShared] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);

  const set = <K extends keyof PTClientFilters>(key: K, value: PTClientFilters[K]) => {
    setActiveView(null);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const filtered = useMemo(
    () => applyPTClientFilters(rows, filters).sort((a, b) => a.name.localeCompare(b.name)),
    [rows, filters],
  );

  const kpis = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.sessionsRemaining > 0).length,
    concern: rows.filter((r) => r.attendanceRate !== null && r.attendanceRate < 70).length,
    owed: rows.reduce((s, r) => s + r.owedCents, 0),
  }), [rows]);

  const filterCount = Object.entries(filters)
    .filter(([k, v]) => (k === "search" ? !!v : v !== "all")).length;

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Personal Training"
        title="Clients"
        subtitle="Search, segment and manage every training client."
        actions={
          <>
            <button className={ptButtonClass("outline")} onClick={() => setNewClientOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add client
            </button>
            <button className={ptButtonClass("outline")} onClick={() => setBookOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Book session
            </button>
            <button className={ptButtonClass("primary")} onClick={() => setSellOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Sell package
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-5">
        <PTKpiCard label="Clients" value={kpis.total} icon={Users} />
        <PTKpiCard label="With active sessions" value={kpis.active} tone="green" />
        <PTKpiCard label="Attendance concern" value={kpis.concern} tone="amber" icon={AlertTriangle} />
        <PTKpiCard label="Outstanding balance" value={formatCents(kpis.owed)} tone={kpis.owed > 0 ? "red" : "default"} />
      </div>

      {/* saved views */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => { setFilters(PT_DEFAULT_FILTERS); setActiveView(null); }}
          className={`rounded-full px-3 py-1 text-[12px] border transition-colors ${
            !activeView ? "border-pt-gold text-pt-ink bg-pt-gold/10" : "border-pt-line text-pt-muted hover:text-pt-ink"
          }`}
        >
          All clients
        </button>
        {savedViews.map((v) => (
          <span key={v.id} className="inline-flex items-center">
            <button
              onClick={() => { setFilters({ ...PT_DEFAULT_FILTERS, ...v.filters }); setActiveView(v.id); }}
              className={`rounded-full px-3 py-1 text-[12px] border transition-colors ${
                activeView === v.id ? "border-pt-gold text-pt-ink bg-pt-gold/10" : "border-pt-line text-pt-muted hover:text-pt-ink"
              }`}
            >
              {v.is_shared && <Star className="h-3 w-3 mr-1 inline text-pt-gold" />}
              {v.name}
            </button>
            <button
              aria-label={`Delete view ${v.name}`}
              onClick={() => remove.mutate(v.id)}
              className="ml-0.5 text-pt-muted hover:text-pt-red"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {filterCount > 0 && (
          <button className={ptButtonClass("ghost")} onClick={() => setSaveOpen(true)}>
            <Bookmark className="h-3.5 w-3.5 mr-1.5" /> Save this view
          </button>
        )}
      </div>

      {/* filters */}
      <PTCard className="mb-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pt-muted" />
            <Input
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Search name, email or phone"
              className="pl-9 bg-white border-pt-line"
            />
          </div>
          <FilterSelect label="Trainer" value={filters.trainer} onChange={(v) => set("trainer", v)}
            options={[{ value: "all", label: "All trainers" }, { value: "unassigned", label: "Unassigned" },
              ...trainers.map((t: any) => ({ value: t.id, label: t.name }))]} />
          <FilterSelect label="Status" value={filters.activity} onChange={(v) => set("activity", v)}
            options={[{ value: "all", label: "Active & inactive" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
          <FilterSelect label="Package" value={filters.packageType} onChange={(v) => set("packageType", v)}
            options={[{ value: "all", label: "Any package" }, ...facets.packs.map((p) => ({ value: p, label: p }))]} />
          <FilterSelect label="Expiration" value={filters.packageExpiry} onChange={(v) => set("packageExpiry", v)}
            options={[{ value: "all", label: "Any expiration" }, { value: "expiring30", label: "Expiring in 30 days" },
              { value: "expired", label: "Expired" }, { value: "none", label: "No package" }]} />
          <FilterSelect label="Attendance" value={filters.attendance} onChange={(v) => set("attendance", v)}
            options={[{ value: "all", label: "Any attendance" }, { value: "concern", label: "Concern (under 70%)" }]} />
          <FilterSelect label="Reassessment" value={filters.reassessment} onChange={(v) => set("reassessment", v)}
            options={[{ value: "all", label: "Any" }, { value: "due", label: "Due within 14 days" }]} />
          <FilterSelect label="No-shows" value={filters.noShow} onChange={(v) => set("noShow", v)}
            options={[{ value: "all", label: "Any" }, { value: "any", label: "Has no-shows" }, { value: "repeat", label: "2 or more" }]} />
          <FilterSelect label="Tag" value={filters.tag} onChange={(v) => set("tag", v)}
            options={[{ value: "all", label: "Any tag" }, ...facets.tags.map((t) => ({ value: t, label: t }))]} />
        </div>
      </PTCard>

      <PTCard padded={false}>
        <PTTable
          loading={isLoading}
          rows={filtered}
          getRowKey={(r) => r.userId}
          empty={<PTEmptyState icon={Users} title="No clients match these filters"
            description="Adjust the filters above or clear the saved view." />}
          columns={[
            {
              key: "client", header: "Client",
              render: (r) => (
                <Link to={`/admin/pt/clients/${r.userId}`} className="flex items-center gap-2.5 group">
                  <Avatar row={r} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-pt-ink group-hover:text-pt-gold truncate">{r.name}</span>
                    <span className="block text-xs text-pt-muted truncate">{r.email}</span>
                  </span>
                </Link>
              ),
            },
            { key: "phone", header: "Phone", render: (r) => <span className="text-pt-muted">{r.phone ?? "—"}</span> },
            { key: "trainer", header: "Trainer", render: (r) => r.primaryTrainerId ? (trainerMap[r.primaryTrainerId] ?? "—") : <span className="text-pt-muted">Unassigned</span> },
            {
              key: "membership", header: "Membership",
              render: (r) => <PTBadge tone={r.isMember ? "green" : "neutral"}>{r.isMember ? r.membershipStatus : "Non-member"}</PTBadge>,
            },
            {
              key: "package", header: "Package",
              render: (r) => r.activePackName ? (
                <span>
                  <span className="block text-[13px]">{r.activePackName}</span>
                  <span className="block text-xs text-pt-muted">
                    {r.packageFormat ? PT_FORMAT_LABEL[r.packageFormat] ?? r.packageFormat : ""}
                    {r.packageExpiresAt ? ` · exp ${fmt(r.packageExpiresAt)}` : ""}
                  </span>
                </span>
              ) : <span className="text-pt-muted">—</span>,
            },
            {
              key: "remaining", header: "Sessions", align: "right",
              render: (r) => (
                <span className={r.sessionsRemaining === 0 ? "text-pt-muted" : r.sessionsRemaining <= 2 ? "text-pt-amber font-medium" : "text-pt-ink"}>
                  {r.sessionsRemaining}
                </span>
              ),
            },
            { key: "last", header: "Last visit", render: (r) => <span className="text-pt-muted">{fmt(r.lastVisit)}</span> },
            {
              key: "next", header: "Next",
              render: (r) => r.nextAppointment
                ? <span>{fmt(r.nextAppointment, "MMM d, h:mma")}</span>
                : <span className="text-pt-muted">—</span>,
            },
            {
              key: "attendance", header: "Attendance", align: "right",
              render: (r) => r.attendanceRate === null
                ? <span className="text-pt-muted">—</span>
                : <span className={r.attendanceRate < 70 ? "text-pt-red font-medium" : "text-pt-ink"}>{r.attendanceRate}%</span>,
            },
            {
              key: "alerts", header: "Alerts",
              render: (r) => (
                <span className="flex flex-wrap gap-1">
                  {r.highAlerts > 0 && <PTBadge tone="red">{r.highAlerts} urgent</PTBadge>}
                  {r.openAlerts - r.highAlerts > 0 && <PTBadge tone="amber">{r.openAlerts - r.highAlerts} open</PTBadge>}
                  {r.owedCents > 0 && <PTBadge tone="red">{formatCents(r.owedCents)} due</PTBadge>}
                  {r.reassessmentDue && differenceInCalendarDays(parseISO(r.reassessmentDue), new Date()) <= 14 && (
                    <PTBadge tone="gold">Reassess</PTBadge>
                  )}
                  {r.noShows >= 2 && <PTBadge tone="amber">{r.noShows} no-shows</PTBadge>}
                </span>
              ),
            },
            {
              key: "tags", header: "Tags",
              render: (r) => r.tags.length
                ? <span className="flex flex-wrap gap-1">{r.tags.slice(0, 3).map((t) => <PTBadge key={t}>{t}</PTBadge>)}</span>
                : <span className="text-pt-muted">—</span>,
            },
          ]}
        />
      </PTCard>

      <p className="text-xs text-pt-muted mt-3">{filtered.length} of {rows.length} clients</p>

      <PTModal
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save filter view"
        description="Keep this segment one click away."
        footer={
          <>
            <button className={ptButtonClass("ghost")} onClick={() => setSaveOpen(false)}>Cancel</button>
            <button
              className={ptButtonClass("primary")}
              disabled={!viewName.trim() || save.isPending}
              onClick={() => save.mutate(
                { name: viewName.trim(), filters, isShared: viewShared },
                { onSuccess: () => { setSaveOpen(false); setViewName(""); setViewShared(false); } },
              )}
            >
              Save view
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="pt-eyebrow">View name</Label>
            <Input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="e.g. Expiring packages" className="bg-white border-pt-line" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-pt-line px-3 py-2.5">
            <div>
              <div className="text-[13px] text-pt-ink">Share with the team</div>
              <div className="text-xs text-pt-muted">Other trainers and admins can use this view.</div>
            </div>
            <Switch checked={viewShared} onCheckedChange={setViewShared} />
          </div>
        </div>
      </PTModal>

      <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} />
      <BookPTSessionDialog open={bookOpen} onOpenChange={setBookOpen} />
    </PTShell>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <span className="pt-eyebrow">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-white border-pt-line text-[13px]"><SelectValue /></SelectTrigger>
        <SelectContent className="bg-white border-pt-line z-50">
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
