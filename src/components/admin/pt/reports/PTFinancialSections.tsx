import { useMemo } from "react";
import { Link } from "react-router-dom";
import { format as fmtDate, addDays, differenceInCalendarDays, startOfWeek } from "date-fns";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, DollarSign, CalendarClock, AlertTriangle, Users, Package, TrendingUp, Info } from "lucide-react";
import {
  PTCard, PTKpiCard, PTTable, PTColumn, PTEmptyState, PTSectionTitle, PTBadge, ptButtonClass, PTAlert,
} from "@/components/admin/pt/PTUI";
import { formatCents } from "@/lib/ptFormat";
import { downloadCsv } from "@/lib/ptExport";
import {
  PTFinancialData, contractValueOf, dueAtSaleOf, isPlanSale, saleDateOf,
} from "@/hooks/pt/usePTFinancialReports";
import {
  PTFinContext, filterCash, filterInstallments, filterPasses, isFailed, isPaid, isUpcoming, matchesClient, matchesTrainer,
} from "./ptReportFilters";

const GOLD = "hsl(var(--pt-gold))";
const NOIR = "hsl(var(--pt-noir))";
const GREEN = "hsl(var(--pt-green))";

const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");
const pretty = (d: string) => (d ? fmtDate(new Date(`${d}T12:00:00`), "MMM d, yyyy") : "—");
const dollars = (cents: number) => (cents / 100).toFixed(2);

export interface SectionProps {
  data: PTFinancialData;
  ctx: PTFinContext;
  loading: boolean;
}

function Block({
  title, note, onExport, columns, rows, keyOf,
}: {
  title: string;
  note?: string;
  onExport: () => void;
  columns: PTColumn<any>[];
  rows: any[];
  keyOf?: (r: any, i: number) => string;
}) {
  return (
    <div>
      <PTSectionTitle action={
        <button className={ptButtonClass("outline")} onClick={onExport}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      }>{title}</PTSectionTitle>
      {note && <p className="text-xs text-pt-muted -mt-2 mb-3">{note}</p>}
      <PTCard padded={false}>
        <PTTable
          columns={columns}
          rows={rows}
          getRowKey={keyOf ?? ((r: any, i: number) => r.id ?? String(i))}
          empty={<PTEmptyState icon={Info} title="Nothing in this range" description="Widen the date range or clear a filter." />}
        />
      </PTCard>
    </div>
  );
}

const clientLink = (userId: string, label: string) => (
  <Link to={`/admin/pt/clients/${userId}/billing`} className="text-pt-ink underline decoration-pt-line hover:decoration-pt-gold">
    {label}
  </Link>
);

/* ------------------------------------------------------------------ shared */

function useFinancials(data: PTFinancialData, ctx: PTFinContext) {
  return useMemo(() => {
    const today = day(new Date().toISOString());
    const sales = filterPasses(ctx, data.passes);
    const cash = filterCash(ctx, data.cash);
    const installments = filterInstallments(ctx, data.installments);

    const collected = cash.filter((c) => c.direction === "collected").reduce((s, c) => s + c.amount_cents, 0);
    const refunded = cash.filter((c) => c.direction === "refunded").reduce((s, c) => s + Math.abs(c.amount_cents), 0);

    const upcoming = installments.filter((i) => isUpcoming(i) && day(i.due_date) >= today);
    const failed = installments.filter((i) => isFailed(i) || (isUpcoming(i) && day(i.due_date) < today));

    const appts = data.appointments.filter((a) => matchesClient(ctx, a.user_id) && matchesTrainer(ctx, a.user_id));
    const completed = appts.filter((a) => a.status === "completed");
    const unpaidCompleted = completed.filter((a) => a.payment_status === "unpaid");

    const activePasses = data.passes.filter((p) =>
      p.status === "active" && matchesClient(ctx, p.user_id) && matchesTrainer(ctx, p.user_id)
      && (ctx.filters.packId === "all" || p.pack_id === ctx.filters.packId));

    return {
      today,
      sales, cash, installments, upcoming, failed,
      contractValue: sales.reduce((s, p) => s + contractValueOf(p), 0),
      collected, refunded, net: collected - refunded,
      futureScheduled: upcoming.reduce((s, i) => s + i.amount_cents, 0),
      failedCents: failed.reduce((s, i) => s + i.amount_cents, 0),
      completed,
      unpaidCompleted,
      unpaidCompletedCents: unpaidCompleted.reduce((s, a) => s + (a.amount_due_cents || 0), 0),
      activeClients: new Set(activePasses.map((p) => p.user_id)).size,
      activePasses,
      outstanding: data.passes
        .filter((p) => matchesClient(ctx, p.user_id) && matchesTrainer(ctx, p.user_id))
        .reduce((s, p) => s + (p.amount_outstanding_cents || 0), 0),
    };
  }, [data, ctx]);
}

