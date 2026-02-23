import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, getDaysInMonth, addMonths } from "date-fns";
import { DollarSign, TrendingUp } from "lucide-react";
import {
  extractTier,
  normalizeGender,
  getMonthlyPrice,
  type MembershipTier,
} from "@/lib/membershipPricing";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const COLORS = {
  membership: 'hsl(142, 76%, 36%)',
  cafe: 'hsl(45, 93%, 47%)',
  spa: 'hsl(280, 67%, 50%)',
  classPasses: 'hsl(199, 89%, 48%)',
  guestPasses: 'hsl(25, 95%, 53%)',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

export function NextMonthProjectionReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['next-month-projection'],
    queryFn: async () => {
      const now = new Date();
      const nextMonth = addMonths(now, 1);
      const daysInNextMonth = getDaysInMonth(nextMonth);
      const thirtyDaysAgo = format(subDays(now, 30), 'yyyy-MM-dd');
      const today = format(now, 'yyyy-MM-dd');

      // 1. Active members for membership dues
      const { data: activeMembers } = await supabase
        .from('members')
        .select('membership_type, gender, is_founding_member')
        .eq('status', 'active');

      let membershipProjection = 0;
      const tierBreakdown: Record<string, { count: number; revenue: number }> = {};
      (activeMembers || []).forEach(m => {
        if (m.is_founding_member) return; // founding paid upfront
        const tier = extractTier(m.membership_type);
        const gender = normalizeGender(m.gender);
        const monthly = getMonthlyPrice(tier, gender);
        membershipProjection += monthly;
        if (!tierBreakdown[tier]) tierBreakdown[tier] = { count: 0, revenue: 0 };
        tierBreakdown[tier].count += 1;
        tierBreakdown[tier].revenue += monthly;
      });

      // 2. Cafe avg daily → project
      const { data: cafeOrders } = await supabase
        .from('cafe_orders')
        .select('total_amount')
        .gte('created_at', thirtyDaysAgo)
        .lte('created_at', today)
        .eq('status', 'completed');
      const cafeTotal30 = (cafeOrders || []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
      const cafeDailyAvg = cafeTotal30 / 30;
      const cafeProjection = cafeDailyAvg * daysInNextMonth;

      // 3. Spa avg daily → project
      const { data: spaAppts } = await supabase
        .from('spa_appointments')
        .select('service_price, member_price')
        .gte('appointment_date', thirtyDaysAgo)
        .lte('appointment_date', today)
        .eq('status', 'completed');
      const spaTotal30 = (spaAppts || []).reduce((s, a) => s + (Number(a.member_price) || Number(a.service_price) || 0), 0);
      const spaDailyAvg = spaTotal30 / 30;
      const spaProjection = spaDailyAvg * daysInNextMonth;

      // 4. Class passes avg weekly → project 4 weeks
      const { data: classPasses } = await supabase
        .from('class_passes')
        .select('price_paid')
        .gte('purchased_at', thirtyDaysAgo)
        .lte('purchased_at', today);
      const classTotal30 = (classPasses || []).reduce((s, p) => s + (Number(p.price_paid) || 0), 0);
      const classWeeklyAvg = classTotal30 / 4.3;
      const classProjection = classWeeklyAvg * (daysInNextMonth / 7);

      // 5. Guest passes avg weekly → project
      const { data: guestPasses } = await supabase
        .from('guest_passes')
        .select('price_paid')
        .gte('purchased_at', thirtyDaysAgo)
        .lte('purchased_at', today);
      const guestTotal30 = (guestPasses || []).reduce((s, p) => s + (Number(p.price_paid) || 0), 0);
      const guestWeeklyAvg = guestTotal30 / 4.3;
      const guestProjection = guestWeeklyAvg * (daysInNextMonth / 7);

      const totalProjection = membershipProjection + cafeProjection + spaProjection + classProjection + guestProjection;

      const chartData = [
        { name: 'Membership Dues', value: membershipProjection, fill: COLORS.membership },
        { name: 'Café', value: cafeProjection, fill: COLORS.cafe },
        { name: 'Spa Services', value: spaProjection, fill: COLORS.spa },
        { name: 'Class Passes', value: classProjection, fill: COLORS.classPasses },
        { name: 'Guest Passes', value: guestProjection, fill: COLORS.guestPasses },
      ];

      const assumptions = [
        { label: 'Active paying members', value: `${(activeMembers || []).filter(m => !m.is_founding_member).length}` },
        { label: 'Days in next month', value: `${daysInNextMonth}` },
        { label: 'Avg daily café revenue (30d)', value: formatCurrency(cafeDailyAvg) },
        { label: 'Avg daily spa revenue (30d)', value: formatCurrency(spaDailyAvg) },
        { label: 'Avg weekly class pass sales (30d)', value: formatCurrency(classWeeklyAvg) },
        { label: 'Avg weekly guest pass sales (30d)', value: formatCurrency(guestWeeklyAvg) },
      ];

      return { totalProjection, chartData, assumptions, tierBreakdown, nextMonthLabel: format(nextMonth, 'MMMM yyyy') };
    },
  });

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="space-y-6">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projected Revenue — {data?.nextMonthLabel}</p>
                <p className="text-3xl font-bold">{formatCurrency(data?.totalProjection || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent">
                <DollarSign className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Membership Dues (largest component)</p>
                <p className="text-3xl font-bold">{formatCurrency(data?.chartData?.[0]?.value || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Projected Revenue by Category</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="name" width={130} className="text-xs" />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Projected']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {(data?.chartData || []).map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Membership Tier Breakdown */}
      {data?.tierBreakdown && Object.keys(data.tierBreakdown).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Membership Dues by Tier</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Monthly Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(data.tierBreakdown).map(([tier, d]) => (
                  <TableRow key={tier}>
                    <TableCell className="capitalize font-medium">{tier}</TableCell>
                    <TableCell className="text-right">{d.count}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(d.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Assumptions */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Projection Assumptions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.assumptions || []).map(a => (
                <TableRow key={a.label}>
                  <TableCell className="text-muted-foreground">{a.label}</TableCell>
                  <TableCell className="text-right font-medium">{a.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
