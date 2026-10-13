import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { LedgerStatusBar } from "../LedgerStatusBar";
import {
  AREA_ORDER, areaColor, areaLabel, isEarnedArea, money, moneyRound, sumRows, toBusinessDate, useRevenueSummary,
} from "@/lib/revenueLedger";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function DailyRevenueReport({ dateRange }: Props) {
  const { data: rows, isLoading, error } = useRevenueSummary(dateRange);

  const view = useMemo(() => {
    const earned = (rows ?? []).filter((r) => isEarnedArea(r.area));
    const areas = AREA_ORDER.filter((a) => earned.some((r) => r.area === a));
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).map((d) => toBusinessDate(d));
    const byDay = new Map<string, Record<string, number>>(days.map((d) => [d, {}]));
    for (const r of earned) {
      const day = byDay.get(r.business_date);
      if (day) day[r.area] = (day[r.area] ?? 0) + r.net_cents / 100;
    }
    const chartData = days.map((d) => {
      const vals = byDay.get(d)!;
      const total = Object.values(vals).reduce((s, v) => s + v, 0);
      return { date: format(parseISO(d), "MMM d"), fullDate: d, ...Object.fromEntries(areas.map((a) => [areaLabel(a), vals[a] ?? 0])), Total: total };
    });
    const totals = sumRows(earned);
    const bestDay = chartData.reduce((best, d) => (d.Total > best.Total ? d : best), chartData[0] ?? { date: "-", Total: 0 });
    const areaTotals = areas
      .map((a) => ({ area: a, value: sumRows(earned.filter((r) => r.area === a)).net }))
      .sort((x, y) => y.value - x.value);
    return { areas, chartData, totals, bestDay, areaTotals, avgDaily: chartData.length ? totals.net / chartData.length : 0 };
  }, [rows, dateRange.start, dateRange.end]);

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;
  if (error) return <div className="text-sm text-destructive">Failed to load revenue: {(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <LedgerStatusBar estimatedEntries={view.totals.estimated} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Period Revenue</p>
                <p className="text-2xl font-bold">{moneyRound(view.totals.net)}</p>
                <p className="text-xs text-muted-foreground">After tax, card fees &amp; tips</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Daily Average</p>
                <p className="text-2xl font-bold">{moneyRound(view.avgDaily)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Best Day</p>
                <p className="text-2xl font-bold">{moneyRound(view.bestDay?.Total || 0)}</p>
                <p className="text-xs text-muted-foreground">{view.bestDay?.date}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={view.chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} className="text-xs" />
            <Tooltip formatter={(v: number, name: string) => [money(v), name]} />
            <Legend />
            {view.areas.map((a) => (
              <Bar key={a} dataKey={areaLabel(a)} stackId="revenue" fill={areaColor(a)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Area</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">% of Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.areaTotals.map(({ area, value }) => (
            <TableRow key={area}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: areaColor(area) }} />
                  {areaLabel(area)}
                </div>
              </TableCell>
              <TableCell className="text-right">{money(value)}</TableCell>
              <TableCell className="text-right">
                {view.totals.net > 0 ? ((value / view.totals.net) * 100).toFixed(1) : 0}%
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-bold bg-muted/50">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{money(view.totals.net)}</TableCell>
            <TableCell className="text-right">100%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
