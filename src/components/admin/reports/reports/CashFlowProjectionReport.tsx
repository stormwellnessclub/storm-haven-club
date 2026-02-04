import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, format } from "date-fns";
import { 
  MEMBERSHIP_PRICING, 
  extractTier, 
  normalizeGender, 
  getMonthlyPrice, 
  getAnnualPrice,
  type MembershipTier,
  type GenderType
} from "@/lib/membershipPricing";

interface CashFlowProjectionReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function CashFlowProjectionReport({ filters }: CashFlowProjectionReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow-projection', filters.tier, filters.foundingOnly],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('members')
        .select('membership_type, is_founding_member, status, gender')
        .eq('status', 'active');

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

      // Separate founding and regular members
      const foundingMembers = filtered.filter(m => m.is_founding_member);
      const regularMembers = filtered.filter(m => !m.is_founding_member);

      for (let i = 0; i < 12; i++) {
        const month = addMonths(now, i);
        let monthlyRevenue = 0;
        let foundingRevenue = 0;
        let regularRevenue = 0;

        // Founding members: Full annual amount in month 1 only
        if (i === 0) {
          foundingMembers.forEach(member => {
            const tier = extractTier(member.membership_type);
            const gender = normalizeGender(member.gender);
            foundingRevenue += getAnnualPrice(tier, gender);
          });
        }
        // Months 2-12: $0 for founding (already paid upfront)

        // Regular members: Monthly payment every month
        regularMembers.forEach(member => {
          const tier = extractTier(member.membership_type);
          const gender = normalizeGender(member.gender);
          regularRevenue += getMonthlyPrice(tier, gender);
        });

        monthlyRevenue = foundingRevenue + regularRevenue;

        projections.push({
          month: format(month, 'MMM yyyy'),
          projected: monthlyRevenue,
          founding: foundingRevenue,
          regular: regularRevenue,
          cumulative: projections.length > 0 
            ? projections[projections.length - 1].cumulative + monthlyRevenue 
            : monthlyRevenue,
        });
      }

      // Calculate totals
      const totalFoundingAnnual = foundingMembers.reduce((sum, m) => {
        const tier = extractTier(m.membership_type);
        const gender = normalizeGender(m.gender);
        return sum + getAnnualPrice(tier, gender);
      }, 0);

      const monthlyRecurring = regularMembers.reduce((sum, m) => {
        const tier = extractTier(m.membership_type);
        const gender = normalizeGender(m.gender);
        return sum + getMonthlyPrice(tier, gender);
      }, 0);

      return {
        projections,
        activeMembers: filtered.length,
        foundingMembers: foundingMembers.length,
        regularMembers: regularMembers.length,
        totalFoundingAnnual,
        monthlyRecurring,
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
            <p className="text-xs text-muted-foreground">
              ${(data?.totalFoundingAnnual || 0).toLocaleString()} paid upfront
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Regular Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.regularMembers || 0}</div>
            <p className="text-xs text-muted-foreground">
              ${(data?.monthlyRecurring || 0).toLocaleString()}/mo recurring
            </p>
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
          <p className="text-sm text-muted-foreground">
            Month 1 includes founding member annual payments (paid upfront)
          </p>
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
                  name === 'projected' ? 'Monthly Revenue' : 
                  name === 'founding' ? 'Founding (Upfront)' :
                  name === 'regular' ? 'Regular (Monthly)' : 'Cumulative'
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
                yAxisId="left"
                type="monotone" 
                dataKey="founding" 
                stroke="hsl(45, 93%, 47%)" 
                name="Founding (Upfront)"
                strokeWidth={2}
                strokeDasharray="3 3"
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="regular" 
                stroke="hsl(var(--chart-2))" 
                name="Regular (Monthly)"
                strokeWidth={2}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="cumulative" 
                stroke="hsl(var(--chart-3))" 
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
