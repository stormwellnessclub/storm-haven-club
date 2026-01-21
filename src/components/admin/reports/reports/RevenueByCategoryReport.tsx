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

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function RevenueByCategoryReport({ dateRange }: RevenueByCategoryReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['revenue-by-category', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      // Fetch manual charges (memberships, spa, etc.)
      const { data: manualCharges } = await supabase
        .from('manual_charges')
        .select('amount, description, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('status', 'succeeded');

      // Fetch class passes
      const { data: classPasses } = await supabase
        .from('class_passes')
        .select('price_paid, category, purchased_at')
        .gte('purchased_at', startDate)
        .lte('purchased_at', endDate);

      // Fetch guest passes
      const { data: guestPasses } = await supabase
        .from('guest_passes')
        .select('price_paid, purchased_at')
        .gte('purchased_at', startDate)
        .lte('purchased_at', endDate);

      // Calculate revenue by category
      let membershipRevenue = 0;
      let spaRevenue = 0;
      let otherRevenue = 0;

      (manualCharges || []).forEach(charge => {
        const desc = charge.description?.toLowerCase() || '';
        if (desc.includes('membership') || desc.includes('dues') || desc.includes('annual')) {
          membershipRevenue += Number(charge.amount) || 0;
        } else if (desc.includes('spa') || desc.includes('massage') || desc.includes('treatment')) {
          spaRevenue += Number(charge.amount) || 0;
        } else {
          otherRevenue += Number(charge.amount) || 0;
        }
      });

      const classRevenue = (classPasses || []).reduce((sum, p) => sum + (Number(p.price_paid) || 0), 0);
      const guestPassRevenue = (guestPasses || []).reduce((sum, p) => sum + (Number(p.price_paid) || 0), 0);

      return [
        { name: 'Memberships', value: membershipRevenue },
        { name: 'Classes', value: classRevenue },
        { name: 'Spa', value: spaRevenue },
        { name: 'Guest Passes', value: guestPassRevenue },
        { name: 'Other', value: otherRevenue },
      ].filter(item => item.value > 0);
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  const total = (data || []).reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(data || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data || []).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
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
    </div>
  );
}
