import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";
import { fromCents, money, toCents } from "@/lib/eventFinancials";
import { useFinancialMutations } from "@/hooks/useEventFinancials";

const CATEGORIES = [
  "revenue",
  "vendor",
  "facilitator",
  "food_beverage",
  "staffing",
  "decor",
  "rentals",
  "supplies",
  "marketing",
  "processing",
  "tax",
  "misc",
];

export function FinancialBudgetTab({
  financial,
  budget,
  contractedCents,
  paidCents,
}: {
  financial: any;
  budget: any[];
  contractedCents: number;
  paidCents: number;
}) {
  const { saveBudget } = useFinancialMutations(financial.id);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => setRows(budget.map((b) => ({ ...b }))), [budget]);

  const totals = useMemo(() => {
    const est = rows
      .filter((r) => r.category !== "revenue")
      .reduce((s, r) => s + (r.estimated_cents || 0), 0);
    const act = rows
      .filter((r) => r.category !== "revenue")
      .reduce((s, r) => s + (r.actual_cents ?? r.estimated_cents ?? 0), 0);
    const extraRevenue = rows.filter((r) => r.category === "revenue").reduce((s, r) => s + (r.actual_cents ?? r.estimated_cents ?? 0), 0);
    const revenue = contractedCents + extraRevenue;
    return {
      estimatedCost: est,
      actualCost: act,
      revenue,
      estimatedProfit: revenue - est,
      actualProfit: paidCents + extraRevenue - act,
      margin: revenue > 0 ? Math.round(((revenue - act) / revenue) * 100) : 0,
    };
  }, [rows, contractedCents, paidCents]);

  const setRow = (idx: number, patch: any) => setRows((prev) => prev.map((r, n) => (n === idx ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Contracted revenue" value={money(totals.revenue)} />
        <Stat label="Estimated cost" value={money(totals.estimatedCost)} />
        <Stat label="Estimated profit" value={money(totals.estimatedProfit)} />
        <Stat label="Margin" value={`${totals.margin}%`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="font-serif">Internal budget</CardTitle>
            <p className="text-xs text-muted-foreground">Never shown to the client.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setRows((p) => [...p, { category: "vendor", label: "", vendor: "", estimated_cents: 0, actual_cents: null }])
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Line
            </Button>
            <Button size="sm" onClick={() => saveBudget.mutate(rows)} disabled={saveBudget.isPending}>
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No budget lines yet.</p>}
          {rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-12 items-center gap-2">
              <Select value={r.category} onValueChange={(v) => setRow(idx, { category: v })}>
                <SelectTrigger className="col-span-6 md:col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="col-span-6 md:col-span-3"
                placeholder="Description"
                value={r.label ?? ""}
                onChange={(e) => setRow(idx, { label: e.target.value })}
              />
              <Input
                className="col-span-6 md:col-span-3"
                placeholder="Vendor"
                value={r.vendor ?? ""}
                onChange={(e) => setRow(idx, { vendor: e.target.value })}
              />
              <Input
                className="col-span-3 md:col-span-1.5"
                type="number"
                step="0.01"
                placeholder="Est."
                value={fromCents(r.estimated_cents)}
                onChange={(e) => setRow(idx, { estimated_cents: toCents(e.target.value) })}
              />
              <Input
                className="col-span-3 md:col-span-2"
                type="number"
                step="0.01"
                placeholder="Actual"
                value={r.actual_cents == null ? "" : fromCents(r.actual_cents)}
                onChange={(e) =>
                  setRow(idx, { actual_cents: e.target.value === "" ? null : toCents(e.target.value) })
                }
              />
              <Button
                className="col-span-12 md:col-span-1"
                variant="ghost"
                size="icon"
                onClick={() => setRows((prev) => prev.filter((_, n) => n !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif">Profitability</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <Stat label="Collected to date" value={money(paidCents)} />
          <Stat label="Actual cost" value={money(totals.actualCost)} />
          <Stat label="Actual profit" value={money(totals.actualProfit)} />
        </CardContent>
      </Card>
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
