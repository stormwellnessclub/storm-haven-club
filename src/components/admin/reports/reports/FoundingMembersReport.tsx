import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TIER_PRICING: Record<string, number> = {
  diamond: 695,
  platinum: 495,
  gold: 395,
  silver: 295,
};

export function FoundingMembersReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-founding-members', dateRange, filters],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('membership_applications')
        .select('*');

      if (error) throw error;

      const founding = (members || []).filter(m => m.founding_member);
      const regular = (members || []).filter(m => !m.founding_member);

      // Calculate revenue
      const calcRevenue = (list: typeof members) => (list || []).reduce((sum, m) => {
        const type = m.membership_plan?.toLowerCase() || '';
        const tier = Object.keys(TIER_PRICING).find(t => type.includes(t));
        return sum + (tier ? TIER_PRICING[tier] : 0);
      }, 0);

      const foundingRevenue = calcRevenue(founding);
      const regularRevenue = calcRevenue(regular);

      const chartData = [
        { name: 'Founding Members', value: founding.length, color: 'hsl(45, 93%, 47%)' },
        { name: 'Regular Members', value: regular.length, color: 'hsl(var(--primary))' },
      ].filter(d => d.value > 0);

      // Tier breakdown for founding members
      const foundingByTier = founding.reduce((acc, m) => {
        const type = m.membership_plan?.toLowerCase() || '';
        const tier = Object.keys(TIER_PRICING).find(t => type.includes(t)) || 'other';
        if (!acc[tier]) acc[tier] = { tier, count: 0, revenue: 0 };
        acc[tier].count += 1;
        acc[tier].revenue += TIER_PRICING[tier] || 0;
        return acc;
      }, {} as Record<string, { tier: string; count: number; revenue: number }>);

      return {
        founding,
        regular,
        foundingRevenue,
        regularRevenue,
        chartData,
        foundingByTier: Object.values(foundingByTier),
        totalMembers: (members || []).length,
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  const foundingPercentage = data?.totalMembers ? ((data.founding.length / data.totalMembers) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Founding Members</p>
                <p className="text-2xl font-bold">{data?.founding.length || 0}</p>
                <p className="text-xs text-muted-foreground">{foundingPercentage}% of total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Regular Members</p>
                <p className="text-2xl font-bold">{data?.regular.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Founding Revenue/mo</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.foundingRevenue || 0)}</p>
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

        {/* Founding by Tier */}
        <div>
          <h4 className="font-semibold mb-4">Founding Members by Tier</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Monthly Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.foundingByTier
                .filter(t => t.tier !== 'other')
                .sort((a, b) => b.revenue - a.revenue)
                .map((row) => (
                  <TableRow key={row.tier}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        <Trophy className="h-3 w-3 mr-1 text-yellow-500" />
                        {row.tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
