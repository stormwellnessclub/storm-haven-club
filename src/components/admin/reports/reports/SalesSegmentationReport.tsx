import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { LedgerStatusBar } from "../LedgerStatusBar";
import { RevenueTotalsCards } from "../RevenueTotalsCards";
import {
  AREA_ORDER, areaColor, areaLabel, groupRows, isEarnedArea, money, moneyRound, sumRows, tenderLabel, useRevenueSummary,
} from "@/lib/revenueLedger";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function SalesSegmentationReport({ dateRange }: Props) {
  const { data: rows, isLoading, error } = useRevenueSummary(dateRange);

  const view = useMemo(() => {
    const all = rows ?? [];
    const earned = all.filter((r) => isEarnedArea(r.area));
    const byArea = groupRows(earned, (r) => r.area);
    const categories = AREA_ORDER.filter((a) => byArea.has(a))
      .map((a) => ({ area: a, name: areaLabel(a), value: byArea.get(a)!.net, entries: byArea.get(a)!.entries }))
      .filter((c) => c.value !== 0);
    const byTender = [...groupRows(all, (r) => r.tender).entries()]
      .map(([tender, t]) => ({ tender, label: tenderLabel(tender), collected: t.gross, entries: t.entries }))
      .sort((a, b) => b.collected - a.collected);
    // Monthly mix for longer ranges
    const months = [...new Set(earned.map((r) => r.business_date.slice(0, 7)))].sort();
    const monthly = months.map((m) => {
      const inMonth = earned.filter((r) => r.business_date.startsWith(m));
      const g = groupRows(inMonth, (r) => r.area);
      return { month: m, ...Object.fromEntries([...g.entries()].map(([a, t]) => [areaLabel(a), t.net])) };
    });
    return { categories, totals: sumRows(earned), byTender, monthly, areasInMonthly: AREA_ORDER.filter((a) => byArea.has(a)) };
  }, [rows]);

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;
  if (error) return <div className="text-sm text-destructive">Failed to load revenue: {(error as Error).message}</div>;

  const total = view.totals.net;

  return (
    <div className="space-y-6">
      <LedgerStatusBar estimatedEntries={view.totals.estimated} />
      <RevenueTotalsCards totals={view.totals} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Revenue Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={view.categories.filter((c) => c.value > 0)} cx="50%" cy="50%" outerRadius={110} dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {view.categories.filter((c) => c.value > 0).map((c) => <Cell key={c.area} fill={areaColor(c.area)} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [money(v), "Revenue"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">How Customers Paid</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment method</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.byTender.map((t) => (
                  <TableRow key={t.tender}>
                    <TableCell>{t.label}</TableCell>
                    <TableCell className="text-right">{t.entries}</TableCell>
                    <TableCell className="text-right font-semibold">{money(t.collected)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Collected includes sales tax, card fees and tips. Card (Stripe) should match your Stripe deposits before Stripe's own fees.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">All Revenue Areas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.categories.map((c) => (
                <TableRow key={c.area}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: areaColor(c.area) }} />
                      {c.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{c.entries}</TableCell>
                  <TableCell className="text-right font-semibold">{money(c.value)}</TableCell>
                  <TableCell className="text-right">{total ? ((c.value / total) * 100).toFixed(1) : 0}%</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{view.totals.entries}</TableCell>
                <TableCell className="text-right">{money(total)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {view.monthly.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Revenue Mix by Month</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={view.monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis tickFormatter={(v) => moneyRound(v)} className="text-xs" />
                <Tooltip formatter={(v: number, name: string) => [money(v), name]} />
                <Legend />
                {view.areasInMonthly.map((a) => (
                  <Bar key={a} dataKey={areaLabel(a)} stackId="m" fill={areaColor(a)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
