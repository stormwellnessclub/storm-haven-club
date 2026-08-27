import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format as fmtDate, differenceInCalendarDays, addDays } from "date-fns";
import {
  Wallet, CreditCard, AlertTriangle, CheckCircle2, Clock, Repeat, Download, Receipt,
} from "lucide-react";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTBadge, PTTabs,
  PTKpiCard, PTModal, PTAlert, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePTPeople } from "@/hooks/pt/usePTPortal";
import { formatCents } from "@/lib/ptFormat";
import { downloadCsv } from "@/lib/ptExport";
import {
  usePTUnpaidSessions, usePTPaymentPlans, usePTPayments, usePTPaymentAllocations,
  PTUnpaidSession, PTPlanRow, PT_PAYMENT_METHOD_LABEL,
} from "@/hooks/pt/usePTFinancials";
import { PTSessionCheckoutDialog } from "@/components/admin/pt/PTSessionCheckoutDialog";

type Tab = "autopay" | "unpaid" | "activity";
type AgeFilter = "all" | "today" | "7" | "8-30" | "31";

const planStatusTone = (s?: string | null) =>
  s === "active" ? "green" : s === "past_due" || s === "failed" ? "red" : s === "completed" ? "neutral" : "amber";

export default function PTBilling() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("unpaid");
  const [search, setSearch] = useState("");
  const [age, setAge] = useState<AgeFilter>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [checkout, setCheckout] = useState<PTUnpaidSession[]>([]);
  const [openPlan, setOpenPlan] = useState<PTPlanRow | null>(null);

  const { data: unpaid = [], isLoading: loadingUnpaid } = usePTUnpaidSessions();
  const { data: plans = [], isLoading: loadingPlans } = usePTPaymentPlans();
  const { data: payments = [], isLoading: loadingPayments } = usePTPayments();
  const { data: allocations = [] } = usePTPaymentAllocations(payments.map((p) => p.id));

  const { data: people = {} } = usePTPeople([
    ...unpaid.map((u) => u.user_id),
    ...plans.map((p) => p.user_id),
    ...payments.map((p) => p.user_id),
  ]);
  const nameOf = (id?: string | null) => (id ? people[id]?.name ?? "—" : "—");

  const matches = (id: string) =>
    !search.trim() || nameOf(id).toLowerCase().includes(search.trim().toLowerCase());

  /* ------------------------------------------------------------- unpaid */

  const unpaidRows = useMemo(() => {
    const now = Date.now();
    return unpaid.filter((u) => {
      if (!matches(u.user_id)) return false;
      const days = Math.floor((now - new Date(u.starts_at).getTime()) / 86400000);
      if (age === "today") return days <= 0;
      if (age === "7") return days <= 7;
      if (age === "8-30") return days >= 8 && days <= 30;
      if (age === "31") return days >= 31;
      return true;
    });
  }, [unpaid, age, search, people]); // eslint-disable-line react-hooks/exhaustive-deps

  const unpaidTotal = unpaidRows.reduce((s, u) => s + (u.amount_due_cents || 0), 0);

  const byClient = useMemo(() => {
    const map = new Map<string, PTUnpaidSession[]>();
    unpaidRows.forEach((u) => map.set(u.user_id, [...(map.get(u.user_id) ?? []), u]));
    return map;
  }, [unpaidRows]);

  const unpaidColumns: PTColumn<PTUnpaidSession>[] = [
    { key: "client", header: "Client", render: (u) => nameOf(u.user_id) },
    { key: "date", header: "Session", render: (u) => fmtDate(new Date(u.starts_at), "MMM d, yyyy · h:mm a") },
    { key: "trainer", header: "Trainer", render: (u) => (u.instructor_id ? nameOf(u.instructor_id) : "—") },
    { key: "type", header: "Format", render: (u) => u.format.replace(/_/g, " ") },
    { key: "amount", header: "Amount due", align: "right", render: (u) => formatCents(u.amount_due_cents || 0) },
    {
      key: "pkg", header: "Package",
      render: (u) => (u.pass_id ? <PTBadge tone="gold">Linked</PTBadge> : <span className="text-pt-muted">—</span>),
    },
    {
      key: "days", header: "Days outstanding", align: "right",
      render: (u) => {
        const d = Math.max(0, differenceInCalendarDays(new Date(), new Date(u.starts_at)));
        return <span className={d > 30 ? "text-pt-red font-medium" : d > 7 ? "text-pt-amber" : ""}>{d}</span>;
      },
    },
    {
      key: "checkout", header: "", align: "right",
      render: (u) => (
        <button
          className={ptButtonClass("outline")}
          onClick={(e) => { e.stopPropagation(); setCheckout([u]); }}
        >
          Check out
        </button>
      ),
    },
  ];

  /* ------------------------------------------------------------- autopay */

  const planRows = useMemo(() => plans.filter((p) => {
    if (!matches(p.user_id)) return false;
    const next = p.payment_plan_next_payment_date ? new Date(`${p.payment_plan_next_payment_date}T12:00:00`) : null;
    switch (planFilter) {
      case "active": return p.payment_plan_status === "active";
      case "week": return !!next && next <= addDays(new Date(), 7) && next >= new Date();
      case "month": return !!next && next <= addDays(new Date(), 30) && next >= new Date();
      case "failed": return p.payment_plan_status === "failed";
      case "past_due": return p.payment_plan_status === "past_due";
      case "completed": return p.payment_plan_status === "completed";
      default: return true;
    }
  }), [plans, planFilter, search, people]); // eslint-disable-line react-hooks/exhaustive-deps

  const planStats = useMemo(() => {
    const next = (p: PTPlanRow) => p.payment_plan_next_payment_date ? new Date(`${p.payment_plan_next_payment_date}T12:00:00`) : null;
    const within = (p: PTPlanRow, days: number) => {
      const n = next(p); return !!n && n >= new Date() && n <= addDays(new Date(), days);
    };
    const thisMonth = payments.filter((p) => new Date(p.paid_at).getMonth() === new Date().getMonth() && p.status === "succeeded");
    return {
      active: plans.filter((p) => p.payment_plan_status === "active").length,
      due7: plans.filter((p) => within(p, 7)).length,
      due30: plans.filter((p) => within(p, 30)).length,
      succeededMonth: thisMonth.reduce((s, p) => s + p.amount_cents, 0),
      failed: plans.filter((p) => p.payment_plan_status === "failed").length,
      pastDue: plans.filter((p) => p.payment_plan_status === "past_due").length,
      completingSoon: plans.filter((p) =>
        (p.payment_plan_total_installments ?? 0) > 0 &&
        (p.payment_plan_total_installments ?? 0) - (p.payment_plan_installments_paid ?? 0) <= 1).length,
    };
  }, [plans, payments]);

  const planColumns: PTColumn<PTPlanRow>[] = [
    { key: "client", header: "Client", render: (p) => nameOf(p.user_id) },
    { key: "pack", header: "Package", render: (p) => p.pack_name },
    { key: "total", header: "Package total", align: "right", render: (p) => formatCents(p.payment_plan_total_cents ?? 0) },
    { key: "paid", header: "Paid to date", align: "right", render: (p) => formatCents(p.amount_paid_cents ?? 0) },
    { key: "remaining", header: "Money remaining", align: "right", render: (p) => formatCents(p.amount_outstanding_cents ?? 0) },
    { key: "installment", header: "Installment", align: "right", render: (p) => formatCents(p.payment_plan_installment_cents ?? 0) },
    {
      key: "next", header: "Next payment",
      render: (p) => (p.payment_plan_next_payment_date
        ? fmtDate(new Date(`${p.payment_plan_next_payment_date}T12:00:00`), "MMM d, yyyy")
        : <span className="text-pt-muted">—</span>),
    },
    {
      key: "progress", header: "Installments", align: "right",
      render: (p) => `${p.payment_plan_installments_paid ?? 0} / ${p.payment_plan_total_installments ?? 0}`,
    },
    {
      key: "status", header: "Plan status",
      render: (p) => <PTBadge tone={planStatusTone(p.payment_plan_status) as any}>{(p.payment_plan_status ?? "—").replace(/_/g, " ")}</PTBadge>,
    },
    { key: "sessions", header: "Sessions left", align: "right", render: (p) => p.sessions_remaining },
  ];

  /* ------------------------------------------------------------ activity */

  const allocByPayment = useMemo(() => {
    const m = new Map<string, any[]>();
    allocations.forEach((a: any) => m.set(a.payment_id, [...(m.get(a.payment_id) ?? []), a]));
    return m;
  }, [allocations]);

  const paymentColumns: PTColumn<any>[] = [
    { key: "when", header: "Paid", render: (p) => fmtDate(new Date(p.paid_at), "MMM d, yyyy h:mm a") },
    { key: "client", header: "Client", render: (p) => nameOf(p.user_id) },
    { key: "amount", header: "Amount", align: "right", render: (p) => formatCents(p.amount_cents) },
    {
      key: "method", header: "Method",
      render: (p) => (
        <PTBadge tone={p.method === "card" ? "gold" : "neutral"}>
          {PT_PAYMENT_METHOD_LABEL[p.method] ?? p.method}{p.method !== "card" ? " · manual" : ""}
        </PTBadge>
      ),
    },
    {
      key: "sessions", header: "Applied to",
      render: (p) => {
        const a = allocByPayment.get(p.id) ?? [];
        return a.length ? `${a.length} session${a.length === 1 ? "" : "s"}` : "—";
      },
    },
    { key: "ref", header: "Reference", render: (p) => p.reference || p.stripe_payment_intent_id || "—" },
    {
      key: "status", header: "Status",
      render: (p) => <PTBadge tone={p.status === "succeeded" ? "green" : "red"}>{p.status}</PTBadge>,
    },
  ];

  function exportCurrent() {
    if (tab === "unpaid") {
      downloadCsv("pt-unpaid-sessions", unpaidRows.map((u) => ({
        client: nameOf(u.user_id), session: u.starts_at, trainer: nameOf(u.instructor_id),
        format: u.format, amount_due: (u.amount_due_cents || 0) / 100, payment_status: u.payment_status,
      })));
    } else if (tab === "autopay") {
      downloadCsv("pt-payment-plans", planRows.map((p) => ({
        client: nameOf(p.user_id), package: p.pack_name,
        total: (p.payment_plan_total_cents ?? 0) / 100, paid: (p.amount_paid_cents ?? 0) / 100,
        remaining: (p.amount_outstanding_cents ?? 0) / 100,
        installment: (p.payment_plan_installment_cents ?? 0) / 100,
        next_payment: p.payment_plan_next_payment_date ?? "", status: p.payment_plan_status ?? "",
      })));
    } else {
      downloadCsv("pt-payments", payments.map((p) => ({
        paid_at: p.paid_at, client: nameOf(p.user_id), amount: p.amount_cents / 100,
        method: p.method, reference: p.reference ?? p.stripe_payment_intent_id ?? "", status: p.status,
      })));
    }
  }

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Revenue"
        title="Billing & Autopay"
        subtitle="Unpaid sessions, checkout, installment plans and every PT payment — session balance and money balance kept separate."
        actions={
          <>
            <button className={ptButtonClass("outline")} onClick={exportCurrent}>
              <Download className="h-4 w-4" /> Export
            </button>
            <button className={ptButtonClass("outline")} onClick={() => navigate("/admin/pt/packages")}>
              Packages
            </button>
          </>
        }
      />

      {tab === "unpaid" ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PTKpiCard label="Unpaid PT sessions" value={unpaidRows.length} icon={Receipt} tone="amber" />
          <PTKpiCard label="Outstanding PT amount" value={formatCents(unpaidTotal)} tone="red" />
          <PTKpiCard label="Clients affected" value={byClient.size} />
          <PTKpiCard label="Over 30 days" value={unpaidRows.filter((u) => differenceInCalendarDays(new Date(), new Date(u.starts_at)) > 30).length} tone="red" />
        </div>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <PTKpiCard label="Active plans" value={planStats.active} icon={Repeat} />
          <PTKpiCard label="Due next 7 days" value={planStats.due7} icon={Clock} tone="gold" />
          <PTKpiCard label="Due next 30 days" value={planStats.due30} />
          <PTKpiCard label="Successful this month" value={formatCents(planStats.succeededMonth)} icon={CheckCircle2} tone="green" />
          <PTKpiCard label="Failed" value={planStats.failed} icon={AlertTriangle} tone="red" />
          <PTKpiCard label="Past due" value={planStats.pastDue} tone="red" />
          <PTKpiCard label="Completing soon" value={planStats.completingSoon} />
        </div>
      )}

      <PTCard padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-1">
          <PTTabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "unpaid", label: "Unpaid sessions", count: unpaid.length },
              { value: "autopay", label: "Autopay & payment plans", count: plans.length },
              { value: "activity", label: "Payment activity", count: payments.length },
            ]}
          />
          <div className="flex items-center gap-2">
            {tab === "unpaid" && (
              <Select value={age} onValueChange={(v) => setAge(v as AgeFilter)}>
                <SelectTrigger className="h-9 w-40 border-pt-line bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="8-30">8–30 days</SelectItem>
                  <SelectItem value="31">31+ days</SelectItem>
                </SelectContent>
              </Select>
            )}
            {tab === "autopay" && (
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-9 w-40 border-pt-line bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="week">Due this week</SelectItem>
                  <SelectItem value="month">Due this month</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="past_due">Past due</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client…"
              className="h-9 w-52 border-pt-line bg-white"
            />
          </div>
        </div>

        {tab === "unpaid" && (
          <>
            {byClient.size > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-pt-line px-3 py-2">
                {[...byClient.entries()].filter(([, list]) => list.length > 1).map(([uid, list]) => (
                  <button
                    key={uid}
                    className={ptButtonClass("outline")}
                    onClick={() => setCheckout(list)}
                  >
                    Check out all for {nameOf(uid)} · {list.length} · {formatCents(list.reduce((s, x) => s + (x.amount_due_cents || 0), 0))}
                  </button>
                ))}
              </div>
            )}
            <PTTable
              columns={unpaidColumns}
              rows={unpaidRows}
              loading={loadingUnpaid}
              getRowKey={(u) => u.id}
              onRowClick={(u) => navigate(`/admin/pt/clients/${u.user_id}`)}
              empty={<PTEmptyState icon={CheckCircle2} title="Nothing outstanding" description="Every completed PT session has been settled." />}
            />
          </>
        )}

        {tab === "autopay" && (
          <PTTable
            columns={planColumns}
            rows={planRows}
            loading={loadingPlans}
            getRowKey={(p) => p.id}
            onRowClick={(p) => setOpenPlan(p)}
            empty={<PTEmptyState icon={Repeat} title="No payment plans" description="Installment plans created from a package sale appear here." />}
          />
        )}

        {tab === "activity" && (
          <PTTable
            columns={paymentColumns}
            rows={payments}
            loading={loadingPayments}
            getRowKey={(p) => p.id}
            empty={<PTEmptyState icon={Wallet} title="No PT payments recorded yet" />}
          />
        )}
      </PTCard>

      <PTSessionCheckoutDialog
        sessions={checkout}
        clientName={checkout[0] ? nameOf(checkout[0].user_id) : ""}
        onClose={() => setCheckout([])}
      />

      <PlanDetailModal
        plan={openPlan}
        clientName={openPlan ? nameOf(openPlan.user_id) : ""}
        onClose={() => setOpenPlan(null)}
      />
    </PTShell>
  );
}

