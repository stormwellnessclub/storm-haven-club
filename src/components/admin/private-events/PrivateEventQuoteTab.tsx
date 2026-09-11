import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Send, Trash2, Save } from "lucide-react";
import { computeQuote, formatMoney, lineTotalCents, type QuoteLineItem } from "@/lib/privateEvents";
import type { PrivateEvent, PrivateEventLineItem } from "@/hooks/usePrivateEvents";
import { usePrivateEventMutations } from "@/hooks/usePrivateEvents";

interface Props {
  event: PrivateEvent;
  lineItems: PrivateEventLineItem[];
  paidCents: number;
}

const PRESETS = [
  { label: "Room fee", unit_price_cents: 50000, quantity: 1, taxable: false },
  { label: "Food & beverage (per guest)", unit_price_cents: 2500, quantity: 10, taxable: true },
  { label: "Staffing (per hour)", unit_price_cents: 3500, quantity: 3, taxable: false },
  { label: "Spa add-on", unit_price_cents: 9000, quantity: 1, taxable: false },
];

export function PrivateEventQuoteTab({ event, lineItems, paidCents }: Props) {
  const { saveLineItems, updateEvent, sendQuote } = usePrivateEventMutations();

  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [flatTotal, setFlatTotal] = useState<string>("");
  const [taxEnabled, setTaxEnabled] = useState(event.tax_enabled);
  const [passFee, setPassFee] = useState(event.pass_processing_fee);
  const [depositType, setDepositType] = useState(event.deposit_type);
  const [depositValue, setDepositValue] = useState(String(event.deposit_value ?? 25));
  const [balanceDue, setBalanceDue] = useState(event.balance_due_date ?? "");

  useEffect(() => {
    setItems(
      lineItems.map((i) => ({
        id: i.id,
        label: i.label,
        quantity: Number(i.quantity),
        unit_price_cents: i.unit_price_cents,
        taxable: i.taxable,
      })),
    );
  }, [lineItems]);

  useEffect(() => {
    setFlatTotal(event.flat_total_cents ? (event.flat_total_cents / 100).toFixed(2) : "");
    setTaxEnabled(event.tax_enabled);
    setPassFee(event.pass_processing_fee);
    setDepositType(event.deposit_type);
    setDepositValue(String(event.deposit_value ?? 25));
    setBalanceDue(event.balance_due_date ?? "");
  }, [event.id, event.updated_at]);

  const flatCents = flatTotal ? Math.round(Number(flatTotal) * 100) : null;

  const totals = useMemo(
    () =>
      computeQuote({
        items,
        flatTotalCents: flatCents,
        taxEnabled,
        passProcessingFee: passFee,
        depositType,
        depositValue: Number(depositValue) || 0,
        paidCents,
      }),
    [items, flatCents, taxEnabled, passFee, depositType, depositValue, paidCents],
  );

  const updateItem = (idx: number, patch: Partial<QuoteLineItem>) =>
    setItems((prev) => prev.map((i, n) => (n === idx ? { ...i, ...patch } : i)));

  const save = async () => {
    await saveLineItems.mutateAsync({ eventId: event.id, items });
    updateEvent.mutate({
      id: event.id,
      flat_total_cents: flatCents,
      tax_enabled: taxEnabled,
      pass_processing_fee: passFee,
      deposit_type: depositType,
      deposit_value: Number(depositValue) || 0,
      balance_due_date: balanceDue || null,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Line items</CardTitle>
          <div className="flex gap-2">
            <Select onValueChange={(v) => {
              const p = PRESETS.find((x) => x.label === v);
              if (p) setItems((prev) => [...prev, { ...p }]);
            }}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Add common item" /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems((p) => [...p, { label: "", quantity: 1, unit_price_cents: 0, taxable: true }])}
            >
              <Plus className="mr-1 h-4 w-4" /> Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No line items yet — add items, or just enter a flat price below.
            </p>
          )}
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 items-center gap-2">
              <Input
                className="col-span-5"
                placeholder="Description"
                value={item.label}
                onChange={(e) => updateItem(idx, { label: e.target.value })}
              />
              <Input
                className="col-span-2"
                type="number"
                min={0}
                step="0.5"
                value={item.quantity}
                onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
              />
              <Input
                className="col-span-2"
                type="number"
                min={0}
                step="0.01"
                value={(item.unit_price_cents / 100).toFixed(2)}
                onChange={(e) => updateItem(idx, { unit_price_cents: Math.round(Number(e.target.value) * 100) })}
              />
              <label className="col-span-1 flex items-center gap-1 text-xs">
                <Checkbox checked={item.taxable} onCheckedChange={(c) => updateItem(idx, { taxable: !!c })} />
                Tax
              </label>
              <div className="col-span-1 text-right text-sm font-medium">{formatMoney(lineTotalCents(item))}</div>
              <Button
                className="col-span-1"
                variant="ghost"
                size="icon"
                onClick={() => setItems((prev) => prev.filter((_, n) => n !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Pricing options</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Flat price override (optional)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Leave blank to use line items"
                value={flatTotal}
                onChange={(e) => setFlatTotal(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={taxEnabled} onCheckedChange={(c) => setTaxEnabled(!!c)} /> Apply 6% Michigan sales tax
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={passFee} onCheckedChange={(c) => setPassFee(!!c)} /> Pass card processing fee to client
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Deposit</Label>
                <Select value={depositType} onValueChange={setDepositType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent of total</SelectItem>
                    <SelectItem value="amount">Fixed dollar amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{depositType === "percent" ? "Percent" : "Amount ($)"}</Label>
                <Input type="number" step="0.01" value={depositValue} onChange={(e) => setDepositValue(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Balance due date</Label>
              <Input type="date" value={balanceDue} onChange={(e) => setBalanceDue(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Quote summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatMoney(totals.subtotalCents)} />
            {taxEnabled && <Row label="Sales tax (6%)" value={formatMoney(totals.taxCents)} />}
            {passFee && <Row label="Processing fee" value={formatMoney(totals.processingFeeCents)} />}
            <div className="border-t pt-2">
              <Row label="Total" value={formatMoney(totals.totalCents)} bold />
            </div>
            <Row label="Deposit" value={formatMoney(totals.depositCents)} />
            {paidCents > 0 && <Row label="Paid to date" value={`− ${formatMoney(paidCents)}`} />}
            <Row label="Balance after deposit" value={formatMoney(totals.balanceCents)} />

            <div className="flex flex-col gap-2 pt-3">
              <Button onClick={save} disabled={saveLineItems.isPending}>
                <Save className="mr-2 h-4 w-4" /> Save quote
              </Button>
              <Button
                variant="outline"
                disabled={!event.client_email || sendQuote.isPending}
                onClick={() =>
                  sendQuote.mutate({
                    eventId: event.id,
                    totalCents: totals.totalCents,
                    depositCents: totals.depositCents,
                  })
                }
              >
                <Send className="mr-2 h-4 w-4" /> Email proposal to client
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
