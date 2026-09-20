import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import {
  PRICING_MODES,
  computeFinancials,
  fromCents,
  itemTotalCents,
  money,
  toCents,
  type FinancialItem,
  type ItemClassification,
  type PricingMode,
} from "@/lib/eventFinancials";
import { useFinancialMutations, useFinancialTemplates } from "@/hooks/useEventFinancials";

const GROUPS: { key: ItemClassification; title: string; hint: string }[] = [
  { key: "included", title: "Included in the package", hint: "Shown to the client with no price beside them." },
  { key: "priced", title: "Priced services", hint: "Billed on top of, or instead of, a package price." },
  { key: "optional", title: "Optional enhancements", hint: "Offered to the client; only charged when selected." },
  { key: "internal", title: "Internal costs", hint: "Never shown on a proposal, invoice or client portal." },
];

export function FinancialEstimateTab({ financial, items }: { financial: any; items: any[] }) {
  const { updateFinancial, saveItems } = useFinancialMutations(financial.id);
  const { data: templates = [] } = useFinancialTemplates();

  const [settings, setSettings] = useState<any>(financial);
  const [rows, setRows] = useState<FinancialItem[]>([]);

  useEffect(() => setSettings(financial), [financial.id, financial.updated_at]);
  useEffect(
    () =>
      setRows(
        items.map((i) => ({
          id: i.id,
          classification: i.classification,
          section: i.section,
          label: i.label,
          client_description: i.client_description,
          internal_note: i.internal_note,
          quantity: Number(i.quantity),
          unit_price_cents: i.unit_price_cents,
          taxable: i.taxable,
          show_quantity: i.show_quantity,
          show_price: i.show_price,
          selected: i.selected,
          client_selectable: i.client_selectable,
          sort_order: i.sort_order,
        })),
      ),
    [items],
  );

  const totals = useMemo(() => computeFinancials(settings, rows), [settings, rows]);

  const set = (patch: any) => setSettings((s: any) => ({ ...s, ...patch }));
  const setRow = (idx: number, patch: Partial<FinancialItem>) =>
    setRows((prev) => prev.map((r, n) => (n === idx ? { ...r, ...patch } : r)));
  const move = (idx: number, dir: -1 | 1) =>
    setRows((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const addRow = (classification: ItemClassification) =>
    setRows((prev) => [
      ...prev,
      {
        classification,
        label: "",
        quantity: 1,
        unit_price_cents: 0,
        taxable: classification === "priced",
        show_quantity: classification !== "included",
        show_price: classification !== "included",
        selected: false,
        client_selectable: classification === "optional",
        sort_order: prev.length,
        section: null,
        client_description: null,
        internal_note: null,
      },
    ]);

  const applyTemplate = (slug: string) => {
    const t: any = templates.find((x: any) => x.slug === slug);
    if (!t) return;
    const cfg = t.config ?? {};
    set({
      pricing_mode: cfg.pricing_mode ?? settings.pricing_mode,
      package_name: cfg.package_name ?? t.name,
      package_price_cents: cfg.package_price_cents ?? settings.package_price_cents,
      tax_enabled: cfg.tax_enabled ?? settings.tax_enabled,
    });
    const included: FinancialItem[] = (cfg.included ?? []).map((label: string, idx: number) => ({
      classification: "included" as const,
      label,
      quantity: 1,
      unit_price_cents: 0,
      taxable: false,
      show_quantity: false,
      show_price: false,
      selected: false,
      client_selectable: false,
      sort_order: idx,
      section: "Your Experience Includes",
      client_description: null,
      internal_note: null,
    }));
    const optional: FinancialItem[] = (cfg.optional ?? []).map((o: any, idx: number) => ({
      classification: "optional" as const,
      label: o.label,
      quantity: 1,
      unit_price_cents: o.unit_price_cents ?? 0,
      taxable: true,
      show_quantity: true,
      show_price: true,
      selected: false,
      client_selectable: true,
      sort_order: 100 + idx,
      section: "Enhancements",
      client_description: null,
      internal_note: null,
    }));
    setRows([...included, ...optional]);
  };

  const save = async () => {
    await saveItems.mutateAsync(rows);
    updateFinancial.mutate({
      pricing_mode: settings.pricing_mode,
      package_name: settings.package_name,
      package_price_cents: settings.package_price_cents,
      hourly_rate_cents: settings.hourly_rate_cents,
      hours: settings.hours,
      per_person_cents: settings.per_person_cents,
      headcount: settings.headcount,
      minimum_spend_cents: settings.minimum_spend_cents,
      discount_cents: settings.discount_cents,
      discount_label: settings.discount_label,
      credit_cents: settings.credit_cents,
      tax_enabled: settings.tax_enabled,
      pass_processing_fee: settings.pass_processing_fee,
      service_charge_pct: settings.service_charge_pct,
      service_charge_label: settings.service_charge_label,
      client_intro: settings.client_intro,
      event_kind: settings.event_kind,
    });
  };

  const mode: PricingMode = settings.pricing_mode;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="font-serif">How this event is priced</CardTitle>
          <div className="flex gap-2">
            <Select onValueChange={applyTemplate}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Start from a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t: any) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={save} disabled={saveItems.isPending}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Pricing structure</Label>
            <Select value={mode} onValueChange={(v) => set({ pricing_mode: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICING_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {PRICING_MODES.find((m) => m.value === mode)?.hint}
            </p>
          </div>

          {mode === "flat" && (
            <>
              <div>
                <Label>Package name</Label>
                <Input
                  value={settings.package_name ?? ""}
                  placeholder="Private Wellness Experience"
                  onChange={(e) => set({ package_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Package price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fromCents(settings.package_price_cents)}
                  onChange={(e) => set({ package_price_cents: toCents(e.target.value) })}
                />
              </div>
            </>
          )}

          {mode === "hourly" && (
            <>
              <div>
                <Label>Hourly rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fromCents(settings.hourly_rate_cents)}
                  onChange={(e) => set({ hourly_rate_cents: toCents(e.target.value) })}
                />
              </div>
              <div>
                <Label>Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={settings.hours ?? 0}
                  onChange={(e) => set({ hours: Number(e.target.value) })}
                />
              </div>
            </>
          )}

          {mode === "per_person" && (
            <>
              <div>
                <Label>Per person</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fromCents(settings.per_person_cents)}
                  onChange={(e) => set({ per_person_cents: toCents(e.target.value) })}
                />
              </div>
              <div>
                <Label>Guests</Label>
                <Input
                  type="number"
                  value={settings.headcount ?? 0}
                  onChange={(e) => set({ headcount: Number(e.target.value) })}
                />
              </div>
            </>
          )}

          {mode === "minimum_spend" && (
            <div>
              <Label>Minimum spend</Label>
              <Input
                type="number"
                step="0.01"
                value={fromCents(settings.minimum_spend_cents)}
                onChange={(e) => set({ minimum_spend_cents: toCents(e.target.value) })}
              />
            </div>
          )}

          <div>
            <Label>Discount</Label>
            <Input
              type="number"
              step="0.01"
              value={fromCents(settings.discount_cents)}
              onChange={(e) => set({ discount_cents: toCents(e.target.value) })}
            />
          </div>
          <div>
            <Label>Credit already held</Label>
            <Input
              type="number"
              step="0.01"
              value={fromCents(settings.credit_cents)}
              onChange={(e) => set({ credit_cents: toCents(e.target.value) })}
            />
          </div>
          <div>
            <Label>{settings.service_charge_label || "Service charge"} (%)</Label>
            <Input
              type="number"
              step="0.5"
              value={settings.service_charge_pct ?? 0}
              onChange={(e) => set({ service_charge_pct: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={settings.tax_enabled} onCheckedChange={(c) => set({ tax_enabled: !!c })} /> 6% MI tax
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.pass_processing_fee}
                onCheckedChange={(c) => set({ pass_processing_fee: !!c })}
              />
              Pass card fee
            </label>
          </div>
          <div className="md:col-span-2">
            <Label>Client introduction</Label>
            <Textarea
              rows={2}
              value={settings.client_intro ?? ""}
              placeholder="A short, warm note that opens the proposal."
              onChange={(e) => set({ client_intro: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {GROUPS.map((group) => {
        const groupRows = rows.map((r, idx) => ({ r, idx })).filter(({ r }) => r.classification === group.key);
        return (
          <Card key={group.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="font-serif">{group.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{group.hint}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => addRow(group.key)}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupRows.length === 0 && (
                <p className="py-3 text-center text-sm text-muted-foreground">Nothing here yet.</p>
              )}
              {groupRows.map(({ r, idx }) => (
                <div key={idx} className="rounded-md border p-3 space-y-2">
                  <div className="grid grid-cols-12 items-center gap-2">
                    <Input
                      className="col-span-12 md:col-span-5"
                      placeholder="Name"
                      value={r.label}
                      onChange={(e) => setRow(idx, { label: e.target.value })}
                    />
                    <Input
                      className="col-span-4 md:col-span-2"
                      type="number"
                      step="0.5"
                      value={r.quantity}
                      onChange={(e) => setRow(idx, { quantity: Number(e.target.value) })}
                    />
                    <Input
                      className="col-span-5 md:col-span-2"
                      type="number"
                      step="0.01"
                      value={fromCents(r.unit_price_cents)}
                      onChange={(e) => setRow(idx, { unit_price_cents: toCents(e.target.value) })}
                    />
                    <div className="col-span-3 md:col-span-1 text-right text-sm font-medium">
                      {group.key === "included" ? "—" : money(itemTotalCents(r))}
                    </div>
                    <div className="col-span-12 md:col-span-2 flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => move(idx, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => move(idx, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRows((prev) => prev.filter((_, n) => n !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {group.key !== "internal" ? (
                      <Input
                        placeholder="Client-facing description (optional)"
                        value={r.client_description ?? ""}
                        onChange={(e) => setRow(idx, { client_description: e.target.value })}
                      />
                    ) : (
                      <Input
                        placeholder="Vendor / cost note"
                        value={r.internal_note ?? ""}
                        onChange={(e) => setRow(idx, { internal_note: e.target.value })}
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      {group.key !== "internal" && (
                        <>
                          <label className="flex items-center gap-1">
                            <Checkbox
                              checked={r.show_quantity}
                              onCheckedChange={(c) => setRow(idx, { show_quantity: !!c })}
                            />
                            Show quantity
                          </label>
                          <label className="flex items-center gap-1">
                            <Checkbox checked={r.taxable} onCheckedChange={(c) => setRow(idx, { taxable: !!c })} />
                            Taxable
                          </label>
                        </>
                      )}
                      {group.key === "optional" && (
                        <>
                          <label className="flex items-center gap-1">
                            <Checkbox
                              checked={r.client_selectable}
                              onCheckedChange={(c) => setRow(idx, { client_selectable: !!c })}
                            />
                            Client may choose
                          </label>
                          <label className="flex items-center gap-1">
                            <Checkbox checked={r.selected} onCheckedChange={(c) => setRow(idx, { selected: !!c })} />
                            Added
                          </label>
                        </>
                      )}
                      {group.key === "internal" && (
                        <span className="text-muted-foreground">Never appears on client documents.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif">Client total</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Line label={mode === "flat" ? settings.package_name || "Package" : "Services"} value={totals.baseCents} />
          {totals.enhancementsCents > 0 && <Line label="Enhancements" value={totals.enhancementsCents} />}
          {totals.discountCents > 0 && (
            <Line label={settings.discount_label || "Discount"} value={-totals.discountCents} />
          )}
          {totals.serviceChargeCents > 0 && (
            <Line label={settings.service_charge_label || "Service charge"} value={totals.serviceChargeCents} />
          )}
          {totals.taxCents > 0 && <Line label="Michigan sales tax" value={totals.taxCents} />}
          {totals.processingFeeCents > 0 && <Line label="Card processing" value={totals.processingFeeCents} />}
          {totals.creditCents > 0 && <Line label="Credit applied" value={-totals.creditCents} />}
          <div className="flex justify-between border-t pt-2 font-serif text-lg text-primary">
            <span>Total</span>
            <span>{money(totals.totalCents)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}
