import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import {
  PTMBadge, PTMCard, PTMEmpty, PTMError, PTMListSkeleton,
} from "@/components/admin/pt/mobile/PTMobileUI";
import { PTMAvatar, PTMTabs } from "@/components/admin/pt/mobile/PTMobileParts";
import { usePTClientDirectory } from "@/hooks/pt/usePTClientDirectory";

export default function PTMClients() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = usePTClientDirectory();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((r) => (q ? `${r.name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q) : true))
      .filter((r) => {
        if (tab === "active") return r.sessionsRemaining > 0;
        if (tab === "attention") return r.openAlerts > 0 || (r.attendanceRate ?? 100) < 70 || r.sessionsRemaining === 0;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search, tab]);

  return (
    <PTMobileShell title="Clients">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pt-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone"
          className="min-h-[48px] w-full rounded-xl border border-pt-line bg-pt-cream pl-9 pr-3 text-[15px] text-pt-ink outline-none"
        />
      </div>

      <div className="mt-3">
        <PTMTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: `All${data ? ` (${data.length})` : ""}` },
            { value: "active", label: "Active package" },
            { value: "attention", label: "Needs attention" },
          ]}
        />
      </div>

      <div className="mt-3 space-y-2">
        {isLoading && <PTMListSkeleton rows={6} />}
        {error && <PTMError message={(error as any)?.message} onRetry={() => refetch()} />}
        {!isLoading && !error && rows.length === 0 && (
          <PTMEmpty title="No clients found" description="Try a different search or filter." />
        )}
        {rows.map((r) => (
          <PTMCard key={r.userId} className="p-3" onClick={() => navigate(`/admin/pt/m/clients/${r.userId}`)}>
            <div className="flex items-center gap-3">
              <PTMAvatar name={r.name} src={r.photoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-pt-ink">{r.name}</p>
                <p className="truncate text-[12px] text-pt-muted">
                  {r.sessionsRemaining > 0 ? `${r.sessionsRemaining} sessions left` : "No active package"}
                  {r.attendanceRate != null ? ` · ${r.attendanceRate}% attendance` : ""}
                </p>
              </div>
              {r.openAlerts > 0 ? (
                <PTMBadge tone="red">{r.openAlerts}</PTMBadge>
              ) : r.sessionsRemaining > 0 ? (
                <PTMBadge tone="green">Active</PTMBadge>
              ) : (
                <PTMBadge>Inactive</PTMBadge>
              )}
            </div>
          </PTMCard>
        ))}
      </div>
    </PTMobileShell>
  );
}
