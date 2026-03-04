import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, DollarSign, Users, TrendingUp } from "lucide-react";
import { format, parseISO, eachWeekOfInterval, endOfWeek, startOfWeek, isWithinInterval } from "date-fns";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const CATEGORY_COLORS: Record<string, string> = {
  pilates_cycling: 'hsl(280, 67%, 50%)',
  aerobics: 'hsl(199, 89%, 48%)',
  other: 'hsl(45, 93%, 47%)',
};

const CATEGORY_LABELS: Record<string, string> = {
  pilates_cycling: 'Pilates & Cycling',
  aerobics: 'Aerobics',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

export function ClassPassSalesReport({ dateRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['class-pass-sales', dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data: passes, error } = await supabase
        .from('class_passes')
        .select('*')
        .gte('purchased_at', dateRange.start.toISOString())
        .lte('purchased_at', dateRange.end.toISOString());

      if (error) throw error;

      const allPasses = passes || [];
      const totalPasses = allPasses.length;
      const totalRevenue = allPasses.reduce((s, p) => s + (Number(p.price_paid) || 0), 0);
      const memberPasses = allPasses.filter(p => p.is_member_price);
      const nonMemberPasses = allPasses.filter(p => !p.is_member_price);

      // By category
      const categoryMap: Record<string, { count: number; revenue: number }> = {};
      allPasses.forEach(p => {
        const cat = p.category || 'other';
        if (!categoryMap[cat]) categoryMap[cat] = { count: 0, revenue: 0 };
        categoryMap[cat].count += 1;
        categoryMap[cat].revenue += Number(p.price_paid) || 0;
      });

      const categoryData = Object.entries(categoryMap).map(([cat, d]) => ({
        name: CATEGORY_LABELS[cat] || cat,
        count: d.count,
        revenue: d.revenue,
        fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other,
      }));

      // Weekly trend
      const weeks = eachWeekOfInterval({ start: dateRange.start, end: dateRange.end }, { weekStartsOn: 1 });
      const weeklyData = weeks.map(weekStart => {
        const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekPasses = allPasses.filter(p => {
          const d = parseISO(p.purchased_at);
          return isWithinInterval(d, { start: weekStart, end: wEnd });
        });
        return {
          week: format(weekStart, 'MMM d'),
          Passes: weekPasses.length,
          Revenue: weekPasses.reduce((s, p) => s + (Number(p.price_paid) || 0), 0),
        };
      });

      return {
        totalPasses,
        totalRevenue,
        memberCount: memberPasses.length,
        memberRevenue: memberPasses.reduce((s, p) => s + (Number(p.price_paid) || 0), 0),
        nonMemberCount: nonMemberPasses.length,
        nonMemberRevenue: nonMemberPasses.reduce((s, p) => s + (Number(p.price_paid) || 0), 0),
        categoryData,
        weeklyData,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Ticket className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Passes Sold</p>
                <p className="text-2xl font-bold">{data?.totalPasses || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.totalRevenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Member Passes</p>
                <p className="text-2xl font-bold">{data?.memberCount || 0}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(data?.memberRevenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Non-Member Passes</p>
                <p className="text-2xl font-bold">{data?.nonMemberCount || 0}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(data?.nonMemberRevenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Category Bar Chart */}
      {data?.categoryData && data.categoryData.length > 0 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.categoryData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis yAxisId="left" allowDecimals={false} className="text-xs" />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${v}`} className="text-xs" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="Passes Sold" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="revenue" name="Revenue ($)" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly Trend */}
      {data?.weeklyData && data.weeklyData.length > 1 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weeklyData}>
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

      {/* Category Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Passes Sold</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Avg Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.categoryData?.map(cat => (
            <TableRow key={cat.name}>
              <TableCell className="font-medium">{cat.name}</TableCell>
              <TableCell className="text-right">{cat.count}</TableCell>
              <TableCell className="text-right">{formatCurrency(cat.revenue)}</TableCell>
              <TableCell className="text-right">{cat.count > 0 ? formatCurrency(cat.revenue / cat.count) : '$0'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
