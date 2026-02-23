import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, eachWeekOfInterval } from "date-fns";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const COLORS = [
  'hsl(142, 76%, 36%)', 'hsl(45, 93%, 47%)', 'hsl(199, 89%, 48%)',
  'hsl(280, 67%, 50%)', 'hsl(25, 95%, 53%)', 'hsl(0, 84%, 60%)',
  'hsl(170, 70%, 40%)', 'hsl(210, 80%, 55%)',
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

export function SalesSegmentationReport({ dateRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-segmentation', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const [chargesRes, cafeRes, spaRes, classPassRes, guestPassRes, paymentsRes] = await Promise.all([
        supabase.from('manual_charges').select('amount, description, created_at')
          .gte('created_at', startDate).lte('created_at', endDate).eq('status', 'succeeded'),
        supabase.from('cafe_orders').select('total_amount, created_at')
          .gte('created_at', startDate).lte('created_at', endDate).eq('status', 'completed'),
        supabase.from('spa_appointments').select('service_price, member_price, appointment_date')
          .gte('appointment_date', startDate).lte('appointment_date', endDate).eq('status', 'completed'),
        supabase.from('class_passes').select('price_paid, category, purchased_at')
          .gte('purchased_at', startDate).lte('purchased_at', endDate),
        supabase.from('guest_passes').select('price_paid, purchased_at')
          .gte('purchased_at', startDate).lte('purchased_at', endDate),
        supabase.from('payment_attempts').select('amount, created_at')
          .gte('created_at', startDate).lte('created_at', endDate).eq('status', 'succeeded'),
      ]);

      // Categorize manual charges
      let membershipDues = 0, initiationFees = 0, annualFees = 0, otherCharges = 0;
      (chargesRes.data || []).forEach(c => {
        const desc = (c.description || '').toLowerCase();
        const amt = (Number(c.amount) || 0) / 100;
        if (desc.includes('initiation')) initiationFees += amt;
        else if (desc.includes('annual')) annualFees += amt;
        else if (desc.includes('membership') || desc.includes('dues')) membershipDues += amt;
        else otherCharges += amt;
      });

      // Cafe
      const cafeRevenue = (cafeRes.data || []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

      // Spa
      const spaRevenue = (spaRes.data || []).reduce((s, a) => s + (Number(a.member_price) || Number(a.service_price) || 0), 0);

      // Class passes by category
      const classPassByCategory: Record<string, number> = {};
      let classPassTotal = 0;
      (classPassRes.data || []).forEach(p => {
        const amt = Number(p.price_paid) || 0;
        classPassTotal += amt;
        const cat = p.category || 'other';
        classPassByCategory[cat] = (classPassByCategory[cat] || 0) + amt;
      });

      // Guest passes
      const guestPassRevenue = (guestPassRes.data || []).reduce((s, p) => s + (Number(p.price_paid) || 0), 0);

      // Subscription payments
      const subscriptionRevenue = (paymentsRes.data || []).reduce((s, p) => s + ((Number(p.amount) || 0) / 100), 0);

      const categories = [
        { name: 'Subscription Payments', value: subscriptionRevenue },
        { name: 'Membership Dues', value: membershipDues },
        { name: 'Initiation Fees', value: initiationFees },
        { name: 'Annual Fees', value: annualFees },
        { name: 'Café / Juice Bar', value: cafeRevenue },
        { name: 'Spa Services', value: spaRevenue },
        { name: 'Class Passes', value: classPassTotal },
        { name: 'Guest Passes', value: guestPassRevenue },
        { name: 'Other Charges', value: otherCharges },
      ].filter(c => c.value > 0);

      const total = categories.reduce((s, c) => s + c.value, 0);

      // Weekly bar chart data
      const weeks = eachWeekOfInterval({ start: dateRange.start, end: dateRange.end });
      const weeklyData = weeks.map(w => {
        const weekLabel = format(w, 'MMM d');
        return { week: weekLabel };
      });

      return { categories, total, classPassByCategory, weeklyData };
    },
  });

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">Total Revenue (Period)</p>
          <p className="text-4xl font-bold text-primary">{formatCurrency(data?.total || 0)}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pie Chart */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Revenue Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={data?.categories} cx="50%" cy="50%" outerRadius={110} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {(data?.categories || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Category Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.categories || []).map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{formatCurrency(item.value)}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {data?.total ? ((item.value / data.total) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatCurrency(data?.total || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">All Revenue Categories</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.categories || []).map((item, i) => (
                <TableRow key={item.name}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {item.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(item.value)}</TableCell>
                  <TableCell className="text-right">
                    {data?.total ? ((item.value / data.total) * 100).toFixed(1) : 0}%
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(data?.total || 0)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Class Pass Sub-breakdown */}
      {data?.classPassByCategory && Object.keys(data.classPassByCategory).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Class Pass Breakdown by Category</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class Category</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(data.classPassByCategory).map(([cat, amt]) => (
                  <TableRow key={cat}>
                    <TableCell><Badge variant="outline" className="capitalize">{cat}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(amt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
