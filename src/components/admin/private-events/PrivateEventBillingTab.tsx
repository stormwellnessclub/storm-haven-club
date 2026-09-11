import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Link2, Mail, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { computeQuote, formatMoney } from "@/lib/privateEvents";
import type { PrivateEvent, PrivateEventInvoice, PrivateEventLineItem } from "@/hooks/usePrivateEvents";
import { usePrivateEventMutations } from "@/hooks/usePrivateEvents";

interface Props {
  event: PrivateEvent;
  invoices: PrivateEventInvoice[];
  lineItems: PrivateEventLineItem[];
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/15 text-primary",
  paid: "bg-emerald-500/15 text-emerald-600",
  void: "bg-destructive/15 text-destructive",
};

export function PrivateEventBillingTab({ event, invoices, lineItems }: Props) {
  const { createInvoice, sendInvoice, chargeSavedCard, markInvoicePaidManually, updateInvoice } =
    usePrivateEventMutations();

  const paidCents = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount_cents, 0);
  const totals = computeQuote({
    items: lineItems.map((i) => ({
      label: i.label,
      quantity: Number(i.quantity),
      unit_price_cents: i.unit_price_cents,
      taxable: i.taxable,
    })),
    flatTotalCents: event.flat_total_cents,
    taxEnabled: event.tax_enabled,
    passProcessingFee: event.pass_processing_fee,
    depositType: event.deposit_type,
    depositValue: Number(event.deposit_value),
    paidCents,
  });

  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState("deposit");
  const [dueDate, setDueDate] = useState("");

  const suggested = kind === "deposit" ? totals.depositCents : Math.max(0, totals.totalCents - paidCents);

  const addInvoice = () => {
    const cents = amount ? Math.round(Number(amount) * 100) : suggested;
    if (!cents || cents <= 0) {
      toast.error("Enter an amount first");
      return;
    }
    createInvoice.mutate({
      event_id: event.id,
      kind,
      amount_cents: cents,
      due_date: dueDate || (kind === "balance" ? event.balance_due_date : null),
    });
    setAmount("");
    setDueDate("");
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/private-events/pay/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Pay link copied");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Money at a glance</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Stat label="Quote total" value={formatMoney(totals.totalCents)} />
          <Stat label="Deposit" value={formatMoney(totals.depositCents)} />
          <Stat label="Paid" value={formatMoney(paidCents)} />
          <Stat label="Outstanding" value={formatMoney(Math.max(0, totals.totalCents - paidCents))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">New invoice</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="balance">Balance</SelectItem>
                <SelectItem value="other">Other charge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              placeholder={(suggested / 100).toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={addInvoice} disabled={createInvoice.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create invoice
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {invoices.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No invoices yet.</p>
          )}
          {invoices.map((inv) => (
            <div key={inv.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{inv.kind}</span>
                    <Badge className={STATUS_TONE[inv.status] ?? ""} variant="secondary">{inv.status}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatMoney(inv.amount_cents)}
                    {inv.due_date ? ` · due ${inv.due_date}` : ""}
                    {inv.paid_at ? ` · paid ${new Date(inv.paid_at).toLocaleDateString()}` : ""}
                    {inv.payment_method ? ` · ${inv.payment_method.replace(/_/g, " ")}` : ""}
                  </div>
                </div>

                {inv.status !== "paid" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!event.client_email || sendInvoice.isPending}
                      onClick={() => sendInvoice.mutate({ invoiceId: inv.id, eventId: event.id })}
                    >
                      <Mail className="mr-1 h-4 w-4" /> Email pay link
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copyLink(inv.pay_token)}>
                      <Link2 className="mr-1 h-4 w-4" /> Copy link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={chargeSavedCard.isPending}
                      onClick={() => chargeSavedCard.mutate({ invoiceId: inv.id, eventId: event.id })}
                    >
                      <CreditCard className="mr-1 h-4 w-4" /> Charge card on file
                    </Button>
                    <Select
                      onValueChange={(method) =>
                        markInvoicePaidManually.mutate({
                          id: inv.id,
                          event_id: event.id,
                          method,
                          amount_cents: inv.amount_cents,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Record payment" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="terminal">Card at desk</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateInvoice.mutate({ id: inv.id, event_id: event.id, status: "void" })}
                    >
                      Void
                    </Button>
                  </div>
                )}
                {inv.status === "paid" && (
                  <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600">
                    <Check className="mr-1 h-3 w-3" /> Paid
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