/* ---------------------------------------------------------- plan detail */

function PlanDetailModal({
  plan, clientName, onClose,
}: {
  plan: PTPlanRow | null;
  clientName: string;
  onClose: () => void;
}) {
  const schedule = useMemo(() => {
    if (!plan) return [];
    const total = plan.payment_plan_total_installments ?? 0;
    const paid = plan.payment_plan_installments_paid ?? 0;
    const amount = plan.payment_plan_installment_cents ?? 0;
    const next = plan.payment_plan_next_payment_date
      ? new Date(`${plan.payment_plan_next_payment_date}T12:00:00`)
      : null;
    return Array.from({ length: total }, (_, i) => {
      const isPaid = i < paid;
      const monthsFromNext = i - paid;
      const date = next ? new Date(next.getFullYear(), next.getMonth() + monthsFromNext, next.getDate()) : null;
      // Rounding lands on the final installment so no cents are lost.
      const isFinal = i === total - 1;
      const cents = isFinal && plan.payment_plan_total_cents
        ? plan.payment_plan_total_cents - amount * (total - 1)
        : amount;
      return {
        index: i,
        date,
        cents,
        state: isPaid ? "SUCCESSFUL" : plan.payment_plan_status === "past_due" && i === paid ? "PAST DUE" : "UPCOMING",
      };
    });
  }, [plan]);

  return (
    <PTModal
      open={!!plan}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Payment plan"
      description={plan ? `${clientName} · ${plan.pack_name}` : ""}
      footer={<button className={ptButtonClass("outline")} onClick={onClose}>Close</button>}
    >
      {plan && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Summary label="Package total" value={formatCents(plan.payment_plan_total_cents ?? 0)} />
            <Summary label="Amount paid" value={formatCents(plan.amount_paid_cents ?? 0)} />
            <Summary label="Money remaining" value={formatCents(plan.amount_outstanding_cents ?? 0)} />
            <Summary label="Sessions remaining" value={`${plan.sessions_remaining} of ${plan.sessions_total}`} />
          </div>

          <PTAlert tone="info" title="Session balance and money balance are separate">
            Sessions remaining is the client's entitlement. Money remaining is the outstanding plan balance.
            Neither one is inferred from the other.
          </PTAlert>

          <div>
            <div className="mb-2 text-[13px] font-medium text-pt-ink">Timeline</div>
            <div className="rounded-lg border border-pt-line divide-y divide-pt-line/60">
              {schedule.length === 0 && <div className="px-3 py-4 text-sm text-pt-muted">No installments recorded.</div>}
              {schedule.map((s) => (
                <div key={s.index} className="flex items-center justify-between px-3 py-2 text-[13px]">
                  <span>{s.date ? fmtDate(s.date, "MMM d, yyyy") : `Installment ${s.index + 1}`}</span>
                  <span className="tabular-nums">{formatCents(s.cents)}</span>
                  <PTBadge tone={s.state === "SUCCESSFUL" ? "green" : s.state === "PAST DUE" ? "red" : "neutral"}>
                    {s.state}
                  </PTBadge>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-pt-muted">
            <CreditCard className="h-3.5 w-3.5" />
            Stripe subscription {plan.stripe_subscription_id ?? "—"} · payment state is set by Stripe, never from this screen.
          </div>
        </div>
      )}
    </PTModal>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-pt-line px-3 py-2">
      <div className="text-xs text-pt-muted">{label}</div>
      <div className="text-[15px] font-medium text-pt-ink tabular-nums">{value}</div>
    </div>
  );
}
