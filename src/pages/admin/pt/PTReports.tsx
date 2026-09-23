import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { PTShell, PTPageHeader, PTCard, ptButtonClass, PTAlert } from "@/components/admin/pt/PTUI";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePTPeople } from "@/hooks/pt/usePTPortal";
import { usePTReportLookups } from "@/hooks/pt/usePTReportData";
import {
  PT_DATE_PRESETS, PTDatePreset, PTFinFilters, defaultPTFinFilters, presetRange, usePTFinancialReportData,
} from "@/hooks/pt/usePTFinancialReports";
import { buildContext } from "@/components/admin/pt/reports/ptReportFilters";
import {
  PTAutopaySection, PTCashSection, PTOverviewSection, PTPackagesSection, PTSalesSection, PTTrainerSection,
} from "@/components/admin/pt/reports/PTFinancialSections";
import PTOperationsReport from "@/components/admin/pt/reports/PTOperationsReport";

type SectionKey = "overview" | "sales" | "cash" | "autopay" | "packages" | "trainers" | "operations";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "cash", label: "Cash Collected" },
  { key: "autopay", label: "Autopay & A/R" },
  { key: "packages", label: "Packages & Obligation" },
  { key: "trainers", label: "Trainer Performance" },
  { key: "operations", label: "Operations" },
];

const PAYMENT_STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "succeeded", label: "Collected" },
  { value: "refunded", label: "Refunded" },
];

const PAYMENT_METHODS = [
  { value: "all", label: "All methods" },
  { value: "card", label: "Card" },
  { value: "manual", label: "Manual" },
  { value: "invoice", label: "Invoice" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
];

export default function PTReports() {
  const [section, setSection] = useState<SectionKey>("overview");
  const [filters, setFilters] = useState<PTFinFilters>(defaultPTFinFilters);

  const { data: lookups } = usePTReportLookups();
  const { data, isLoading, isError, error, refetch } = usePTFinancialReportData(filters);

  const passes = data?.passes ?? [];
  const peopleIds = useMemo(
    () => Array.from(new Set(passes.map((p: any) => p.user_id).filter(Boolean))) as string[],
    [passes],
  );
  const { data: people = {} } = usePTPeople(peopleIds);
  const trainerName = useMemo(
    () => Object.fromEntries((lookups?.trainers ?? []).map((t: any) => [t.id, t.name])),
    [lookups],
  );

  const ctx = useMemo(
    () => buildContext(
      filters,
      passes,
      data?.clientTrainers ?? [],
      (id?: string | null) => (id ? (people as any)[id]?.name ?? "Unknown client" : "—"),
      (id?: string | null) => (id ? trainerName[id] ?? "Trainer" : "—"),
    ),
    [filters, passes, data, people, trainerName],
  );

  const set = (patch: Partial<PTFinFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const setPreset = (preset: PTDatePreset) =>
    setFilters((f) => ({ ...f, preset, ...presetRange(preset, { from: f.from, to: f.to }) }));

  const packOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data?.packs ?? []).forEach((p: any) => map.set(p.id, p.name));
    passes.forEach((p: any) => { if (p.pack_id && !map.has(p.pack_id)) map.set(p.pack_id, p.pack_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data, passes]);

  const clientOptions = useMemo(() => {
    const seen = new Map<string, string>();
    passes.forEach((p: any) => { if (p.user_id) seen.set(p.user_id, (people as any)[p.user_id]?.name ?? "Client"); });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [passes, people]);

  const sectionProps = { data: data!, ctx, loading: isLoading };

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Insight"
        title="PT Reports"
        subtitle="Sales, cash, autopay and delivery — every figure read from live training records."
      />

      {isError && (
        <PTAlert
          tone="danger"
          title="Reports could not be loaded"
          action={<button className={ptButtonClass("outline")} onClick={() => refetch()}>Retry</button>}
        >
          {(error as any)?.message ?? "These figures are incomplete — do not use them until the data loads."}
        </PTAlert>
      )}

      <nav className="flex flex-wrap gap-2 mb-5">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors border",
              section === s.key
                ? "bg-pt-noir text-pt-cream border-pt-noir"
                : "bg-white text-pt-ink border-pt-line hover:bg-pt-beige/50",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {section !== "operations" && (
        <PTCard className="mb-6">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <div>
              <label className="text-xs text-pt-muted">Range</label>
              <Select value={filters.preset} onValueChange={(v) => setPreset(v as PTDatePreset)}>
                <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PT_DATE_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-pt-muted">From</label>
              <Input type="date" value={filters.from} className="border-pt-line bg-white"
                onChange={(e) => set({ from: e.target.value, preset: "custom" })} />
            </div>
            <div>
              <label className="text-xs text-pt-muted">To</label>
              <Input type="date" value={filters.to} className="border-pt-line bg-white"
                onChange={(e) => set({ to: e.target.value, preset: "custom" })} />
            </div>
            <div>
              <label className="text-xs text-pt-muted">Package</label>
              <Select value={filters.packId} onValueChange={(v) => set({ packId: v })}>
                <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All packages</SelectItem>
                  {packOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-pt-muted">Trainer</label>
              <Select value={filters.trainerId} onValueChange={(v) => set({ trainerId: v })}>
                <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All trainers</SelectItem>
                  <SelectItem value="unattributed">Unattributed</SelectItem>
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
                  {clientOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:col-span-1 md:col-span-2">
              <div>
                <label className="text-xs text-pt-muted">Status</label>
                <Select value={filters.paymentStatus} onValueChange={(v) => set({ paymentStatus: v })}>
                  <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-pt-muted">Method</label>
                <Select value={filters.paymentMethod} onValueChange={(v) => set({ paymentMethod: v })}>
                  <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </PTCard>
      )}

      {section === "operations" ? (
        <PTOperationsReport />
      ) : isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-24 rounded-xl bg-pt-beige/50 animate-pulse" />)}
        </div>
      ) : (
        <>
          {section === "overview" && <PTOverviewSection {...sectionProps} />}
          {section === "sales" && <PTSalesSection {...sectionProps} />}
          {section === "cash" && <PTCashSection {...sectionProps} />}
          {section === "autopay" && <PTAutopaySection {...sectionProps} />}
          {section === "packages" && <PTPackagesSection {...sectionProps} />}
          {section === "trainers" && <PTTrainerSection {...sectionProps} />}
        </>
      )}

      {!isLoading && data && section !== "operations" && (
        <p className="text-xs text-pt-muted mt-8 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          Sales, cash collected and future contracted autopay are reported separately and never summed together.
        </p>
      )}
    </PTShell>
  );
}
