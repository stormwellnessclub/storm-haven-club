// Phase 2C.5B3 — the staff-side PT client billing account.
//
// One workspace that answers a client's whole PT financial position: what they
// own, what was collected, what is scheduled, what failed, and which card will
// be charged next. Every number is read from the authoritative records; money
// events and session-entitlement events are never mixed.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format as fmtDate, parseISO } from "date-fns";
import {
  CalendarClock, CreditCard, FileText, Plus, Receipt, Undo2, Wallet, AlertTriangle, Shield, History,
} from "lucide-react";
import {
  PTCard, PTSectionTitle, PTTable, PTBadge, PTEmptyState, PTTabs, PTModal, PTAlert,
  PTStatus, PTTimeline, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { formatCents } from "@/lib/ptFormat";
import { PTBalanceBreakdown } from "@/components/admin/pt/PTBalanceBreakdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StripeProvider } from "@/components/StripeProvider";
import { AdminAddCardForm } from "@/components/admin/AdminAddCardForm";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  usePTClientPackages, usePTPackageInstallments, usePTClientCards, usePTClientPayments,
  usePTClientUnpaidSessions, usePTClientSettlements, usePTClientFinancialAudit,
  usePTPlanManagement, usePackageFinancials, PT_INSTALLMENT_LABEL, ptInstallmentTone,
  PTPlanInstallmentRow,
} from "@/hooks/pt/usePTClientBillingAccount";
import {
  usePTInvoices, usePTRefunds, usePTFailedPayments, usePTRetryInstallment,
  PT_INVOICE_STATUS_LABEL, ptInvoiceTone, PTInvoiceRow,
} from "@/hooks/pt/usePTBillingCenter";
import { usePTPassHistory, ptEventLabel, PT_PAYMENT_METHOD_LABEL } from "@/hooks/pt/usePTFinancials";
import { PTInvoiceDialog } from "@/components/admin/pt/PTInvoiceDialog";
import { PTInvoiceDetailDialog } from "@/components/admin/pt/PTInvoiceDetailDialog";
import { PTRefundDialog, PTRefundTarget } from "@/components/admin/pt/PTRefundDialog";
import { PTSessionCheckoutDialog } from "@/components/admin/pt/PTSessionCheckoutDialog";

const SUBTABS = [
  "Overview", "AutoPay schedule", "Payment history", "Invoices & receipts",
  "Failed / past due", "Refunds & adjustments", "Payment methods", "Timeline",
] as const;
type SubTab = typeof SUBTABS[number];

