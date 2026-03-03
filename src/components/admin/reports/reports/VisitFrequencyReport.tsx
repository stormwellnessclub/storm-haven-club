import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface VisitFrequencyReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TIER_COLORS: Record<string, string> = {
  diamond: 'hsl(var(--chart-1))',
  platinum: 'hsl(var(--chart-2))',
  gold: 'hsl(var(--chart-3))',
  silver: 'hsl(var(--chart-4))',
  other: 'hsl(var(--chart-5))',
};

export function VisitFrequencyReport({ dateRange, filters }: VisitFrequencyReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['visit-frequency', dateRange.start, dateRange.end, filters.tier],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      // Fetch members with their check-ins
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('id, first_name, last_name, membership_type, status')
        .eq('status', 'active');

      if (membersError) throw membersError;

      const { data: checkIns, error: checkInsError } = await supabase
        .from('check_ins')
        .select('member_id, checked_in_at')
        .gte('checked_in_at', startDate)
        .lte('checked_in_at', endDate);

      if (checkInsError) throw checkInsError;

      // Count check-ins per member
      const checkInCounts: Record<string, number> = {};
      (checkIns || []).forEach(ci => {
        checkInCounts[ci.member_id] = (checkInCounts[ci.member_id] || 0) + 1;
      });

      // Calculate stats per tier
      const tierStats: Record<string, { tier: string; totalVisits: number; memberCount: number; avgVisits: number }> = {};

      (members || []).forEach(member => {
        const type = member.membership_type?.toLowerCase() || '';
        const tier = ['diamond', 'platinum', 'gold', 'silver'].find(t => type.includes(t)) || 'other';
        
        if (filters.tier && filters.tier !== 'all' && tier !== filters.tier) return;

        if (!tierStats[tier]) {
          tierStats[tier] = { tier, totalVisits: 0, memberCount: 0, avgVisits: 0 };
        }

        tierStats[tier].memberCount += 1;
        tierStats[tier].totalVisits += checkInCounts[member.id] || 0;
      });

      // Calculate averages
      Object.values(tierStats).forEach(stat => {
        stat.avgVisits = stat.memberCount > 0 
          ? Math.round((stat.totalVisits / stat.memberCount) * 10) / 10 
          : 0;
      });

      // Fetch all-time check-ins for lifetime counts
      const { data: allTimeCheckIns } = await supabase
        .from('check_ins')
        .select('member_id');

      const lifetimeCounts: Record<string, number> = {};
      (allTimeCheckIns || []).forEach(ci => {
        lifetimeCounts[ci.member_id] = (lifetimeCounts[ci.member_id] || 0) + 1;
      });

      // Get top visitors
      const topVisitors = (members || [])
        .map(m => ({
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          tier: ['diamond', 'platinum', 'gold', 'silver'].find(t => m.membership_type?.toLowerCase().includes(t)) || 'other',
          visits: checkInCounts[m.id] || 0,
          lifetime: lifetimeCounts[m.id] || 0,
        }))
        .filter(m => m.visits > 0)
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 10);

      return {
        tierData: Object.values(tierStats).sort((a, b) => b.avgVisits - a.avgVisits),
        topVisitors,
        totalVisits: checkIns?.length || 0,
        activeMembers: members?.length || 0,
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  const overallAvg = data?.activeMembers && data.activeMembers > 0
    ? Math.round((data.totalVisits / data.activeMembers) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalVisits || 0}</div>
          </CardContent>
        </Card>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Visits/Member</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallAvg}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average Visits by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.tierData || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" />
                <YAxis dataKey="tier" type="category" width={80} className="capitalize" />
                <Tooltip 
                  formatter={(value: number) => [value.toFixed(1), 'Avg Visits']}
                />
                <Bar dataKey="avgVisits" radius={[0, 4, 4, 0]}>
                  {(data?.tierData || []).map((entry) => (
                    <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || TIER_COLORS.other} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Visitors</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Period</TableHead>
                  <TableHead className="text-right">Lifetime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.topVisitors || []).map((visitor, index) => (
                  <TableRow key={visitor.id}>
                    <TableCell>
                      <span className="font-medium">{index + 1}.</span> {visitor.name}
                    </TableCell>
                    <TableCell className="capitalize">{visitor.tier}</TableCell>
                    <TableCell className="text-right font-bold">{visitor.visits}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{visitor.lifetime}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
