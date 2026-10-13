import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LedgerStatusBar } from "../LedgerStatusBar";
import { RevenueTotalsCards } from "../RevenueTotalsCards";
import {
  AREA_ORDER, areaColor, areaLabel, groupRows, isEarnedArea, money, sumRows, useRevenueSummary,
} from "@/lib/revenueLedger";

interface RevenueByCategoryReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function RevenueByCategoryReport({ dateRange }: RevenueByCategoryReportProps) {
  const { data: rows, isLoading, error } = useRevenueSummary(dateRange);

  const view = useMemo(() => {
    const all = rows ?? [];
    const earned = all.filter((r) => isEarnedArea(r.area));
    const byArea = groupRows(earned, (r) => r.area);
    const salesByArea = groupRows(earned.filter((r) => r.kind === "sale"), (r) => r.area);
    const areas = AREA_ORDER.filter((a) => byArea.has(a)).map((a) => ({
      area: a,
      name: areaLabel(a),
      sales: salesByArea.get(a)?.net ?? 0,
      refunds: byArea.get(a)!.refunds,
      net: byArea.get(a)!.net,
    }));
    return {
      areas,
      totals: sumRows(earned),
      giftCards: sumRows(all.filter((r) => !isEarnedArea(r.area))),
    };
  }, [rows]);

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (error) return <div className="text-sm text-destructive">Failed to load revenue: {(error as Error).message}</div>;

  const pieData = view.areas.filter((a) => a.net > 0);
  const total = view.totals.net;

  return (
    <div className="space-y-6">
      <LedgerStatusBar estimatedEntries={view.totals.estimated} />
      <RevenueTotalsCards totals={view.totals} />

      <Card>
        <CardHeader><CardTitle className="text-lg">Revenue Distribution</CardTitle></CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No revenue in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={450}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" labelLine={false} outerRadius={150} dataKey="net" nameKey="name">
                  {pieData.map((a) => <Cell key={a.area} fill={areaColor(a.area)} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [money(v), "Revenue"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Revenue by Area</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Refunds &amp; disputes</TableHead>
                <TableHead className="text-right">Net revenue</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.areas.map((a) => (
                <TableRow key={a.area}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: areaColor(a.area) }} />
                      <span className="font-medium">{a.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{money(a.sales)}</TableCell>
                  <TableCell className="text-right text-destructive">{a.refunds ? money(a.refunds) : "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{money(a.net)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {total > 0 ? `${((a.net / total) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total revenue</TableCell>
                <TableCell className="text-right">{money(total - view.totals.refunds)}</TableCell>
                <TableCell className="text-right text-destructive">{view.totals.refunds ? money(view.totals.refunds) : "—"}</TableCell>
                <TableCell className="text-right font-bold">{money(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
          {view.giftCards.gross !== 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Gift cards &amp; vouchers sold this period: <strong>{money(view.giftCards.net)}</strong>. Not counted as
              revenue until the service is used.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