const day = (v?: string | null) => (v ? fmtDate(parseISO(`${v.slice(0, 10)}T12:00:00`), "MMM d, yyyy") : "—");
const stamp = (v?: string | null) => (v ? fmtDate(new Date(v), "MMM d, yyyy · h:mm a") : "—");
const todayIso = () => new Date().toISOString().slice(0, 10);

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-pt-line p-3">
      <div className="text-[11px] uppercase tracking-wide text-pt-muted">{label}</div>
      <div className={`text-[15px] font-medium mt-1 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function cardLabel(c?: { brand?: string | null; last4?: string | null } | null) {
  if (!c?.last4) return "—";
  const brand = (c.brand ?? "Card").replace(/^\w/, (x) => x.toUpperCase());
  return `${brand} •••• ${c.last4}`;
}

export function PTClientBillingWorkspace({ userId, clientName }: { userId: string; clientName: string }) {
  const [sub, setSub] = useState<SubTab>("Overview");
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);

  const { hasAnyRole } = useUserRoles();
  const canManageMoney = hasAnyRole(["super_admin", "admin", "manager"]);

  const { data: packages = [] } = usePTClientPackages(userId);
  const activePass = useMemo(() => {
    if (selectedPassId) return packages.find((p) => p.id === selectedPassId) ?? null;
    return packages.find((p) => p.payment_plan_status && p.payment_plan_status !== "completed")
      ?? packages.find((p) => p.status === "active")
      ?? packages[0] ?? null;
  }, [packages, selectedPassId]);

  const { data: installments = [] } = usePTPackageInstallments(activePass?.id);
  const fin = usePackageFinancials(activePass, installments);
  const { data: cardsData } = usePTClientCards(userId);
  const cards = cardsData?.paymentMethods ?? [];
  const { data: payments = [] } = usePTClientPayments(userId);
  const { data: settlements = [] } = usePTClientSettlements(userId);
  const { data: invoices = [] } = usePTInvoices(userId);
  const { data: refunds = [] } = usePTRefunds(userId);
  const { data: unpaid = [] } = usePTClientUnpaidSessions(userId);
  const { data: audit = [] } = usePTClientFinancialAudit(userId);
  const { data: failedAll } = usePTFailedPayments();
  const { data: passHistory = [] } = usePTPassHistory(activePass?.id);
  const retry = usePTRetryInstallment();

  const [newInvoice, setNewInvoice] = useState(false);
  const [openInvoice, setOpenInvoice] = useState<PTInvoiceRow | null>(null);
  const [refundTarget, setRefundTarget] = useState<PTRefundTarget | null>(null);
  const [checkoutSessions, setCheckoutSessions] = useState<any[]>([]);
  const [cardDialog, setCardDialog] = useState(false);
  const [dateDialog, setDateDialog] = useState<PTPlanInstallmentRow | null>(null);
  const [historyFilter, setHistoryFilter] = useState("All");

  const planFailures = installments.filter((i) => i.status === "failed" || i.status === "past_due");
  const dunningForClient = (failedAll?.dunning ?? []).filter((d: any) => d.user_id === userId);
  const unpaidCents = unpaid.reduce((s: number, a: any) => s + (a.amount_due_cents || 0), 0);
  const nextCard = installments.find((i) => i.status === "scheduled");

  /* ------------------------------------------------------- payment history */
  const history = useMemo(() => {
    const rows: any[] = [];
    payments.forEach((p: any) => rows.push({
      key: `p-${p.id}`, date: p.paid_at, kind: "money",
      type: p.payment_type === "installment" ? "AutoPay installment"
        : p.payment_type === "package" ? "Package purchase"
        : p.payment_type === "session" ? "Individual session"
        : p.payment_type === "invoice" ? "Invoice payment" : "Payment",
      description: p.note || p.reference || "PT payment",
      amount: p.amount_cents, method: PT_PAYMENT_METHOD_LABEL[p.method] ?? p.method,
      status: p.status, reference: p.stripe_payment_intent_id || p.reference || null,
      refundedCents: p.refunded_cents ?? 0, raw: p,
    }));
    settlements.forEach((s: any) => rows.push({
      key: `s-${s.id}`, date: s.paid_at ?? s.starts_at, kind: "money",
      type: s.payment_status === "comp" ? "Waived / complimentary" : "Settled by package",
      description: `Session ${day(s.starts_at)}`, amount: 0, method: "—",
      status: "settled", reference: null, refundedCents: 0,
    }));
    refunds.forEach((r: any) => rows.push({
      key: `r-${r.id}`, date: r.refunded_at, kind: "money", type: "Refund",
      description: r.reason, amount: -r.amount_cents,
      method: r.method === "stripe" ? "Card" : "Manual", status: "refunded",
      reference: r.stripe_refund_id, refundedCents: 0,
    }));
    return rows
      .filter((r) => r.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [payments, settlements, refunds]);

  const filteredHistory = useMemo(() => {
    switch (historyFilter) {
      case "Successful": return history.filter((h) => h.status === "succeeded");
      case "Failed": return history.filter((h) => h.status === "failed" || h.status === "past_due");
      case "Refunded": return history.filter((h) => h.type === "Refund" || h.refundedCents > 0);
      case "Manual": return history.filter((h) => h.method !== "Card" && h.amount > 0);
      case "Card": return history.filter((h) => h.method === "Card");
      default: return history;
    }
  }, [history, historyFilter]);

  /* ------------------------------------------------------------- timeline */
  const timeline = useMemo(() => {
    const items = [
      ...history.map((h) => ({
        id: h.key, title: `${h.type} · ${formatCents(Math.abs(h.amount))}`,
        description: "Money event", time: stamp(h.date),
        tone: (h.amount < 0 ? "red" : h.amount === 0 ? "default" : "green") as any,
      })),
      ...passHistory.map((e: any, i: number) => ({
        id: `e-${i}-${e.occurred_at}`,
        title: `${ptEventLabel(e.event_type)} · ${e.delta > 0 ? "+" : ""}${e.delta} session${Math.abs(e.delta) === 1 ? "" : "s"}`,
        description: "Session entitlement event", time: stamp(e.occurred_at), tone: "gold" as any,
      })),
      ...installments.filter((i) => i.status === "scheduled").map((i) => ({
        id: `i-${i.id}`, title: `AutoPay scheduled · ${formatCents(i.amount_cents)}`,
        description: "Money event", time: day(i.due_date), tone: "default" as any,
      })),
    ];
    return items.slice(0, 80);
  }, [history, passHistory, installments]);

  /* --------------------------------------------------------------- alerts */
  const alerts: Array<{ tone: "danger" | "warning" | "info"; title: string; body: string }> = [];
  if (fin.pastDueCents > 0) alerts.push({ tone: "danger", title: "Payment failed", body: `${formatCents(fin.pastDueCents)} past due on ${activePass?.pack_name ?? "this package"}.` });
  if (unpaidCents > 0) alerts.push({ tone: "warning", title: "Unpaid session", body: `${unpaid.length} unpaid session(s) · ${formatCents(unpaidCents)} due.` });
  if (fin.nextDueDate && fin.nextDueDate <= new Date(Date.now() + 86400000).toISOString().slice(0, 10)) {
    alerts.push({ tone: "info", title: "AutoPay tomorrow", body: `${formatCents(fin.nextAmountCents ?? 0)} scheduled ${day(fin.nextDueDate)}.` });
  }
  if (activePass && (activePass.sessions_remaining ?? 0) <= 2 && activePass.status === "active") {
    alerts.push({ tone: "warning", title: "Package low", body: `${activePass.sessions_remaining} session(s) remaining.` });
  }

  if (!userId) return null;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ header */}
      <PTCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="pt-eyebrow">Client</div>
            <h2 className="pt-serif text-2xl text-pt-ink">{clientName}</h2>
            <div className="text-[13px] text-pt-muted mt-1">
              {activePass ? activePass.pack_name : "No PT package on file"}
              {activePass && ` · ${activePass.sessions_remaining}/${activePass.sessions_total} sessions remaining`}
            </div>
          </div>
          <div className="text-right">
            <div className="pt-eyebrow">Next autopay</div>
            <div className="text-[15px] font-medium text-pt-ink">
              {fin.nextDueDate ? `${day(fin.nextDueDate)} · ${formatCents(fin.nextAmountCents ?? 0)}` : "None scheduled"}
            </div>
            <div className="text-[13px] text-pt-muted">{cardLabel(nextCard ? { brand: nextCard.payment_method_brand, last4: nextCard.payment_method_last4 } : cards.find((c) => c.isDefault))}</div>
            {activePass?.payment_plan_status && (
              <div className="mt-1"><PTStatus status={activePass.payment_plan_status} /></div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="pt-eyebrow mb-1.5">Client PT balance (all packages)</div>
          <PTBalanceBreakdown userId={userId} />
        </div>

        <div className="pt-eyebrow mt-4 mb-1.5">This package</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Package total" value={formatCents(fin.totalCents)} />
          <Stat label="Paid" value={formatCents(fin.paidCents)} tone="text-pt-green" />
          <Stat label="Scheduled" value={formatCents(fin.scheduledCents)} />
          <Stat label="Past due" value={formatCents(fin.pastDueCents)} tone={fin.pastDueCents > 0 ? "text-pt-red" : undefined} />
        </div>

        {packages.length > 1 && (
          <div className="mt-4">
            <div className="pt-eyebrow mb-1.5">All PT accounts</div>
            <div className="flex flex-wrap gap-2">
              {packages.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPassId(p.id)}
                  className={`rounded-lg border px-3 py-2 text-left ${p.id === activePass?.id ? "border-pt-gold bg-pt-beige/40" : "border-pt-line"}`}
                >
                  <div className="text-[13px] text-pt-ink">{p.pack_name}</div>
                  <div className="text-[11px] text-pt-muted">
                    {String(p.status).toUpperCase()} · {p.sessions_remaining} left ·{" "}
                    {(p.amount_outstanding_cents ?? 0) > 0 ? `${formatCents(p.amount_outstanding_cents)} remaining` : "Paid in full"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </PTCard>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((a, i) => (
            <PTAlert key={i} tone={a.tone} title={a.title}>{a.body}</PTAlert>
          ))}
        </div>
      )}

      <PTTabs<SubTab>
        tabs={SUBTABS.map((t) => ({
          value: t, label: t,
          count: t === "Failed / past due" ? (planFailures.length + dunningForClient.length) || undefined
            : t === "Invoices & receipts" ? invoices.length || undefined
            : undefined,
        }))}
        value={sub}
        onChange={setSub}
      />

      {/* ---------------------------------------------------------- overview */}
      {sub === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <PTCard className="lg:col-span-2">
            <PTSectionTitle>Package</PTSectionTitle>
            {activePass ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Package" value={activePass.pack_name} />
                <Stat label="Purchased" value={day(activePass.activated_at ?? activePass.created_at)} />
                <Stat label="Sessions" value={`${activePass.sessions_total} total · ${activePass.sessions_total - activePass.sessions_remaining} used · ${activePass.sessions_remaining} left`} />
                <Stat label="Expiration" value={day(activePass.expires_at)} />
              </div>
            ) : <p className="text-[13px] text-pt-muted">No package on file.</p>}

            <div className="mt-5">
              <PTSectionTitle>Payment plan</PTSectionTitle>
              {activePass?.payment_plan_name_snapshot || installments.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Stat label="Plan" value={activePass?.payment_plan_name_snapshot ?? "Payment plan"} />
                    <Stat label="Plan total" value={formatCents(fin.totalCents)} />
                    <Stat label="Paid" value={formatCents(fin.paidCents)} />
                    <Stat label="Future scheduled" value={formatCents(fin.scheduledCents)} />
                    <Stat label="Due at sale" value={formatCents(activePass?.amount_due_at_sale_cents ?? 0)} />
                    <Stat label="Future installments" value={activePass?.future_installment_count ?? Math.max(installments.length - 1, 0)} />
                    <Stat label="Frequency" value={`Every ${activePass?.frequency_interval ?? 1} ${activePass?.frequency_unit ?? "month"}(s)`} />
                    <Stat label="Final payment" value={day(fin.finalDate ?? activePass?.final_payment_date)} />
                  </div>
                  <p className="text-[11px] text-pt-muted mt-2">
                    These are the terms this client agreed to at the time of sale. The catalog template may have
                    changed since — it never rewrites a signed agreement.
                  </p>
                </>
              ) : <p className="text-[13px] text-pt-muted">Paid in full — no payment plan.</p>}
            </div>
          </PTCard>

          <div className="space-y-4">
            <PTCard>
              <PTSectionTitle>Payment method</PTSectionTitle>
              <div className="text-[15px] text-pt-ink">
                {cardLabel(nextCard ? { brand: nextCard.payment_method_brand, last4: nextCard.payment_method_last4 } : cards.find((c) => c.isDefault) ?? cards[0])}
              </div>
              {(() => {
                const c = cards.find((x) => x.isDefault) ?? cards[0];
                return c ? <div className="text-[13px] text-pt-muted">Expires {String(c.expMonth ?? "").padStart(2, "0")}/{String(c.expYear ?? "").slice(-2)}</div> : null;
              })()}
            </PTCard>

            {unpaid.length > 0 && (
              <PTCard>
                <PTSectionTitle action={canManageMoney ? <button className={ptButtonClass("outline")} onClick={() => setCheckoutSessions(unpaid)}>Checkout</button> : undefined}>
                  Unpaid PT sessions
                </PTSectionTitle>
                <div className="text-[15px] font-medium text-pt-red">{formatCents(unpaidCents)}</div>
                <div className="text-[13px] text-pt-muted">{unpaid.length} unpaid past session(s) awaiting payment or a package credit.</div>
              </PTCard>
            )}

            <PTCard>
              <PTSectionTitle>Global billing</PTSectionTitle>
              <Link to="/admin/pt/billing" className="text-[13px] text-pt-gold hover:underline">
                Open PT Billing &amp; Autopay →
              </Link>
            </PTCard>
          </div>
        </div>
      )}

      {/* --------------------------------------------------- autopay schedule */}
      {sub === "AutoPay schedule" && (
        <PTCard padded={false}>
          <div className="p-4 pb-0">
            <PTSectionTitle>AutoPay schedule</PTSectionTitle>
            <p className="text-[11px] text-pt-muted -mt-2 mb-2">
              Every line is a stored obligation — dates are never recalculated for display.
            </p>
          </div>
          <PTTable
            rows={installments}
            getRowKey={(r: any) => r.id}
            empty={<PTEmptyState icon={CalendarClock} title="No payment plan on this package" />}
            columns={[
              { key: "n", header: "#", render: (r: any) => r.installment_number + 1 },
              {
                key: "d", header: "Due date",
                render: (r: any) => (
                  <span>
                    {day(r.due_date)}
                    {r.original_due_date && r.original_due_date !== r.due_date && (
                      <span className="block text-[11px] text-pt-muted">was {day(r.original_due_date)}</span>
                    )}
                  </span>
                ),
              },
              { key: "a", header: "Amount", align: "right", render: (r: any) => formatCents(r.amount_cents) },
              { key: "s", header: "Status", render: (r: any) => <PTBadge tone={ptInstallmentTone(r.status) as any}>{PT_INSTALLMENT_LABEL[r.status] ?? r.status}</PTBadge> },
              { key: "m", header: "Card", render: (r: any) => cardLabel({ brand: r.payment_method_brand, last4: r.payment_method_last4 }) },
              { key: "p", header: "Paid", render: (r: any) => (r.paid_at ? day(r.paid_at) : "—") },
              { key: "inv", header: "Invoice", render: (r: any) => (r.stripe_invoice_id ? <span className="text-pt-muted text-xs">Linked</span> : "—") },
              {
                key: "act", header: "", align: "right",
                render: (r: any) => (canManageMoney && r.status === "scheduled"
                  ? <button className={ptButtonClass("ghost")} onClick={() => setDateDialog(r)}>Move date</button>
                  : null),
              },
            ]}
          />
        </PTCard>
      )}

      {/* --------------------------------------------------- payment history */}
      {sub === "Payment history" && (
        <PTCard padded={false}>
          <div className="p-4 pb-2 flex flex-wrap gap-1.5">
            {["All", "Successful", "Failed", "Refunded", "Manual", "Card"].map((f) => (
              <button
                key={f}
                onClick={() => setHistoryFilter(f)}
                className={`rounded-full border px-3 py-1 text-[12px] ${historyFilter === f ? "border-pt-gold bg-pt-beige/50 text-pt-ink" : "border-pt-line text-pt-muted"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <PTTable
            rows={filteredHistory}
            getRowKey={(r: any) => r.key}
            empty={<PTEmptyState icon={Wallet} title="No payment history" />}
            columns={[
              { key: "d", header: "Date", render: (r: any) => stamp(r.date) },
              { key: "t", header: "Type", render: (r: any) => r.type },
              { key: "desc", header: "Description", render: (r: any) => <span className="text-pt-muted">{r.description}</span> },
              {
                key: "a", header: "Amount", align: "right",
                render: (r: any) => (r.amount === 0
                  ? <span className="text-pt-muted">$0 · settled by package</span>
                  : formatCents(r.amount)),
              },
              { key: "m", header: "Method", render: (r: any) => r.method },
              { key: "s", header: "Status", render: (r: any) => <PTStatus status={r.status} /> },
              {
                key: "act", header: "", align: "right",
                render: (r: any) => {
                  if (!canManageMoney || !r.raw || r.raw.status !== "succeeded") return null;
                  const net = r.raw.amount_cents - (r.raw.refunded_cents ?? 0);
                  if (net <= 0) return <PTBadge tone="neutral">Refunded</PTBadge>;
                  return (
                    <button
                      className={ptButtonClass("ghost")}
                      onClick={() => setRefundTarget({
                        paymentId: r.raw.id, userId, clientName,
                        amountCents: r.raw.amount_cents, refundedCents: r.raw.refunded_cents ?? 0,
                        stripePaymentIntentId: r.raw.stripe_payment_intent_id ?? null,
                      })}
                    >
                      Refund
                    </button>
                  );
                },
              },
            ]}
          />
        </PTCard>
      )}

      {/* ------------------------------------------------ invoices & receipts */}
      {sub === "Invoices & receipts" && (
        <PTCard padded={false}>
          <div className="p-4 pb-0">
            <PTSectionTitle action={canManageMoney ? <button className={ptButtonClass("outline")} onClick={() => setNewInvoice(true)}><Plus className="h-4 w-4 mr-1.5" />New invoice</button> : undefined}>
              Invoices
            </PTSectionTitle>
          </div>
          <PTTable
            rows={invoices}
            getRowKey={(i: any) => i.id}
            onRowClick={(i: any) => setOpenInvoice(i)}
            empty={<PTEmptyState icon={FileText} title="No invoices" />}
            columns={[
              { key: "n", header: "Invoice", render: (i: any) => i.invoice_number },
              { key: "d", header: "Date", render: (i: any) => day(i.issue_date) },
              { key: "t", header: "Total", align: "right", render: (i: any) => formatCents(i.total_cents) },
              { key: "p", header: "Paid", align: "right", render: (i: any) => formatCents(i.amount_paid_cents) },
              { key: "b", header: "Due", align: "right", render: (i: any) => formatCents(i.amount_due_cents) },
              { key: "s", header: "Status", render: (i: any) => <PTBadge tone={ptInvoiceTone(i.status) as any}>{PT_INVOICE_STATUS_LABEL[i.status] ?? i.status}</PTBadge> },
              { key: "due", header: "Due date", render: (i: any) => day(i.due_date) },
            ]}
          />
          <div className="p-4">
            <PTSectionTitle>Receipts</PTSectionTitle>
            <PTTable
              dense
              rows={payments.filter((p: any) => p.status === "succeeded")}
              getRowKey={(p: any) => p.id}
              empty={<p className="text-[13px] text-pt-muted py-2">No receipts yet.</p>}
              columns={[
                { key: "d", header: "Paid", render: (p: any) => stamp(p.paid_at) },
                { key: "a", header: "Amount", align: "right", render: (p: any) => formatCents(p.amount_cents) },
                {
                  key: "src", header: "Receipt",
                  render: (p: any) => (p.stripe_payment_intent_id
                    ? <span className="text-pt-muted">Card receipt on file</span>
                    : <span className="text-pt-muted">Storm receipt (offline {PT_PAYMENT_METHOD_LABEL[p.method] ?? p.method})</span>),
                },
              ]}
            />
          </div>
        </PTCard>
      )}

      {/* ---------------------------------------------------- failed/past due */}
      {sub === "Failed / past due" && (
        <div className="space-y-4">
          <PTCard padded={false}>
            <div className="p-4 pb-0"><PTSectionTitle>Failed installments</PTSectionTitle></div>
            <PTTable
              rows={planFailures}
              getRowKey={(r: any) => r.id}
              empty={<PTEmptyState icon={Shield} title="Nothing failed or past due" />}
              columns={[
                { key: "a", header: "Amount", render: (r: any) => formatCents(r.amount_cents) },
                { key: "pk", header: "Package", render: () => activePass?.pack_name ?? "—" },
                { key: "n", header: "Installment", render: (r: any) => `#${r.installment_number + 1}` },
                { key: "d", header: "Originally due", render: (r: any) => day(r.original_due_date ?? r.due_date) },
                { key: "f", header: "Failed", render: (r: any) => stamp(r.failed_at) },
                { key: "why", header: "Reason", render: (r: any) => <span className="text-pt-muted">{r.last_failure_reason ?? "—"}</span> },
                { key: "att", header: "Attempts", align: "right", render: (r: any) => r.attempt_count ?? 0 },
                { key: "m", header: "Card", render: (r: any) => cardLabel({ brand: r.payment_method_brand, last4: r.payment_method_last4 }) },
                {
                  key: "act", header: "", align: "right",
                  render: (r: any) => (canManageMoney && r.dunning_id
                    ? <button className={ptButtonClass("primary")} disabled={retry.isPending} onClick={() => retry.mutate(r.dunning_id)}>Retry payment</button>
                    : null),
                },
              ]}
            />
          </PTCard>

          {dunningForClient.length > 0 && (
            <PTCard padded={false}>
              <div className="p-4 pb-0"><PTSectionTitle>Open dunning obligations</PTSectionTitle></div>
              <PTTable
                rows={dunningForClient}
                getRowKey={(d: any) => d.id}
                empty={<p className="text-[13px] text-pt-muted p-4">None.</p>}
                columns={[
                  { key: "a", header: "Amount", render: (d: any) => formatCents(d.amount_cents) },
                  { key: "p", header: "Package", render: (d: any) => d.pack_name ?? "—" },
                  { key: "f", header: "First failed", render: (d: any) => stamp(d.first_failed_at) },
                  { key: "r", header: "Last retry", render: (d: any) => stamp(d.last_retry_at) },
                  { key: "n", header: "Attempts", align: "right", render: (d: any) => d.attempts },
                  { key: "s", header: "Status", render: (d: any) => <PTStatus status={d.status} /> },
                  {
                    key: "act", header: "", align: "right",
                    render: (d: any) => (canManageMoney
                      ? <button className={ptButtonClass("outline")} disabled={retry.isPending} onClick={() => retry.mutate(d.id)}>Retry</button>
                      : null),
                  },
                ]}
              />
              <p className="text-[11px] text-pt-muted p-4 pt-0">
                This is the same obligation shown in the global Failed &amp; Past Due centre — retrying here resolves that one record.
              </p>
            </PTCard>
          )}
        </div>
      )}

      {/* ------------------------------------------------ refunds/adjustments */}
      {sub === "Refunds & adjustments" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PTCard padded={false}>
            <div className="p-4 pb-0"><PTSectionTitle>Refunds (money)</PTSectionTitle></div>
            <PTTable
              rows={refunds}
              getRowKey={(r: any) => r.id}
              empty={<PTEmptyState icon={Undo2} title="No refunds" />}
              columns={[
                { key: "d", header: "Date", render: (r: any) => stamp(r.refunded_at) },
                { key: "a", header: "Refunded", align: "right", render: (r: any) => formatCents(r.amount_cents) },
                { key: "m", header: "Method", render: (r: any) => (r.method === "stripe" ? "Card" : "Manual") },
                { key: "why", header: "Reason", render: (r: any) => <span className="text-pt-muted">{r.reason}</span> },
              ]}
            />
          </PTCard>
          <PTCard padded={false}>
            <div className="p-4 pb-0"><PTSectionTitle>Package adjustments (sessions)</PTSectionTitle></div>
            <PTTable
              rows={passHistory}
              getRowKey={(e: any, i?: number) => `${e.occurred_at}-${e.event_type}-${i}`}
              empty={<PTEmptyState icon={History} title="No entitlement changes" />}
              columns={[
                { key: "d", header: "Date", render: (e: any) => stamp(e.occurred_at) },
                { key: "t", header: "Reason", render: (e: any) => ptEventLabel(e.event_type) },
                { key: "b", header: "Before", align: "right", render: (e: any) => e.sessions_before ?? "—" },
                { key: "c", header: "Change", align: "right", render: (e: any) => `${e.delta > 0 ? "+" : ""}${e.delta}` },
                { key: "a", header: "After", align: "right", render: (e: any) => e.sessions_after ?? "—" },
              ]}
            />
            <p className="text-[11px] text-pt-muted p-4 pt-0">
              Session changes are entitlement, not money — they never appear as revenue.
            </p>
          </PTCard>
        </div>
      )}

      {/* --------------------------------------------------- payment methods */}
      {sub === "Payment methods" && (
        <PTCard>
          <PTSectionTitle action={canManageMoney ? <button className={ptButtonClass("outline")} onClick={() => setCardDialog(true)}><CreditCard className="h-4 w-4 mr-1.5" />Manage cards</button> : undefined}>
            Cards on file
          </PTSectionTitle>
          {cards.length === 0 ? (
            <p className="text-[13px] text-pt-muted">No cards saved for this client.</p>
          ) : (
            <ul className="space-y-2">
              {cards.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-pt-line p-3">
                  <span className="text-[13px] text-pt-ink">
                    {cardLabel(c)} · expires {String(c.expMonth ?? "").padStart(2, "0")}/{String(c.expYear ?? "").slice(-2)}
                  </span>
                  <span className="flex items-center gap-2">
                    {c.isDefault && <PTBadge tone="gold">Default</PTBadge>}
                    {canManageMoney && activePass && fin.scheduledCents > 0 && (
                      <button className={ptButtonClass("ghost")} onClick={() => setCardDialog(true)}>Use for future payments</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PTCard>
      )}

      {/* -------------------------------------------------------- timeline */}
      {sub === "Timeline" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PTCard>
            <PTSectionTitle>Financial timeline</PTSectionTitle>
            <PTTimeline items={timeline} empty={<p className="text-[13px] text-pt-muted">Nothing recorded yet.</p>} />
          </PTCard>
          <PTCard>
            <PTSectionTitle action={<PTBadge tone="noir">Staff only</PTBadge>}>Billing audit trail</PTSectionTitle>
            <PTTimeline
              empty={<p className="text-[13px] text-pt-muted">No financial changes recorded.</p>}
              items={audit.slice(0, 40).map((a: any) => ({
                id: a.id,
                title: String(a.action ?? "").replace(/_/g, " "),
                description: a.entity_type ?? undefined,
                time: stamp(a.created_at),
              }))}
            />
          </PTCard>
        </div>
      )}

      {/* --------------------------------------------------------- dialogs */}
      <PTInvoiceDialog open={newInvoice} userId={userId} clientName={clientName} passes={packages} onClose={() => setNewInvoice(false)} />
      <PTInvoiceDetailDialog invoice={openInvoice} clientName={clientName} onClose={() => setOpenInvoice(null)} />
      <PTRefundDialog target={refundTarget} onClose={() => setRefundTarget(null)} />
      <PTSessionCheckoutDialog
        sessions={checkoutSessions.map((s) => ({ ...s, user_id: userId })) as any}
        clientName={clientName}
        onClose={() => setCheckoutSessions([])}
      />
      {cardDialog && activePass && (
        <ChangeFutureCardDialog
          userId={userId}
          passId={activePass.id}
          cards={cards}
          currentLabel={cardLabel(nextCard ? { brand: nextCard.payment_method_brand, last4: nextCard.payment_method_last4 } : cards.find((c) => c.isDefault))}
          remainingCount={installments.filter((i) => i.status === "scheduled").length}
          memberEmail={cardsData?.memberEmail}
          clientName={clientName}
          onClose={() => setCardDialog(false)}
        />
      )}
      {dateDialog && activePass && (
        <MoveDateDialog
          userId={userId}
          passId={activePass.id}
          installment={dateDialog}
          onClose={() => setDateDialog(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------- change the future card */

function ChangeFutureCardDialog({
  userId, passId, cards, currentLabel, remainingCount, memberEmail, clientName, onClose,
}: {
  userId: string; passId: string; cards: any[]; currentLabel: string;
  remainingCount: number; memberEmail?: string; clientName: string; onClose: () => void;
}) {
  const { setFutureCard } = usePTPlanManagement(userId);
  const [choice, setChoice] = useState<string>("");
  const [secret, setSecret] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const picked = cards.find((c) => c.id === choice);

  async function startAddCard() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create_admin_setup_intent", applicantEmail: memberEmail, applicantName: clientName },
      });
      if (error) throw error;
      if (!data?.clientSecret) throw new Error("Could not open the card form");
      setSecret(data.clientSecret);
      setCustomerId(data.customerId ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open the card form");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PTModal
      open
      onOpenChange={onClose}
      title="Change card for future payments"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={onClose}>Cancel</button>
        <button
          className={ptButtonClass("primary")}
          disabled={!picked || setFutureCard.isPending}
          onClick={() => setFutureCard.mutate(
            { passId, paymentMethodId: picked.id, brand: picked.brand, last4: picked.last4 },
            { onSuccess: onClose },
          )}
        >
          Confirm change
        </button>
      </>}
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-pt-line p-3 text-[13px]">
          <div><span className="text-pt-muted">Current card:</span> {currentLabel}</div>
          <div><span className="text-pt-muted">Future card:</span> {picked ? cardLabel(picked) : "— select below —"}</div>
          <div><span className="text-pt-muted">Applies to:</span> {remainingCount} remaining PT installment(s)</div>
        </div>
        <p className="text-[12px] text-pt-muted">
          Payments already collected keep the card that actually paid them.
        </p>
        <div className="space-y-1.5">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => setChoice(c.id)}
              className={`w-full text-left rounded-lg border px-3 py-2 text-[13px] ${choice === c.id ? "border-pt-gold bg-pt-beige/40" : "border-pt-line"}`}
            >
              {cardLabel(c)} · {String(c.expMonth ?? "").padStart(2, "0")}/{String(c.expYear ?? "").slice(-2)}
              {c.isDefault ? " · default" : ""}
            </button>
          ))}
        </div>
        {secret ? (
          <div className="rounded-lg border border-pt-line p-3">
            <StripeProvider clientSecret={secret}>
              <AdminAddCardForm
                stripeCustomerId={customerId || undefined}
                onCancel={() => setSecret(null)}
                onSuccess={() => { setSecret(null); toast.success("Card saved"); }}
              />
            </StripeProvider>
          </div>
        ) : (
          <button className={ptButtonClass("outline")} onClick={startAddCard} disabled={loading}>
            <Plus className="h-4 w-4 mr-1.5" />Add new card
          </button>
        )}
      </div>
    </PTModal>
  );
}

/* --------------------------------------------------- move a future payment */

function MoveDateDialog({
  userId, passId, installment, onClose,
}: {
  userId: string; passId: string; installment: PTPlanInstallmentRow; onClose: () => void;
}) {
  const { previewReschedule, applyReschedule } = usePTPlanManagement(userId);
  const [date, setDate] = useState(installment.due_date);
  const [mode, setMode] = useState<"one" | "future">("one");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ current: any[]; proposed: any[] } | null>(null);

  return (
    <PTModal
      open
      onOpenChange={onClose}
      title="Manage future payment schedule"
      footer={<>
        <button className={ptButtonClass("ghost")} onClick={onClose}>Cancel</button>
        {!preview ? (
          <button
            className={ptButtonClass("outline")}
            disabled={previewReschedule.isPending || !date || date <= todayIso()}
            onClick={() => previewReschedule.mutate(
              { passId, installmentNumber: installment.installment_number, newDate: date, mode },
              { onSuccess: (d) => setPreview({ current: d.current ?? [], proposed: d.proposed ?? [] }) },
            )}
          >
            Preview change
          </button>
        ) : (
          <button
            className={ptButtonClass("primary")}
            disabled={applyReschedule.isPending}
            onClick={() => applyReschedule.mutate(
              { passId, installmentNumber: installment.installment_number, newDate: date, mode, reason },
              { onSuccess: onClose },
            )}
          >
            Apply change
          </button>
        )}
      </>}
    >
      <div className="space-y-3">
        <div>
          <Label className="pt-eyebrow">New date for payment #{installment.installment_number + 1}</Label>
          <Input type="date" value={date} min={todayIso()} onChange={(e) => { setDate(e.target.value); setPreview(null); }} className="bg-white border-pt-line" />
        </div>
        <div className="space-y-1.5">
          {[
            { v: "one" as const, label: "Change this payment only" },
            { v: "future" as const, label: "Change this and all later payments" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => { setMode(o.v); setPreview(null); }}
              className={`w-full text-left rounded-lg border px-3 py-2 text-[13px] ${mode === o.v ? "border-pt-gold bg-pt-beige/40" : "border-pt-line"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div>
          <Label className="pt-eyebrow">Reason (kept in the audit trail)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="bg-white border-pt-line" />
        </div>

        {preview && (
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <div className="pt-eyebrow mb-1">Current</div>
              {preview.current.filter((r: any) => r.status === "scheduled").map((r: any) => (
                <div key={`c${r.installment_number}`}>{day(r.due_date)} · {formatCents(r.amount_cents)}</div>
              ))}
            </div>
            <div>
              <div className="pt-eyebrow mb-1">Proposed</div>
              {preview.proposed.filter((r: any) => r.status === "scheduled").map((r: any) => (
                <div key={`p${r.installment_number}`} className="text-pt-ink">{day(r.due_date)} · {formatCents(r.amount_cents)}</div>
              ))}
            </div>
          </div>
        )}
        <p className="text-[11px] text-pt-muted">
          Paid and processing payments cannot be moved. The card schedule is updated to match Storm.
        </p>
      </div>
    </PTModal>
  );
}
