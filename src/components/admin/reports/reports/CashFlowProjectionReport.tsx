import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, format } from "date-fns";

interface CashFlowProjectionReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TIER_PRICING: Record<string, number> = {
  diamond: 595,
  platinum: 495,
  gold: 395,
  silver: 295,
};

export function CashFlowProjectionReport({ filters }: CashFlowProjectionReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow-projection', filters.tier, filters.foundingOnly],
    queryFn: async () => {
      let query = supabase
        .from('members')
        .select('membership_type, is_founding_member, status')
        .eq('status', 'active');

      const { data: members, error } = await query;
      if (error) throw error;

      // Filter based on filters
      let filtered = members || [];
      
      if (filters.tier && filters.tier !== 'all') {
        filtered = filtered.filter(m => 
          m.membership_type?.toLowerCase().includes(String(filters.tier).toLowerCase())
        );
      }
      
      if (filters.foundingOnly) {
        filtered = filtered.filter(m => m.is_founding_member);
      }

      // Calculate monthly revenue projection for next 12 months
      const projections = [];
      const now = new Date();

      for (let i = 0; i < 12; i++) {
        const month = addMonths(now, i);
        let monthlyRevenue = 0;

        filtered.forEach(member => {
          const type = member.membership_type?.toLowerCase() || '';
          const tier = Object.keys(TIER_PRICING).find(t => type.includes(t));
          const basePrice = tier ? TIER_PRICING[tier] : 395;
          
          // Founding members get 20% discount
          const price = member.is_founding_member ? basePrice * 0.8 : basePrice;
          monthlyRevenue += price;
        });

        projections.push({
          month: format(month, 'MMM yyyy'),
          projected: monthlyRevenue,
          cumulative: projections.length > 0 
            ? projections[projections.length - 1].cumulative + monthlyRevenue 
            : monthlyRevenue,
        });
      }

      return {
        projections,
        activeMembers: filtered.length,
        foundingMembers: filtered.filter(m => m.is_founding_member).length,
        regularMembers: filtered.filter(m => !m.is_founding_member).length,
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  const totalProjected = data?.projections.reduce((sum, p) => sum + p.projected, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.activeMembers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Founding Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.foundingMembers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Regular Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.regularMembers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">12-Month Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalProjected.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>12-Month Cash Flow Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data?.projections || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis 
                yAxisId="left"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                className="text-xs"
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                className="text-xs"
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString()}`,
                  name === 'projected' ? 'Monthly Revenue' : 'Cumulative'
                ]}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="projected" 
                stroke="hsl(var(--primary))" 
                name="Monthly Revenue"
                strokeWidth={2}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="cumulative" 
                stroke="hsl(var(--chart-2))" 
                name="Cumulative"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
