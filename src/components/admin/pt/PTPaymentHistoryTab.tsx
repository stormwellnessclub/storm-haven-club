import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PTTable, PTEmptyState, PTBadge } from "@/components/admin/pt/PTUI";
import { Input } from "@/components/ui/input";
import { usePTPeople } from "@/hooks/pt/usePTPortal";
import { formatCents } from "@/lib/ptFormat";
import { downloadCsv } from "@/lib/ptExport";

const TZ = "America/Detroit";
const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

type Row = {
  id: string; when: string; kind: "charge" | "credit" | "credit_restored";
  userId: string | null; amount: string; session: string; detail: string;
};

/** Every PT session charge and package-credit use, newest first. */
export function PTPaymentHistoryTab() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["pt-payment-history"],
    queryFn: async () => {
      const [{ data: pays }, { data: usage }] = await Promise.all([
        supabase.from("pt_payments")
          .select("id, user_id, amount_cents, method, status, paid_at, created_at, reference, refunded_cents, pt_payment_allocations(appointment_id, amount_cents)")
          .order("created_at", { ascending: false }).limit(2000),
        supabase.from("pt_session_usage")
          .select("id, pass_id, appointment_id, event_type, quantity, used_at, created_at, reason, notes, sessions_after, reversed_at")
          .order("created_at", { ascending: false }).limit(2000),
      ]);
      const apptIds = new Set<string>();
      (pays ?? []).forEach((p: any) => (p.pt_payment_allocations ?? []).forEach((a: any) => a.appointment_id && apptIds.add(a.appointment_id)));
      (usage ?? []).forEach((u: any) => u.appointment_id && apptIds.add(u.appointment_id));
      const passIds = Array.from(new Set((usage ?? []).map((u: any) => u.pass_id).filter(Boolean)));
      const [{ data: appts }, { data: passes }] = await Promise.all([
        apptIds.size ? supabase.from("pt_appointments").select("id, starts_at, user_id").in("id", Array.from(apptIds)) : Promise.resolve({ data: [] as any[] }),
        passIds.length ? supabase.from("pt_passes").select("id, user_id, pack_name").in("id", passIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      return { pays: pays ?? [], usage: usage ?? [], appts: appts ?? [], passes: passes ?? [] };
    },
  });

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const appt = new Map(data.appts.map((a: any) => [a.id, a]));
    const pass = new Map(data.passes.map((p: any) => [p.id, p]));
    const sessionLabel = (id?: string | null) => (id && appt.get(id) ? fmt((appt.get(id) as any).starts_at) : "—");
    const out: Row[] = [];
    data.pays.forEach((p: any) => {
      const allocs = (p.pt_payment_allocations ?? []).filter((a: any) => a.appointment_id);
      out.push({
        id: `p-${p.id}`, when: p.paid_at ?? p.created_at, kind: "charge", userId: p.user_id,
        amount: formatCents(p.amount_cents) + (p.refunded_cents ? ` (${formatCents(p.refunded_cents)} refunded)` : ""),
        session: allocs.length ? allocs.map((a: any) => sessionLabel(a.appointment_id)).join(", ") : "Not tied to a session",
        detail: [p.method, p.status !== "succeeded" ? p.status : null, p.reference].filter(Boolean).join(" · "),
      });
    });
    data.usage.forEach((u: any) => {
      const ps: any = pass.get(u.pass_id);
      const qty = u.quantity ?? 1;
      const restored = qty < 0 || /revers|restor|refund|return/i.test(u.event_type ?? "");
      out.push({
        id: `u-${u.id}`, when: u.used_at ?? u.created_at, kind: restored ? "credit_restored" : "credit",
        userId: ps?.user_id ?? (appt.get(u.appointment_id) as any)?.user_id ?? null,
        amount: `${restored ? "+" : "−"}${Math.abs(qty)} session${Math.abs(qty) === 1 ? "" : "s"}`,
        session: sessionLabel(u.appointment_id),
        detail: [ps?.pack_name, u.sessions_after != null ? `${u.sessions_after} left` : null, u.reversed_at ? "later reversed" : null, u.reason || u.notes].filter(Boolean).join(" · "),
      });
    });
    return out.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));
  }, [data]);

  const { data: people = {} } = usePTPeople(rows.map((r) => r.userId ?? ""));
  const name = (id: string | null) => (id && people[id]?.name) || "Unknown client";
  const filtered = rows.filter((r) => !q || name(r.userId).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex items-center gap-2 p-3">
        <Input placeholder="Search client…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 max-w-xs border-pt-line bg-white" />
        <button
          className="h-9 rounded-md border border-pt-line bg-white px-3 text-[13px]"
          onClick={() => downloadCsv("pt-payment-history.csv", filtered.map((r) => ({
            Date: fmt(r.when), Client: name(r.userId), Type: r.kind, Amount: r.amount, Session: r.session, Details: r.detail,
          })) as any)}
        >
          Export CSV
        </button>
      </div>
      <PTTable
        rows={filtered}
        loading={isLoading}
        getRowKey={(r: Row) => r.id}
        empty={<PTEmptyState icon={History} title="No charges or credit uses yet" />}
        columns={[
          { key: "d", header: "Date", render: (r: Row) => fmt(r.when) },
          { key: "c", header: "Client", render: (r: Row) => name(r.userId) },
          {
            key: "t", header: "Type",
            render: (r: Row) => r.kind === "charge"
              ? <PTBadge tone="gold">Charge</PTBadge>
              : <PTBadge tone="neutral">{r.kind === "credit" ? "Credit used" : "Credit restored"}</PTBadge>,
          },
          { key: "a", header: "Amount", align: "right", render: (r: Row) => r.amount },
          { key: "s", header: "Session", render: (r: Row) => r.session },
          { key: "x", header: "Details", render: (r: Row) => <span className="text-pt-muted">{r.detail || "—"}</span> },
        ] as any}
      />
    </div>
  );
}
