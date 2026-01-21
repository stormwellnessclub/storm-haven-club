import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TIER_COLORS: Record<string, string> = {
  diamond: 'hsl(199, 89%, 48%)',
  platinum: 'hsl(270, 50%, 60%)',
  gold: 'hsl(45, 93%, 47%)',
  silver: 'hsl(0, 0%, 70%)',
};

const TIER_PRICING: Record<string, number> = {
  diamond: 695,
  platinum: 495,
  gold: 395,
  silver: 295,
};

export function TierDistributionReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-tier-distribution', dateRange, filters],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('membership_applications')
        .select('membership_plan, status, founding_member');

      if (error) throw error;

      const statusFilter = filters.status as string;
      const filtered = statusFilter && statusFilter !== 'all'
        ? members?.filter(m => m.status === statusFilter)
        : members;

      // Group by tier
      const tierCounts = (filtered || []).reduce((acc, member) => {
        const plan = member.membership_plan?.toLowerCase() || 'unknown';
        const tier = Object.keys(TIER_PRICING).find(t => plan.includes(t)) || 'other';
        
        if (!acc[tier]) {
          acc[tier] = { tier, count: 0, active: 0, revenue: 0 };
        }
        acc[tier].count += 1;
        if (member.status === 'active') {
          acc[tier].active += 1;
          acc[tier].revenue += TIER_PRICING[tier] || 0;
        }
        return acc;
      }, {} as Record<string, { tier: string; count: number; active: number; revenue: number }>);

      const chartData = Object.entries(tierCounts)
        .filter(([tier]) => tier !== 'other' && tier !== 'unknown')
        .map(([tier, data]) => ({
          name: tier.charAt(0).toUpperCase() + tier.slice(1),
          'Total Members': data.count,
          'Active Members': data.active,
          fill: TIER_COLORS[tier],
        }));

      const total = Object.values(tierCounts).reduce((sum, t) => sum + t.count, 0);
      const totalRevenue = Object.values(tierCounts).reduce((sum, t) => sum + t.revenue, 0);

      return { tierCounts: Object.values(tierCounts), chartData, total, totalRevenue };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Total Members" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
            <Bar dataKey="Active Members" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">Total Members</TableHead>
            <TableHead className="text-right">Active Members</TableHead>
            <TableHead className="text-right">Monthly Revenue</TableHead>
            <TableHead className="text-right">% of Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.tierCounts
            .filter(row => row.tier !== 'other' && row.tier !== 'unknown')
            .sort((a, b) => b.count - a.count)
            .map((row) => (
              <TableRow key={row.tier}>
                <TableCell className="font-medium capitalize">{row.tier}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right">{row.active}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                <TableCell className="text-right">
                  {data?.total ? ((row.count / data.total) * 100).toFixed(1) : 0}%
                </TableCell>
              </TableRow>
            ))}
          <TableRow className="bg-muted/50">
            <TableCell className="font-bold">Total</TableCell>
            <TableCell className="text-right font-bold">{data?.total}</TableCell>
            <TableCell className="text-right font-bold">
              {data?.tierCounts.reduce((sum, t) => sum + t.active, 0)}
            </TableCell>
            <TableCell className="text-right font-bold">{formatCurrency(data?.totalRevenue || 0)}</TableCell>
            <TableCell className="text-right font-bold">100%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
