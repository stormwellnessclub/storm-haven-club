import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, CheckCircle, Clock, XCircle, DollarSign, TrendingUp } from "lucide-react";
import { format, parseISO, eachWeekOfInterval, endOfWeek, isWithinInterval } from "date-fns";
import { GUEST_PASS_COLUMNS } from "@/lib/guestPassStatus";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

export function GuestPassUsageReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-guest-pass-usage', dateRange, filters],
    queryFn: async () => {
      const { data: passes, error } = await supabase
        .from('guest_passes')
        .select(GUEST_PASS_COLUMNS)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      if (error) throw error;

      const allPasses = passes || [];

      const statusCounts = allPasses.reduce((acc, pass) => {
        const status = pass.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const chartData = [
        { name: 'Pending', value: statusCounts['pending'] || 0, color: 'hsl(45, 93%, 47%)' },
        { name: 'Used', value: (statusCounts['used'] || 0) + (statusCounts['exhausted'] || 0), color: 'hsl(142, 76%, 36%)' },
        { name: 'Expired', value: statusCounts['expired'] || 0, color: 'hsl(0, 84%, 60%)' },
        { name: 'Active', value: statusCounts['active'] || 0, color: 'hsl(199, 89%, 48%)' },
      ].filter(d => d.value > 0);

      const total = allPasses.length;
      const used = (statusCounts['used'] || 0) + (statusCounts['exhausted'] || 0);
      const conversionRate = total > 0 ? (used / total) * 100 : 0;

      // Revenue metrics
      const totalRevenue = allPasses.reduce((s, p) => s + (Number(p.price_paid) || 0), 0);
      const avgRevenuePerPass = total > 0 ? totalRevenue / total : 0;

      // Weekly trend
      const weeks = eachWeekOfInterval({ start: dateRange.start, end: dateRange.end }, { weekStartsOn: 1 });
      const weeklyTrend = weeks.map(weekStart => {
        const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekPasses = allPasses.filter(p => {
          const d = parseISO(p.created_at!);
          return isWithinInterval(d, { start: weekStart, end: wEnd });
        });
        return {
          week: format(weekStart, 'MMM d'),
          Passes: weekPasses.length,
          Revenue: weekPasses.reduce((s, p) => s + (Number(p.price_paid) || 0), 0),
        };
      });

      return { passes: allPasses, statusCounts, chartData, total, used, conversionRate, totalRevenue, avgRevenuePerPass, weeklyTrend };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Ticket className="h-7 w-7 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Issued</p>
                <p className="text-xl font-bold">{data?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-7 w-7 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Used</p>
                <p className="text-xl font-bold">{data?.used || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-7 w-7 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{data?.statusCounts?.['pending'] || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-7 w-7 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Expired</p>
                <p className="text-xl font-bold">{data?.statusCounts?.['expired'] || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-7 w-7 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-bold">{formatCurrency(data?.totalRevenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Avg/Pass</p>
                <p className="text-xl font-bold">{formatCurrency(data?.avgRevenuePerPass || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data?.chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data?.chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Rate */}
        <div className="flex items-center justify-center">
          <div className="text-center">
            <p className="text-6xl font-bold text-primary">{data?.conversionRate.toFixed(1)}%</p>
            <p className="text-lg text-muted-foreground mt-2">Conversion Rate</p>
            <p className="text-sm text-muted-foreground">Passes used out of total issued</p>
          </div>
        </div>
      </div>

      {/* Weekly Trend */}
      {data?.weeklyTrend && data.weeklyTrend.length > 1 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" className="text-xs" />
              <YAxis yAxisId="left" allowDecimals={false} className="text-xs" />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${v}`} className="text-xs" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="Passes" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="Revenue" stroke="hsl(142, 76%, 36%)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Passes Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>Expires</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.passes?.slice(0, 10).map((pass) => (
            <TableRow key={pass.id}>
              <TableCell className="font-medium">{pass.guest_name}</TableCell>
              <TableCell>{pass.guest_email}</TableCell>
              <TableCell className="capitalize">{pass.status}</TableCell>
              <TableCell className="text-right">{formatCurrency(Number(pass.price_paid) || 0)}</TableCell>
              <TableCell>{format(parseISO(pass.created_at!), 'MMM d, yyyy')}</TableCell>
              <TableCell>{pass.expires_at ? format(parseISO(pass.expires_at), 'MMM d, yyyy') : '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
