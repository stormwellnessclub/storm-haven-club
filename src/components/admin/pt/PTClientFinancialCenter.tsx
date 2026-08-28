import { useMemo, useState } from "react";
import { format as fmtDate } from "date-fns";
import { FileText, Plus, Undo2, Wallet } from "lucide-react";
import {
  PTCard, PTSectionTitle, PTTable, PTBadge, PTEmptyState, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { formatCents } from "@/lib/ptFormat";
import {
  usePTInvoices, usePTRefunds, usePTOutstanding,
  PTInvoiceRow, PT_INVOICE_STATUS_LABEL, ptInvoiceTone,
} from "@/hooks/pt/usePTBillingCenter";
import { usePTPayments, PT_PAYMENT_METHOD_LABEL } from "@/hooks/pt/usePTFinancials";
import { PTInvoiceDialog } from "@/components/admin/pt/PTInvoiceDialog";
import { PTInvoiceDetailDialog } from "@/components/admin/pt/PTInvoiceDetailDialog";
import { PTRefundDialog, PTRefundTarget } from "@/components/admin/pt/PTRefundDialog";

const dt = (v?: string | null) => (v ? fmtDate(new Date(v), "MMM d, yyyy h:mm a") : "—");

/**
 * One client's full PT money picture: a non-double-counted outstanding
 * balance, invoices, payments, and refunds — all read from the same ledger
 * the Billing workspace uses.
 */
export function PTClientFinancialCenter({
  userId, clientName, passes = [],
}: {
  userId?: string;
  clientName: string;
  passes?: any[];
}) {
  const { data: outstanding } = usePTOutstanding(userId);
  const { data: invoices = [] } = usePTInvoices(userId);
  const { data: refunds = [] } = usePTRefunds(userId);
  const { data: allPayments = [] } = usePTPayments();

  const [newInvoice, setNewInvoice] = useState(false);
  const [openInvoice, setOpenInvoice] = useState<PTInvoiceRow | null>(null);
  const [refundTarget, setRefundTarget] = useState<PTRefundTarget | null>(null);

  const payments = useMemo(
    () => allPayments.filter((p) => p.user_id === userId),
    [allPayments, userId],
  );

  if (!userId) return null;

  const breakdown = [
    { label: "Open invoices", value: outstanding?.open_invoices_cents ?? 0 },
    { label: "Uninvoiced sessions", value: outstanding?.uninvoiced_sessions_cents ?? 0 },
    { label: "Package balance", value: outstanding?.package_balance_cents ?? 0 },
    { label: "Plan remaining", value: outstanding?.plan_remaining_cents ?? 0 },
  ];

  return (
    <>
      <PTCard>
        <PTSectionTitle
          action={
            <button className={ptButtonClass("outline")} onClick={() => setNewInvoice(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New invoice
            </button>
          }
        >
          Outstanding balance
        </PTSectionTitle>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {breakdown.map((b) => (
            <div key={b.label} className="rounded-lg border border-pt-line p-3">
              <div className="text-[11px] uppercase tracking-wide text-pt-muted">{b.label}</div>
              <div className="text-[15px] font-medium mt-1">{formatCents(b.value)}</div>
            </div>
          ))}
          <div className="rounded-lg border border-pt-line bg-pt-beige/40 p-3">
            <div className="text-[11px] uppercase tracking-wide text-pt-muted">Total owed</div>
            <div className={`text-[15px] font-medium mt-1 ${(outstanding?.total_outstanding_cents ?? 0) > 0 ? "text-pt-red" : "text-pt-green"}`}>
              {formatCents(outstanding?.total_outstanding_cents ?? 0)}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-pt-muted mt-2">
          Each dollar is counted once: an invoiced session is not also counted as an uninvoiced session,
          and a financed package is not counted twice against its plan.
        </p>
      </PTCard>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <PTCard padded={false}>
          <div className="p-4 pb-0"><PTSectionTitle>Invoices</PTSectionTitle></div>
          <PTTable
            rows={invoices}
            getRowKey={(i: any) => i.id}
            onRowClick={(i: any) => setOpenInvoice(i)}
            empty={<PTEmptyState icon={FileText} title="No invoices" />}
            columns={[
              { key: "n", header: "Invoice", render: (i: any) => i.invoice_number },
              { key: "d", header: "Issued", render: (i: any) => fmtDate(new Date(`${i.issue_date}T12:00:00`), "MMM d, yyyy") },
              { key: "t", header: "Total", align: "right", render: (i: any) => formatCents(i.total_cents) },
              { key: "b", header: "Balance", align: "right", render: (i: any) => formatCents(i.amount_due_cents) },
              {
                key: "s", header: "Status",
                render: (i: any) => <PTBadge tone={ptInvoiceTone(i.status) as any}>{PT_INVOICE_STATUS_LABEL[i.status] ?? i.status}</PTBadge>,
              },
            ]}
          />
        </PTCard>

        <PTCard padded={false}>
          <div className="p-4 pb-0"><PTSectionTitle>Payments</PTSectionTitle></div>
          <PTTable
            rows={payments}
            getRowKey={(p: any) => p.id}
            empty={<PTEmptyState icon={Wallet} title="No payments recorded" />}
            columns={[
              { key: "d", header: "Paid", render: (p: any) => dt(p.paid_at) },
              { key: "a", header: "Amount", align: "right", render: (p: any) => formatCents(p.amount_cents) },
              {
                key: "m", header: "Method",
                render: (p: any) => <PTBadge tone={p.method === "card" ? "gold" : "neutral"}>{PT_PAYMENT_METHOD_LABEL[p.method] ?? p.method}</PTBadge>,
              },
              { key: "r", header: "Reference", render: (p: any) => p.reference || p.stripe_payment_intent_id || "—" },
              {
                key: "act", header: "", align: "right",
                render: (p: any) => {
                  const refunded = p.refunded_cents ?? 0;
                  if (p.status !== "succeeded" || refunded >= p.amount_cents) {
                    return refunded > 0 ? <PTBadge tone="neutral">Refunded</PTBadge> : null;
                  }
                  return (
                    <button
                      className={ptButtonClass("ghost")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRefundTarget({
                          paymentId: p.id, userId: p.user_id, clientName,
                          amountCents: p.amount_cents, refundedCents: refunded,
                          stripePaymentIntentId: p.stripe_payment_intent_id ?? null,
                        });
                      }}
                    >
                      Refund
                    </button>
                  );
                },
              },
            ]}
          />
        </PTCard>
      </div>

      {refunds.length > 0 && (
        <PTCard padded={false} className="mt-4">
          <div className="p-4 pb-0"><PTSectionTitle>Refunds</PTSectionTitle></div>
          <PTTable
            rows={refunds}
            getRowKey={(r: any) => r.id}
            empty={<PTEmptyState icon={Undo2} title="No refunds" />}
            columns={[
              { key: "d", header: "When", render: (r: any) => dt(r.refunded_at) },
              { key: "a", header: "Amount", align: "right", render: (r: any) => formatCents(r.amount_cents) },
              { key: "m", header: "Method", render: (r: any) => (r.method === "stripe" ? "Stripe" : "Manual") },
              { key: "why", header: "Reason", render: (r: any) => r.reason },
            ]}
          />
        </PTCard>
      )}

      <PTInvoiceDialog
        open={newInvoice}
        userId={userId}
        clientName={clientName}
        passes={passes}
        onClose={() => setNewInvoice(false)}
      />
      <PTInvoiceDetailDialog invoice={openInvoice} clientName={clientName} onClose={() => setOpenInvoice(null)} />
      <PTRefundDialog target={refundTarget} onClose={() => setRefundTarget(null)} />
    </>
  );
}
