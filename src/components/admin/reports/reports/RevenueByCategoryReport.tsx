import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface RevenueByCategoryReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const COLORS = ['hsl(142, 76%, 36%)', 'hsl(45, 93%, 47%)', 'hsl(199, 89%, 48%)', 'hsl(280, 67%, 50%)', 'hsl(25, 95%, 53%)', 'hsl(0, 84%, 60%)', 'hsl(170, 70%, 40%)', 'hsl(340, 82%, 55%)', 'hsl(220, 15%, 55%)'];

export function RevenueByCategoryReport({ dateRange }: RevenueByCategoryReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['revenue-by-category', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const [chargesRes, cafeRes, spaRes, classPassRes, guestPassRes, eventsRes] = await Promise.all([
        supabase.from('manual_charges').select('amount, description, created_at')
          .gte('created_at', startDate).lte('created_at', endDate).eq('status', 'succeeded'),
        supabase.from('cafe_orders').select('total_amount')
          .gte('created_at', startDate).lte('created_at', endDate).eq('status', 'completed'),
        supabase.from('spa_appointments').select('service_price, member_price')
          .gte('appointment_date', startDate).lte('appointment_date', endDate).eq('status', 'completed'),
        supabase.from('class_passes').select('price_paid')
          .gte('purchased_at', startDate).lte('purchased_at', endDate),
        supabase.from('guest_passes').select('price_paid')
          .gte('purchased_at', startDate).lte('purchased_at', endDate),
        supabase.from('event_tickets').select('amount_cents, created_at')
          .gte('created_at', startDate).lte('created_at', endDate).eq('status', 'paid'),
      ]);

      let membershipRevenue = 0, initiationFees = 0, annualFees = 0, otherCharges = 0;
      (chargesRes.data || []).forEach(c => {
        const desc = (c.description || '').toLowerCase();
        const amt = (Number(c.amount) || 0) / 100;
        if (desc.includes('initiation')) initiationFees += amt;
        else if (desc.includes('annual')) annualFees += amt;
        else if (desc.includes('membership') || desc.includes('dues')) membershipRevenue += amt;
        else otherCharges += amt;
      });

      const cafeRevenue = (cafeRes.data || []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
      const spaRevenue = (spaRes.data || []).reduce((s, a) => s + (Number(a.member_price) || Number(a.service_price) || 0), 0);
      const classRevenue = (classPassRes.data || []).reduce((s, p) => s + (Number(p.price_paid) || 0), 0);
      const guestPassRevenue = (guestPassRes.data || []).reduce((s, p) => s + (Number(p.price_paid) || 0), 0);
      const eventsRevenue = (eventsRes.data || []).reduce((s, t) => s + ((Number(t.amount_cents) || 0) / 100), 0);

      return [
        { name: 'Memberships', value: membershipRevenue },
        { name: 'Initiation Fees', value: initiationFees },
        { name: 'Annual Fees', value: annualFees },
        { name: 'Café / Juice Bar', value: cafeRevenue },
        { name: 'Spa Services', value: spaRevenue },
        { name: 'Class Passes', value: classRevenue },
        { name: 'Guest Passes', value: guestPassRevenue },
        { name: 'Events', value: eventsRevenue },
        { name: 'Other', value: otherCharges },
      ].filter(item => item.value > 0);
    },
  });

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  const total = (data || []).reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6">
      {/* Chart - full width, larger */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Revenue Distribution</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={450}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" labelLine={false}
                outerRadius={150} dataKey="value">
                {(data || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Category Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(data || []).map((item, i) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">${item.value.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">
                    {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            ))}
            <div className="border-t pt-4 flex items-center justify-between font-bold">
              <span>Total Revenue</span>
              <span>${total.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
