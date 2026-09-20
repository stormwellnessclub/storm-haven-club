import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, Link2, Plus, Send, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  buildSchedule,
  formatDay,
  fromCents,
  money,
  toCents,
  type InvoiceStatus,
} from "@/lib/eventFinancials";
import { useFinancialMutations } from "@/hooks/useEventFinancials";
import { SendFinancialDialog } from "./SendFinancialDialog";

export function FinancialInvoicesTab({
  financial,
  invoices,
  totalCents,
  eventDate,
}: {
  financial: any;
  invoices: any[];
  totalCents: number;
  eventDate?: string | null;
}) {
  const { saveInvoice, deleteInvoice, recordPayment } = useFinancialMutations(financial.id);
  const [payFor, setPayFor] = useState<any | null>(null);
  const [sendFor, setSendFor] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("card_manual");
  const [payDirection, setPayDirection] = useState<"payment" | "refund">("payment");
  const [payReference, setPayReference] = useState("");

  const invoicedCents = useMemo(
    () => invoices.filter((i) => i.status !== "void").reduce((s, i) => s + i.amount_cents, 0),
    [invoices],
  );
  const paidCents = useMemo(() => invoices.reduce((s, i) => s + i.amount_paid_cents, 0), [invoices]);
  const refundedCents = useMemo(() => invoices.reduce((s, i) => s + i.amount_refunded_cents, 0), [invoices]);
  const next = invoices
    .filter((i) => !["paid", "void", "refunded"].includes(i.status) && i.due_date)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];

  const generate = async (rules: any[]) => {
    const plan = buildSchedule(totalCents, rules, eventDate);
    for (const [idx, p] of plan.entries()) {
      await saveInvoice.mutateAsync({
        invoice_type: p.invoice_type === "full" ? "full" : p.invoice_type,
        label: p.label,
        amount_cents: p.amount_cents,
        due_date: p.due_date,
        issue_date: new Date().toISOString().slice(0, 10),
        sort_order: invoices.length + idx,
        status: "draft",
      });
    }
    toast.success("Payment schedule created");
  };

  const copyLink = (inv: any) => {
    navigator.clipboard.writeText(`${window.location.origin}/event-portal/${financial.portal_token}`);
    toast.success("Secure client link copied");
  };

  const submitPayment = async () => {
    if (!payFor) return;
    await recordPayment.mutateAsync({
      invoice_id: payFor.id,
      amount_cents: toCents(payAmount),
      direction: payDirection,
      method: payMethod,
      reference: payReference || undefined,
    });
    setPayFor(null);
    setPayAmount("");
    setPayReference("");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Contracted" value={money(totalCents)} />
        <Stat label="Invoiced" value={money(invoicedCents)} />
        <Stat label="Paid" value={money(paidCents)} />
        <Stat label="Refunded" value={money(refundedCents)} />
        <Stat label="Outstanding" value={money(Math.max(0, invoicedCents - paidCents + refundedCents))} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="font-serif">Payment schedule</CardTitle>
            <p className="text-xs text-muted-foreground">
              {next ? `Next due ${formatDay(next.due_date)} · ${money(next.amount_cents - next.amount_paid_cents)}` : "Nothing scheduled."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              onValueChange={(v) => {
                if (v === "50-50") generate([{ type: "deposit", percent: 50 }, { type: "balance", percent: 50, days_before: 7 }]);
                if (v === "25-75") generate([{ type: "deposit", percent: 25 }, { type: "balance", percent: 75, days_before: 7 }]);
                if (v === "thirds")
                  generate([
                    { type: "deposit", percent: 34 },
                    { type: "installment", percent: 33, days_before: 30 },
                    { type: "balance", percent: 33, days_before: 7 },
                  ]);
                if (v === "full") generate([{ type: "full", percent: 100 }]);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Generate schedule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50-50">50% deposit + balance</SelectItem>
                <SelectItem value="25-75">25% deposit + balance</SelectItem>
                <SelectItem value="thirds">Three installments</SelectItem>
                <SelectItem value="full">Pay in full</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                saveInvoice.mutate({
                  invoice_type: "installment",
                  label: "Installment",
                  amount_cents: 0,
                  status: "draft",
                  issue_date: new Date().toISOString().slice(0, 10),
                  sort_order: invoices.length,
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {invoices.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No invoices yet.</p>
          )}
          {invoices.map((inv) => (
            <div key={inv.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{inv.invoice_number}</span>
                  <Badge className={INVOICE_STATUS_TONE[inv.status as InvoiceStatus]} variant="secondary">
                    {INVOICE_STATUS_LABEL[inv.status as InvoiceStatus]}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setSendFor(inv)}>
                    <Send className="mr-1 h-4 w-4" /> Send
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyLink(inv)}>
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPayFor(inv);
                      setPayAmount(fromCents(Math.max(0, inv.amount_cents - inv.amount_paid_cents)));
                      setPayDirection("payment");
                    }}
                  >
                    <Wallet className="mr-1 h-4 w-4" /> Record
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteInvoice.mutate(inv.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-5">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={inv.invoice_type}
                    onValueChange={(v) => saveInvoice.mutate({ id: inv.id, invoice_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["deposit", "installment", "milestone", "balance", "full", "custom"].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Label</Label>
                  <Input
                    defaultValue={inv.label ?? ""}
                    onBlur={(e) => saveInvoice.mutate({ id: inv.id, label: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={fromCents(inv.amount_cents)}
                    onBlur={(e) => saveInvoice.mutate({ id: inv.id, amount_cents: toCents(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Due</Label>
                  <Input
                    type="date"
                    defaultValue={inv.due_date ?? ""}
                    onBlur={(e) => saveInvoice.mutate({ id: inv.id, due_date: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={inv.status} onValueChange={(v) => saveInvoice.mutate({ id: inv.id, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["draft", "scheduled", "ready", "sent", "viewed", "void"] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {INVOICE_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Paid {money(inv.amount_paid_cents)}</span>
                <span>Balance {money(Math.max(0, inv.amount_cents - inv.amount_paid_cents))}</span>
                {inv.sent_at && <span>Sent {formatDay(String(inv.sent_at).slice(0, 10))}</span>}
                {inv.viewed_at && <span>Viewed {formatDay(String(inv.viewed_at).slice(0, 10))}</span>}
                {inv.paid_at && <span>Paid {formatDay(String(inv.paid_at).slice(0, 10))}</span>}
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={inv.reminders_paused}
                    onChange={(e) => saveInvoice.mutate({ id: inv.id, reminders_paused: e.target.checked })}
                  />
                  Pause reminders
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Direction</Label>
              <Select value={payDirection} onValueChange={(v: any) => setPayDirection(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment">Payment received</SelectItem>
                  <SelectItem value="refund">Refund issued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["card_manual", "card_online", "cash", "check", "bank_transfer", "credit"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Check no., note" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitPayment} disabled={recordPayment.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendFinancialDialog
        financial={financial}
        invoice={sendFor}
        open={!!sendFor}
        onOpenChange={(o) => !o && setSendFor(null)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-serif text-xl text-primary">{value}</div>
    </div>
  );
}