/* ---------------------------------------------------------------- overview */

export function PTOverviewSection({ data, ctx }: SectionProps) {
  const f = useFinancials(data, ctx);

  const cashSeries = useMemo(() => {
    const map = new Map<string, { date: string; cash: number; sales: number }>();
    const touch = (d: string) => map.get(d) ?? { date: d, cash: 0, sales: 0 };
    f.cash.forEach((c) => {
      const d = day(c.occurred_at);
      const row = touch(d);
      row.cash += c.amount_cents / 100;
      map.set(d, row);
    });
    f.sales.forEach((p) => {
      const d = saleDateOf(p);
      const row = touch(d);
      row.sales += contractValueOf(p) / 100;
      map.set(d, row);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [f]);

  const autopaySeries = useMemo(() => {
    const buckets = new Map<string, number>();
    f.upcoming.forEach((i) => {
      const start = day(startOfWeek(new Date(`${day(i.due_date)}T12:00:00`), { weekStartsOn: 1 }).toISOString());
      buckets.set(start, (buckets.get(start) ?? 0) + i.amount_cents / 100);
    });
    return Array.from(buckets.entries())
      .map(([week, amount]) => ({ week: fmtDate(new Date(`${week}T12:00:00`), "MMM d"), amount }))
      .slice(0, 12);
  }, [f]);

  return (
    <div className="space-y-6">
      <PTAlert tone="info" title="Sales and cash are never combined">
        Contract value is what clients agreed to pay. Cash collected is money actually taken. Future scheduled
        autopay is contracted but not yet collected — these three figures are reported separately on purpose.
      </PTAlert>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PTKpiCard label="Contract value sold" value={formatCents(f.contractValue)} icon={Package} hint={`${f.sales.length} packages sold`} />
        <PTKpiCard label="Cash collected" value={formatCents(f.collected)} tone="green" icon={DollarSign} hint={`Net ${formatCents(f.net)} after refunds`} />
        <PTKpiCard label="Future scheduled autopay" value={formatCents(f.futureScheduled)} tone="gold" icon={CalendarClock} hint={`${f.upcoming.length} installments contracted`} />
        <PTKpiCard label="Past due / failed" value={formatCents(f.failedCents)} tone="red" icon={AlertTriangle} hint={`${f.failed.length} installments`} />
        <PTKpiCard label="Refunds" value={formatCents(f.refunded)} tone="amber" />
        <PTKpiCard label="Unpaid completed sessions" value={formatCents(f.unpaidCompletedCents)} tone="red" hint={`${f.unpaidCompleted.length} sessions`} />
        <PTKpiCard label="Active PT clients" value={f.activeClients} icon={Users} hint="Clients holding an active package" />
        <PTKpiCard label="Sessions completed" value={f.completed.length} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PTCard>
          <PTSectionTitle>Cash collected over time</PTSectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--pt-line))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="cash" name="Cash collected" stroke={GREEN} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PTCard>
        <PTCard>
          <PTSectionTitle>Sales vs cash collected</PTSectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--pt-line))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="sales" name="Contract value" fill={NOIR} radius={[3, 3, 0, 0]} />
                <Bar dataKey="cash" name="Cash collected" fill={GOLD} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PTCard>
      </div>

      {autopaySeries.length > 0 && (
        <PTCard>
          <PTSectionTitle>Upcoming autopay by week</PTSectionTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={autopaySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--pt-line))" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="amount" name="Scheduled" fill={GOLD} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PTCard>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- sales */

export function PTSalesSection({ data, ctx }: SectionProps) {
  const f = useFinancials(data, ctx);
  const rows = f.sales;

  const planSales = rows.filter(isPlanSale);
  const payInFull = rows.filter((p) => !isPlanSale(p));
  const avg = rows.length ? Math.round(f.contractValue / rows.length) : 0;

  const cols: PTColumn<any>[] = [
    { key: "date", header: "Sale date", render: (p) => pretty(saleDateOf(p)) },
    { key: "client", header: "Client", render: (p) => clientLink(p.user_id, ctx.nameOf(p.user_id)) },
    { key: "pack", header: "Package", render: (p) => p.pack_name },
    {
      key: "trainer", header: "Trainer", render: (p) => {
        const t = ctx.attribution[p.user_id];
        return t ? ctx.trainerNameOf(t) : <span className="text-pt-muted">Unattributed</span>;
      },
    },
    { key: "total", header: "Package total", align: "right", render: (p) => formatCents(contractValueOf(p)) },
    {
      key: "structure", header: "Structure", render: (p) => (
        <PTBadge tone={isPlanSale(p) ? "gold" : "neutral"}>
          {isPlanSale(p) ? (p.payment_plan_name_snapshot ?? `${p.payment_plan_total_installments ?? "—"} payments`) : "Pay in full"}
        </PTBadge>
      ),
    },
    { key: "due", header: "Due at sale", align: "right", render: (p) => formatCents(dueAtSaleOf(p)) },
    { key: "status", header: "Status", render: (p) => <PTBadge tone={p.status === "active" ? "green" : "neutral"}>{String(p.status).replace(/_/g, " ")}</PTBadge> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PTKpiCard label="Packages sold" value={rows.length} />
        <PTKpiCard label="Contract value sold" value={formatCents(f.contractValue)} tone="gold" />
        <PTKpiCard label="Average package value" value={formatCents(avg)} />
        <PTKpiCard label="Pay-in-full sales" value={payInFull.length} />
        <PTKpiCard label="Payment-plan sales" value={planSales.length} />
      </div>
      <Block
        title="Package sales"
        note="Contract value at the moment of sale. This is not cash — see Cash Collected for money actually taken."
        columns={cols}
        rows={rows}
        onExport={() => downloadCsv(`pt-sales-${ctx.filters.from}_${ctx.filters.to}`, rows.map((p) => ({
          sale_date: saleDateOf(p),
          client: ctx.nameOf(p.user_id),
          package: p.pack_name,
          trainer: ctx.attribution[p.user_id] ? ctx.trainerNameOf(ctx.attribution[p.user_id]) : "Unattributed",
          package_total: dollars(contractValueOf(p)),
          structure: isPlanSale(p) ? (p.payment_plan_name_snapshot ?? "Payment plan") : "Pay in full",
          due_at_sale: dollars(dueAtSaleOf(p)),
          status: p.status,
        })))}
      />
    </div>
  );
}

/* --------------------------------------------------------- cash collected */

export function PTCashSection({ data, ctx }: SectionProps) {
  const f = useFinancials(data, ctx);

  // Refunds attach to the exact payment they reversed — never spread across a package.
  const refundsByPayment = useMemo(() => {
    const m = new Map<string, number>();
    data.cash.filter((c) => c.direction === "refunded" && c.related_payment_id).forEach((r) => {
      m.set(r.related_payment_id, (m.get(r.related_payment_id) ?? 0) + Math.abs(r.amount_cents));
    });
    return m;
  }, [data.cash]);

  const rows = f.cash
    .filter((c) => c.direction === "collected")
    .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
    .map((c) => {
      const pass = c.pass_id ? ctx.passById[c.pass_id] : undefined;
      const refund = refundsByPayment.get(c.source_id) ?? 0;
      return { ...c, packName: pass?.pack_name ?? "—", refund, netCents: c.amount_cents - refund };
    });


  const packageSettled = data.appointments.filter(
    (a) => a.status === "completed" && (a.package_deducted || a.payment_status === "pass")
      && matchesClient(ctx, a.user_id) && matchesTrainer(ctx, a.user_id));

  const cols: PTColumn<any>[] = [
    { key: "date", header: "Date", render: (r) => pretty(day(r.occurred_at)) },
    { key: "client", header: "Client", render: (r) => clientLink(r.user_id, ctx.nameOf(r.user_id)) },
    { key: "pack", header: "Package / session", render: (r) => r.packName },
    { key: "type", header: "Payment type", render: (r) => <PTBadge>{String(r.payment_type ?? "payment").replace(/_/g, " ")}</PTBadge> },
    { key: "method", header: "Method", render: (r) => String(r.method ?? "—").replace(/_/g, " ") },
    { key: "gross", header: "Gross", align: "right", render: (r) => formatCents(r.amount_cents) },
    { key: "refund", header: "Refunds", align: "right", render: (r) => (r.refund ? <span className="text-pt-red">-{formatCents(r.refund)}</span> : "—") },
    { key: "net", header: "Net", align: "right", render: (r) => formatCents(r.netCents) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PTKpiCard label="Gross collected" value={formatCents(f.collected)} tone="green" icon={DollarSign} />
        <PTKpiCard label="Refunds" value={formatCents(f.refunded)} tone="red" />
        <PTKpiCard label="Net collected" value={formatCents(f.net)} tone="gold" />
        <PTKpiCard label="Package-settled sessions" value={packageSettled.length} hint="$0 new cash — paid for at purchase" />
      </div>
      <Block
        title="Cash collected"
        note="Successful money only. Scheduled autopay, failed payments, package-credit sessions and waived sessions are excluded."
        columns={cols}
        rows={rows}
        keyOf={(r) => r.transaction_key}
        onExport={() => downloadCsv(`pt-cash-${ctx.filters.from}_${ctx.filters.to}`, rows.map((r) => ({
          date: day(r.occurred_at),
          client: ctx.nameOf(r.user_id),
          package: r.packName,
          payment_type: r.payment_type,
          method: r.method,
          gross: dollars(r.amount_cents),
          refunds: dollars(r.refund),
          net: dollars(r.netCents),
        })))}
      />
    </div>
  );
}

/* --------------------------------------------------------- autopay and A/R */

export function PTAutopaySection({ data, ctx }: SectionProps) {
  const f = useFinancials(data, ctx);
  const today = f.today;
  const in7 = day(addDays(new Date(), 7).toISOString());
  const in30 = day(addDays(new Date(), 30).toISOString());

  const upcoming = f.upcoming.sort((a, b) => day(a.due_date).localeCompare(day(b.due_date)));
  const failed = f.failed.sort((a, b) => day(a.due_date).localeCompare(day(b.due_date)));

  const due7 = upcoming.filter((i) => day(i.due_date) <= in7).reduce((s, i) => s + i.amount_cents, 0);
  const due30 = upcoming.filter((i) => day(i.due_date) <= in30).reduce((s, i) => s + i.amount_cents, 0);

  const upcomingCols: PTColumn<any>[] = [
    { key: "client", header: "Client", render: (i) => clientLink(i.user_id, ctx.nameOf(i.user_id)) },
    { key: "pack", header: "Package", render: (i) => ctx.passById[i.pass_id]?.pack_name ?? "—" },
    { key: "due", header: "Due date", render: (i) => pretty(day(i.due_date)) },
    { key: "n", header: "Installment", align: "right", render: (i) => `#${i.installment_number}` },
    { key: "amount", header: "Amount", align: "right", render: (i) => formatCents(i.amount_cents) },
    { key: "card", header: "Card", render: (i) => (i.payment_method_last4 ? `${i.payment_method_brand ?? "card"} ••${i.payment_method_last4}` : "—") },
    { key: "status", header: "Status", render: (i) => <PTBadge tone="gold">{String(i.status).replace(/_/g, " ")}</PTBadge> },
  ];

  const failedCols: PTColumn<any>[] = [
    { key: "client", header: "Client", render: (i) => clientLink(i.user_id, ctx.nameOf(i.user_id)) },
    { key: "pack", header: "Package", render: (i) => ctx.passById[i.pass_id]?.pack_name ?? "—" },
    { key: "amount", header: "Amount", align: "right", render: (i) => formatCents(i.amount_cents) },
    { key: "orig", header: "Original due", render: (i) => pretty(day(i.original_due_date ?? i.due_date)) },
    { key: "status", header: "Failure status", render: (i) => <PTBadge tone="red">{String(i.status).replace(/_/g, " ")}</PTBadge> },
    { key: "reason", header: "Reason", render: (i) => i.last_failure_reason ?? "—" },
    { key: "attempts", header: "Attempts", align: "right", render: (i) => i.attempt_count ?? 0 },
    { key: "outstanding", header: "Package outstanding", align: "right", render: (i) => formatCents(ctx.passById[i.pass_id]?.amount_outstanding_cents ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <PTKpiCard label="Scheduled next 7 days" value={formatCents(due7)} icon={CalendarClock} />
        <PTKpiCard label="Scheduled next 30 days" value={formatCents(due30)} />
        <PTKpiCard label="Total future contracted autopay" value={formatCents(f.futureScheduled)} tone="gold" />
        <PTKpiCard label="Past due / failed" value={formatCents(f.failedCents)} tone="red" hint={`${failed.length} installments`} />
        <PTKpiCard label="Outstanding PT receivables" value={formatCents(f.outstanding)} tone="amber" hint="Unpaid balance across packages" />
        <PTKpiCard label="Unpaid completed sessions" value={formatCents(f.unpaidCompletedCents)} tone="red" />
      </div>
      <Block
        title="Upcoming autopay"
        note="Read directly from the stored installment records created at the time of sale. No dates are recalculated here."
        columns={upcomingCols}
        rows={upcoming}
        onExport={() => downloadCsv("pt-upcoming-autopay", upcoming.map((i) => ({
          client: ctx.nameOf(i.user_id), package: ctx.passById[i.pass_id]?.pack_name ?? "",
          due_date: day(i.due_date), installment: i.installment_number,
          amount: dollars(i.amount_cents), status: i.status,
        })))}
      />
      <Block
        title="Failed / past due"
        columns={failedCols}
        rows={failed}
        onExport={() => downloadCsv("pt-failed-autopay", failed.map((i) => ({
          client: ctx.nameOf(i.user_id), package: ctx.passById[i.pass_id]?.pack_name ?? "",
          amount: dollars(i.amount_cents), original_due: day(i.original_due_date ?? i.due_date),
          status: i.status, reason: i.last_failure_reason ?? "", attempts: i.attempt_count ?? 0,
          package_outstanding: dollars(ctx.passById[i.pass_id]?.amount_outstanding_cents ?? 0),
        })))}
      />
      <p className="text-xs text-pt-muted">
        Retries are performed from the client billing account or the PT Billing centre so the same obligation is used —
        this report never charges a card.
      </p>
    </div>
  );
}

/* ------------------------------------------- packages and unused obligation */

export function PTPackagesSection({ data, ctx }: SectionProps) {
  const f = useFinancials(data, ctx);

  const rows = useMemo(() => data.passes
    .filter((p) => matchesClient(ctx, p.user_id) && matchesTrainer(ctx, p.user_id)
      && (ctx.filters.packId === "all" || p.pack_id === ctx.filters.packId))
    .map((p) => {
      const used = (p.sessions_total ?? 0) - (p.sessions_remaining ?? 0);
      const paid = p.amount_paid_cents ?? 0;
      const total = p.sessions_total ?? 0;
      // Operational obligation only: value of paid-for sessions not yet delivered.
      const unusedValue = total > 0 ? Math.round((paid / total) * (p.sessions_remaining ?? 0)) : 0;
      return { ...p, used, unusedValue, daysLeft: p.expires_at ? differenceInCalendarDays(new Date(`${day(p.expires_at)}T12:00:00`), new Date()) : null };
    })
    .sort((a, b) => String(a.expires_at ?? "").localeCompare(String(b.expires_at ?? ""))), [data.passes, ctx]);

  const active = rows.filter((r) => r.status === "active");
  const expiringSoon = active.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 45);
  const unusedTotal = active.reduce((s, r) => s + r.unusedValue, 0);

  const cols: PTColumn<any>[] = [
    { key: "client", header: "Client", render: (p) => clientLink(p.user_id, ctx.nameOf(p.user_id)) },
    { key: "pack", header: "Package", render: (p) => p.pack_name },
    { key: "sold", header: "Purchased", align: "right", render: (p) => p.sessions_total },
    { key: "used", header: "Used", align: "right", render: (p) => p.used },
    { key: "left", header: "Remaining", align: "right", render: (p) => p.sessions_remaining },
    { key: "exp", header: "Expires", render: (p) => (p.expires_at ? pretty(day(p.expires_at)) : "—") },
    { key: "paid", header: "Amount paid", align: "right", render: (p) => formatCents(p.amount_paid_cents ?? 0) },
    { key: "fin", header: "Financial status", render: (p) => <PTBadge tone={(p.amount_outstanding_cents ?? 0) > 0 ? "amber" : "green"}>{p.financial_status ?? ((p.amount_outstanding_cents ?? 0) > 0 ? "balance owing" : "settled")}</PTBadge> },
    { key: "unused", header: "Unused paid value", align: "right", render: (p) => formatCents(p.unusedValue) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PTKpiCard label="Sessions sold" value={rows.reduce((s, r) => s + (r.sessions_total ?? 0), 0)} />
        <PTKpiCard label="Sessions completed" value={f.completed.length} hint="In selected range" />
        <PTKpiCard label="Sessions remaining" value={active.reduce((s, r) => s + (r.sessions_remaining ?? 0), 0)} />
        <PTKpiCard label="Approaching expiration" value={expiringSoon.length} tone="red" hint="Within 45 days" />
        <PTKpiCard label="Active packages" value={active.length} tone="gold" />
      </div>

      <PTAlert tone="info" title={`Unused paid session value: ${formatCents(unusedTotal)}`}>
        An operational service-obligation figure — the value of sessions clients have already paid for and not yet
        taken, calculated from each sold agreement. This is not an accounting balance-sheet liability.
      </PTAlert>

      <Block
        title="Packages and session obligation"
        columns={cols}
        rows={rows}
        onExport={() => downloadCsv("pt-packages-obligation", rows.map((p) => ({
          client: ctx.nameOf(p.user_id), package: p.pack_name,
          sessions_purchased: p.sessions_total, sessions_used: p.used, sessions_remaining: p.sessions_remaining,
          expires: day(p.expires_at), amount_paid: dollars(p.amount_paid_cents ?? 0),
          outstanding: dollars(p.amount_outstanding_cents ?? 0),
          unused_paid_value: dollars(p.unusedValue), status: p.status,
        })))}
      />
    </div>
  );
}

/* ------------------------------------------------------ trainer performance */

export function PTTrainerSection({ data, ctx }: SectionProps) {
  const f = useFinancials(data, ctx);

  const delivered = useMemo(() => {
    const map = new Map<string, any>();
    data.appointments
      .filter((a) => a.status === "completed" && matchesClient(ctx, a.user_id))
      .forEach((a) => {
        const key = a.instructor_id ?? "unassigned";
        const row = map.get(key) ?? { id: key, trainer: key === "unassigned" ? "Unassigned" : ctx.trainerNameOf(key), sessions: 0, clients: new Set<string>(), minutes: 0 };
        row.sessions += 1;
        row.minutes += a.duration_minutes || 60;
        if (a.user_id) row.clients.add(a.user_id);
        map.set(key, row);
      });
    return Array.from(map.values())
      .map((r) => ({ ...r, clientCount: r.clients.size, hours: Math.round(r.minutes / 60) }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [data.appointments, ctx]);

  const attribution = useMemo(() => {
    const map = new Map<string, any>();
    f.sales.forEach((p) => {
      const key = ctx.attribution[p.user_id] ?? "unattributed";
      const row = map.get(key) ?? {
        id: key, trainer: key === "unattributed" ? "Unattributed" : ctx.trainerNameOf(key),
        packages: 0, contract: 0, cash: 0, clients: new Set<string>(),
      };
      row.packages += 1;
      row.contract += contractValueOf(p);
      row.clients.add(p.user_id);
      map.set(key, row);
    });
    f.cash.filter((c) => c.direction === "collected").forEach((c) => {
      const key = ctx.attribution[c.user_id] ?? "unattributed";
      const row = map.get(key) ?? {
        id: key, trainer: key === "unattributed" ? "Unattributed" : ctx.trainerNameOf(key),
        packages: 0, contract: 0, cash: 0, clients: new Set<string>(),
      };
      row.cash += c.amount_cents;
      map.set(key, row);
    });
    const sessionsByTrainer = new Map<string, number>();
    data.appointments.filter((a) => a.status === "completed").forEach((a) => {
      const k = a.instructor_id ?? "unassigned";
      sessionsByTrainer.set(k, (sessionsByTrainer.get(k) ?? 0) + 1);
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, clientCount: r.clients.size, sessions: sessionsByTrainer.get(r.id) ?? 0 }))
      .sort((a, b) => b.contract - a.contract);
  }, [f, ctx, data.appointments]);

  const deliveredCols: PTColumn<any>[] = [
    { key: "trainer", header: "Trainer", render: (r) => r.trainer },
    { key: "sessions", header: "Sessions completed", align: "right", render: (r) => r.sessions },
    { key: "clients", header: "Clients served", align: "right", render: (r) => r.clientCount },
    { key: "hours", header: "Session hours", align: "right", render: (r) => r.hours },
  ];

  const attrCols: PTColumn<any>[] = [
    { key: "trainer", header: "Trainer", render: (r) => (r.id === "unattributed" ? <span className="text-pt-muted">Unattributed</span> : r.trainer) },
    { key: "packages", header: "Packages", align: "right", render: (r) => r.packages },
    { key: "contract", header: "Contract value", align: "right", render: (r) => formatCents(r.contract) },
    { key: "cash", header: "Cash collected", align: "right", render: (r) => formatCents(r.cash) },
    { key: "clients", header: "Active PT clients", align: "right", render: (r) => r.clientCount },
    { key: "sessions", header: "Sessions delivered", align: "right", render: (r) => (r.id === "unattributed" ? "—" : r.sessions) },
  ];

  return (
    <div className="space-y-6">
      <PTAlert tone="info" title="Attribution methodology">
        Sessions delivered come from completed appointments — who actually ran the session. Sales attribution uses only
        the explicit trainer relationship recorded on a client's file. Where no such relationship exists the sale is
        shown as Unattributed; it is never inferred from who delivered the sessions.
      </PTAlert>

      <Block
        title="Sessions delivered"
        columns={deliveredCols}
        rows={delivered}
        onExport={() => downloadCsv("pt-sessions-delivered", delivered.map((r) => ({
          trainer: r.trainer, sessions_completed: r.sessions, clients_served: r.clientCount, hours: r.hours,
        })))}
      />
      <Block
        title="Sales attribution"
        note="Only where an explicit trainer relationship exists."
        columns={attrCols}
        rows={attribution}
        onExport={() => downloadCsv("pt-sales-attribution", attribution.map((r) => ({
          trainer: r.trainer, packages: r.packages, contract_value: dollars(r.contract),
          cash_collected: dollars(r.cash), clients: r.clientCount, sessions_delivered: r.sessions,
        })))}
      />
    </div>
  );
}

export { useFinancials };
