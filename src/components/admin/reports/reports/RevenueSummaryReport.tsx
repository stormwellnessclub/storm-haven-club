import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users } from "lucide-react";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TIER_PRICING: Record<string, { monthly: number; annual: number }> = {
  diamond: { monthly: 695, annual: 500 },
  platinum: { monthly: 495, annual: 500 },
  gold: { monthly: 395, annual: 500 },
  silver: { monthly: 295, annual: 500 },
};

export function RevenueSummaryReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-revenue-summary', dateRange, filters],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('membership_applications')
        .select('membership_plan, status, founding_member, created_at')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      if (error) throw error;

      const tierFilter = filters.tier as string;
      const filtered = tierFilter && tierFilter !== 'all' 
        ? members?.filter(m => m.membership_plan?.toLowerCase().includes(tierFilter.toLowerCase()))
        : members;

      // Calculate revenue by tier
      const tierRevenue = (filtered || []).reduce((acc, member) => {
        const tier = member.membership_plan?.toLowerCase() || 'unknown';
        const pricing = Object.entries(TIER_PRICING).find(([key]) => tier.includes(key))?.[1] || { monthly: 0, annual: 0 };
        
        if (!acc[tier]) {
          acc[tier] = { tier, members: 0, monthlyRevenue: 0, annualFeeRevenue: 0 };
        }
        
        acc[tier].members += 1;
        if (member.status === 'active' || member.status === 'pending_activation') {
          acc[tier].monthlyRevenue += pricing.monthly;
          acc[tier].annualFeeRevenue += pricing.annual;
        }
        
        return acc;
      }, {} as Record<string, { tier: string; members: number; monthlyRevenue: number; annualFeeRevenue: number }>);

      const chartData = Object.values(tierRevenue).map(t => ({
        name: t.tier.charAt(0).toUpperCase() + t.tier.slice(1),
        'Monthly Dues': t.monthlyRevenue,
        'Annual Fees': t.annualFeeRevenue,
      }));

      const totals = Object.values(tierRevenue).reduce((acc, t) => ({
        members: acc.members + t.members,
        monthlyRevenue: acc.monthlyRevenue + t.monthlyRevenue,
        annualFeeRevenue: acc.annualFeeRevenue + t.annualFeeRevenue,
      }), { members: 0, monthlyRevenue: 0, annualFeeRevenue: 0 });

      return { tierRevenue: Object.values(tierRevenue), chartData, totals };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{data?.totals.members || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.totals.monthlyRevenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual Fees</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.totals.annualFeeRevenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {data?.chartData && data.chartData.length > 0 && (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={(v) => `$${v}`} className="text-xs" />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="Monthly Dues" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Annual Fees" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">Members</TableHead>
            <TableHead className="text-right">Monthly Revenue</TableHead>
            <TableHead className="text-right">Annual Fee Revenue</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.tierRevenue.map((row) => (
            <TableRow key={row.tier}>
              <TableCell className="font-medium capitalize">{row.tier}</TableCell>
              <TableCell className="text-right">{row.members}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.monthlyRevenue)}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.annualFeeRevenue)}</TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(row.monthlyRevenue + row.annualFeeRevenue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
