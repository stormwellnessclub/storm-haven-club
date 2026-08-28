import { useState } from "react";
import { format as fmtDate } from "date-fns";
import { Send, Ban, CreditCard, Receipt } from "lucide-react";
import {
  PTModal, PTBadge, PTAlert, PTConfirmDialog, ptButtonClass,
} from "@/components/admin/pt/PTUI";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/lib/ptFormat";
import { usePTSavedCards } from "@/hooks/pt/usePTFinancials";
import {
  PTInvoiceRow, usePTInvoiceLines, usePTInvoiceMutations,
  PT_INVOICE_STATUS_LABEL, ptInvoiceTone,
} from "@/hooks/pt/usePTBillingCenter";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "terminal", label: "External terminal" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

/** Full invoice view with send, charge, record-payment, void and receipt actions. */
export function PTInvoiceDetailDialog({
  invoice, clientName, onClose,
}: {
  invoice: PTInvoiceRow | null;
  clientName: string;
  onClose: () => void;
}) {
  const { data: lines = [] } = usePTInvoiceLines(invoice ? [invoice.id] : []);
  const { data: cards = [] } = usePTSavedCards(invoice?.user_id, !!invoice);
  const { sendInvoice, voidInvoice, recordInvoicePayment, chargeInvoiceCard } = usePTInvoiceMutations();

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [cardId, setCardId] = useState<string>("");

  if (!invoice) return null;

  const due = invoice.amount_due_cents;
  const open = !["paid", "void"].includes(invoice.status);
  const defaultCard = cards.find((c) => c.isDefault) ?? cards[0];

  async function recordManual() {
    if (!invoice) return;
    const cents = Math.round(parseFloat(payAmount || "0") * 100);
    if (cents <= 0) return;
    await recordInvoicePayment.mutateAsync({
      invoiceId: invoice.id,
      method: payMethod,
      amountCents: cents,
      reference: payRef || null,
      idempotencyKey: `pt_inv_manual:${invoice.id}:${cents}:${payRef || "none"}`,
    });
    setPayAmount(""); setPayRef("");
  }

  return (
    <>
      <PTModal
        open={!!invoice}
        onOpenChange={(v) => !v && onClose()}
        title={`Invoice ${invoice.invoice_number}`}
        description={clientName}
        size="lg"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <PTBadge tone={ptInvoiceTone(invoice.status) as any}>
              {PT_INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
            </PTBadge>
            <span className="text-[13px] text-pt-muted">
              Issued {fmtDate(new Date(`${invoice.issue_date}T12:00:00`), "MMM d, yyyy")}
              {invoice.due_date && ` · Due ${fmtDate(new Date(`${invoice.due_date}T12:00:00`), "MMM d, yyyy")}`}
            </span>
          </div>

          {invoice.status === "void" && (
            <PTAlert tone="warning" title="Voided">
              {invoice.void_reason} — no further collection will be attempted.
            </PTAlert>
          )}

          {/* line items */}
          <div className="rounded-lg border border-pt-line overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-pt-beige/40 text-pt-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Unit</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-right px-3 py-2 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pt-line">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="px-3 py-2 text-right">{l.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatCents(l.unit_amount_cents)}</td>
                    <td className="px-3 py-2 text-right">{formatCents(l.amount_cents)}</td>
                    <td className="px-3 py-2 text-right">
                      {l.amount_paid_cents >= l.amount_cents
                        ? <PTBadge tone="green">Settled</PTBadge>
                        : formatCents(l.amount_paid_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-pt-line bg-white px-4 py-3 space-y-1 text-[13px]">
            <Row label="Subtotal" value={formatCents(invoice.subtotal_cents)} />
            {invoice.discount_cents > 0 && <Row label="Discount" value={`-${formatCents(invoice.discount_cents)}`} />}
            {invoice.tax_cents > 0 && <Row label="Tax" value={formatCents(invoice.tax_cents)} />}
            <Row label="Total" value={formatCents(invoice.total_cents)} bold />
            <Row label="Amount paid" value={formatCents(invoice.amount_paid_cents)} />
            <Row label="Amount due" value={formatCents(due)} bold tone={due > 0 ? "text-pt-red" : "text-pt-green"} />
          </div>

          {invoice.notes && <p className="text-[13px] text-pt-muted">{invoice.notes}</p>}

          {open && (
            <>
              <div className="flex flex-wrap gap-2">
                <button className={ptButtonClass("outline")} onClick={() => void sendInvoice.mutateAsync({ invoiceId: invoice.id })}>
                  <Send className="h-4 w-4 mr-1.5" /> {invoice.sent_at ? "Resend" : "Send"}
                </button>
                {defaultCard && due > 0 && (
                  <button
                    className={ptButtonClass("gold")}
                    onClick={() => { setCardId(defaultCard.id); setChargeOpen(true); }}
                  >
                    <CreditCard className="h-4 w-4 mr-1.5" /> Charge card on file
                  </button>
                )}
                {invoice.amount_paid_cents === 0 && (
                  <button className={ptButtonClass("danger")} onClick={() => setVoidOpen(true)}>
                    <Ban className="h-4 w-4 mr-1.5" /> Void
                  </button>
                )}
              </div>

              {/* manual payment */}
              <div className="rounded-lg border border-pt-line p-3">
                <div className="text-[13px] font-medium mb-2">Record a manual payment</div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-32">
                    <Label className="text-[11px] text-pt-muted">Amount $</Label>
                    <Input
                      type="number" min={0} step="0.01" value={payAmount}
                      placeholder={(due / 100).toFixed(2)}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="h-9 border-pt-line bg-white"
                    />
                  </div>
                  <div className="w-44">
                    <Label className="text-[11px] text-pt-muted">Method</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger className="h-9 border-pt-line bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label className="text-[11px] text-pt-muted">Reference</Label>
                    <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-9 border-pt-line bg-white" />
                  </div>
                  <button
                    className={ptButtonClass("primary")}
                    disabled={recordInvoicePayment.isPending}
                    onClick={() => void recordManual()}
                  >
                    Record payment
                  </button>
                </div>
                <p className="text-[11px] text-pt-muted mt-2">
                  Partial amounts are allowed — the invoice moves to Partially Paid and each line settles in order.
                </p>
              </div>
            </>
          )}

          {invoice.status === "paid" && (
            <PTAlert tone="success" title="Paid in full">
              <span className="inline-flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" /> Receipt available from payment history.
              </span>
            </PTAlert>
          )}
        </div>
      </PTModal>

      <PTConfirmDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Void this invoice?"
        description="Voided invoices stay on record but are never collected again. This cannot be undone."
        confirmLabel="Void invoice"
        destructive
        onConfirm={async () => {
          if (!voidReason.trim()) return;
          await voidInvoice.mutateAsync({ invoiceId: invoice.id, reason: voidReason });
          setVoidOpen(false); setVoidReason(""); onClose();
        }}
      >
        <Input
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
          placeholder="Reason (required)"
          className="border-pt-line bg-white"
        />
      </PTConfirmDialog>

      <PTConfirmDialog
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        title={`Charge ${formatCents(due)} to the card on file?`}
        description={`${clientName} · ${defaultCard?.brand ?? "Card"} ···· ${defaultCard?.last4 ?? "----"} · Invoice ${invoice.invoice_number}`}
        confirmLabel="Charge now"
        onConfirm={async () => {
          await chargeInvoiceCard.mutateAsync({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            userId: invoice.user_id,
            amountCents: due,
            paymentMethodId: cardId,
          });
          setChargeOpen(false);
        }}
      />
    </>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-pt-muted">{label}</span>
      <span className={`${bold ? "font-medium" : ""} ${tone ?? ""}`}>{value}</span>
    </div>
  );
}
