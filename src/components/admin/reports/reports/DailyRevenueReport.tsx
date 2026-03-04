import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";
import { format, parseISO, eachDayOfInterval } from "date-fns";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const AREA_COLORS: Record<string, string> = {
  Café: 'hsl(45, 93%, 47%)',
  Spa: 'hsl(280, 67%, 50%)',
  'Class Passes': 'hsl(199, 89%, 48%)',
  'Guest Passes': 'hsl(25, 95%, 53%)',
  Memberships: 'hsl(142, 76%, 36%)',
  Other: 'hsl(0, 0%, 50%)',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

export function DailyRevenueReport({ dateRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['daily-revenue-breakdown', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const [cafeRes, spaRes, classRes, guestRes, chargesRes] = await Promise.all([
        supabase.from('cafe_orders').select('total_amount, created_at')
          .gte('created_at', startDate).lte('created_at', endDate).eq('status', 'completed'),
        supabase.from('spa_appointments').select('service_price, member_price, appointment_date')
          .gte('appointment_date', startDate).lte('appointment_date', endDate).eq('status', 'completed'),
        supabase.from('class_passes').select('price_paid, purchased_at')
          .gte('purchased_at', startDate).lte('purchased_at', endDate),
        supabase.from('guest_passes').select('price_paid, purchased_at')
          .gte('purchased_at', startDate).lte('purchased_at', endDate),
        supabase.from('manual_charges').select('amount, description, created_at')
          .gte('created_at', startDate).lte('created_at', endDate).eq('status', 'succeeded'),
      ]);

      // Build daily map
      const dailyMap: Record<string, Record<string, number>> = {};
      const allDates = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      allDates.forEach(d => {
        dailyMap[format(d, 'yyyy-MM-dd')] = { Café: 0, Spa: 0, 'Class Passes': 0, 'Guest Passes': 0, Memberships: 0, Other: 0 };
      });

      (cafeRes.data || []).forEach(o => {
        const d = format(parseISO(o.created_at), 'yyyy-MM-dd');
        if (dailyMap[d]) dailyMap[d].Café += Number(o.total_amount) || 0;
      });

      (spaRes.data || []).forEach(a => {
        const d = a.appointment_date;
        if (dailyMap[d]) dailyMap[d].Spa += Number(a.member_price) || Number(a.service_price) || 0;
      });

      (classRes.data || []).forEach(p => {
        const d = format(parseISO(p.purchased_at), 'yyyy-MM-dd');
        if (dailyMap[d]) dailyMap[d]['Class Passes'] += Number(p.price_paid) || 0;
      });

      (guestRes.data || []).forEach(p => {
        if (!p.purchased_at) return;
        const d = format(parseISO(p.purchased_at), 'yyyy-MM-dd');
        if (dailyMap[d]) dailyMap[d]['Guest Passes'] += Number(p.price_paid) || 0;
      });

      (chargesRes.data || []).forEach(c => {
        const d = format(parseISO(c.created_at), 'yyyy-MM-dd');
        if (!dailyMap[d]) return;
        const desc = (c.description || '').toLowerCase();
        const amt = (Number(c.amount) || 0) / 100;
        if (desc.includes('membership') || desc.includes('dues')) dailyMap[d].Memberships += amt;
        else dailyMap[d].Other += amt;
      });

      const chartData = allDates.map(d => {
        const key = format(d, 'yyyy-MM-dd');
        const row = dailyMap[key];
        const total = Object.values(row).reduce((s, v) => s + v, 0);
        return { date: format(d, 'MMM d'), fullDate: key, ...row, Total: total };
      });

      const periodTotal = chartData.reduce((s, d) => s + d.Total, 0);
      const avgDaily = chartData.length > 0 ? periodTotal / chartData.length : 0;
      const bestDay = chartData.reduce((best, d) => d.Total > best.Total ? d : best, chartData[0] || { date: '-', Total: 0 });

      // Category totals
      const categoryTotals = { Café: 0, Spa: 0, 'Class Passes': 0, 'Guest Passes': 0, Memberships: 0, Other: 0 };
      chartData.forEach(d => {
        Object.keys(categoryTotals).forEach(k => {
          categoryTotals[k as keyof typeof categoryTotals] += (d as any)[k] || 0;
        });
      });

      return { chartData, periodTotal, avgDaily, bestDay, categoryTotals };
    },
  });

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Period Total</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.periodTotal || 0)}</p>
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
                <p className="text-2xl font-bold">{formatCurrency(data?.avgDaily || 0)}</p>
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
                <p className="text-2xl font-bold">{formatCurrency(data?.bestDay?.Total || 0)}</p>
                <p className="text-xs text-muted-foreground">{data?.bestDay?.date}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stacked Bar Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} className="text-xs" />
            <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} />
            <Legend />
            {Object.entries(AREA_COLORS).map(([key, color]) => (
              <Bar key={key} dataKey={key} stackId="revenue" fill={color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">% of Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.categoryTotals && Object.entries(data.categoryTotals)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, val]) => (
              <TableRow key={cat}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: AREA_COLORS[cat] }} />
                    {cat}
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(val)}</TableCell>
                <TableCell className="text-right">
                  {data.periodTotal > 0 ? ((val / data.periodTotal) * 100).toFixed(1) : 0}%
                </TableCell>
              </TableRow>
            ))}
          <TableRow className="font-bold bg-muted/50">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{formatCurrency(data?.periodTotal || 0)}</TableCell>
            <TableCell className="text-right">100%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
