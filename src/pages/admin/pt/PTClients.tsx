import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format as fmtDate, parseISO } from "date-fns";
import { Search, Plus, Users } from "lucide-react";
import { PT_FORMAT_LABEL } from "@/lib/ptFormat";
import { PTShell, PTPageHeader, PTCard, PTStatus, PTEmpty, ptButtonClass, PTKpiCard } from "@/components/admin/pt/PTUI";
import { usePTClients, usePTPeople, usePTTrainerMap } from "@/hooks/pt/usePTPortal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SellPTDialog } from "@/components/admin/SellPTDialog";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";

type Filter = "all" | "active" | "low" | "inactive" | "owes";

export default function PTClients() {
  const { data, isLoading } = usePTClients();
  const ids = data?.ids ?? [];
  const { data: people = {} } = usePTPeople(ids);
  const trainerMap = usePTTrainerMap();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sellOpen, setSellOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.ids.map((id) => {
      const passes = data.passes.filter((p) => p.user_id === id);
      const appts = data.appts.filter((a) => a.user_id === id);
      const active = passes.filter((p) => p.status === "active" && p.sessions_remaining > 0);
      const remaining = active.reduce((s, p) => s + p.sessions_remaining, 0);
      const completed = appts.filter((a) => a.status === "completed").length;
      const owed = appts
        .filter((a) => a.payment_status === "unpaid")
        .reduce((s, a) => s + (a.amount_due_cents || 0), 0);
      const upcoming = appts
        .filter((a) => a.status === "scheduled" && a.starts_at >= new Date().toISOString())
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
      const last = appts
        .filter((a) => a.status === "completed")
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
      const profile = data.profiles.find((p) => p.user_id === id);
      return { id, remaining, completed, owed, upcoming, last, profile, packName: active[0]?.pack_name ?? null };
    });
  }, [data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        const p = people[r.id];
        if (s && !(`${p?.name ?? ""} ${p?.email ?? ""}`.toLowerCase().includes(s))) return false;
        if (filter === "active") return r.remaining > 0;
        if (filter === "low") return r.remaining > 0 && r.remaining <= 2;
        if (filter === "inactive") return r.remaining === 0;
        if (filter === "owes") return r.owed > 0;
        return true;
      })
      .sort((a, b) => (people[a.id]?.name ?? "").localeCompare(people[b.id]?.name ?? ""));
  }, [rows, people, search, filter]);

  const totals = useMemo(() => ({
    all: rows.length,
    active: rows.filter((r) => r.remaining > 0).length,
    low: rows.filter((r) => r.remaining > 0 && r.remaining <= 2).length,
    owes: rows.filter((r) => r.owed > 0).length,
  }), [rows]);

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Personal Training"
        title="Clients"
        subtitle="Everyone with a package, a booked session or a coaching profile."
        actions={
          <>
            <button className={ptButtonClass("outline")} onClick={() => setBookOpen(true)}>Book session</button>
            <button className={ptButtonClass()} onClick={() => setSellOpen(true)}><Plus className="h-4 w-4" /> Sell package</button>
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
        <PTKpiCard label="Total clients" value={totals.all} icon={Users} />
        <PTKpiCard label="With sessions" value={totals.active} tone="green" />
        <PTKpiCard label="Low balance" value={totals.low} tone="amber" hint="2 or fewer left" />
        <PTKpiCard label="Owes money" value={totals.owes} tone={totals.owes ? "red" : "green"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pt-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="pl-9 w-72 h-9 bg-white border-pt-line"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-48 h-9 bg-white border-pt-line"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            <SelectItem value="active">Sessions remaining</SelectItem>
            <SelectItem value="low">Low balance</SelectItem>
            <SelectItem value="inactive">No sessions left</SelectItem>
            <SelectItem value="owes">Outstanding balance</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-pt-muted">{filtered.length} shown</span>
      </div>

      <PTCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-pt-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6"><PTEmpty>No clients match this view.</PTEmpty></div>
        ) : (
          <div className="overflow-x-auto pt-scroll">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="text-left border-b border-pt-line/70 bg-pt-beige/25">
                  {["Client", "Package", "Remaining", "Completed", "Next session", "Trainer", "Balance", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 pt-eyebrow font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-pt-line/60">
                {filtered.map((r) => {
                  const p = people[r.id];
                  return (
                    <tr key={r.id} className="hover:bg-pt-beige/25">
                      <td className="px-4 py-3">
                        <Link to={`/admin/pt/clients/${r.id}`} className="font-medium hover:text-pt-gold">
                          {p?.name ?? r.id.slice(0, 8)}
                        </Link>
                        <div className="text-[11px] text-pt-muted truncate max-w-[220px]">{p?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-pt-muted text-[13px]">{r.packName ?? "—"}</td>
                      <td className="px-4 py-3">
                        {r.remaining > 0 ? (
                          <span className={r.remaining <= 2 ? "text-pt-amber font-medium" : ""}>{r.remaining}</span>
                        ) : <span className="text-pt-muted">0</span>}
                      </td>
                      <td className="px-4 py-3 text-pt-muted">{r.completed}</td>
                      <td className="px-4 py-3 text-[13px]">
                        {r.upcoming ? (
                          <>
                            {fmtDate(parseISO(r.upcoming.starts_at), "MMM d · h:mm a")}
                            <div className="text-[11px] text-pt-muted">{PT_FORMAT_LABEL[r.upcoming.format as never] ?? ""}</div>
                          </>
                        ) : <span className="text-pt-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-pt-muted">
                        {r.profile?.primary_trainer_id ? trainerMap[r.profile.primary_trainer_id] ?? "—" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.owed > 0
                          ? <span className="text-pt-red font-medium">${(r.owed / 100).toFixed(2)}</span>
                          : <PTStatus status="paid" />}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link className={ptButtonClass("ghost")} to={`/admin/pt/clients/${r.id}`}>Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PTCard>

      <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} />
      <BookPTSessionDialog open={bookOpen} onOpenChange={setBookOpen} onSellPack={() => { setBookOpen(false); setSellOpen(true); }} />
    </PTShell>
  );
}
