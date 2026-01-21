import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function CreditBalancesReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-credit-balances', dateRange, filters],
    queryFn: async () => {
      const { data: credits, error } = await supabase
        .from('member_credits')
        .select(`
          *,
          members (first_name, last_name, email, membership_type)
        `)
        .gt('credits_remaining', 0);

      if (error) throw error;

      const tierFilter = filters.tier as string;
      const filtered = tierFilter && tierFilter !== 'all'
        ? credits?.filter(c => c.members?.membership_type?.toLowerCase().includes(tierFilter.toLowerCase()))
        : credits;

      // Summarize by credit type
      const typeSummary = (filtered || []).reduce((acc, credit) => {
        const type = credit.credit_type || 'unknown';
        if (!acc[type]) {
          acc[type] = { type, members: 0, totalCredits: 0, totalUsed: 0 };
        }
        acc[type].members += 1;
        acc[type].totalCredits += credit.credits_remaining || 0;
        acc[type].totalUsed += (credit.credits_total || 0) - (credit.credits_remaining || 0);
        return acc;
      }, {} as Record<string, { type: string; members: number; totalCredits: number; totalUsed: number }>);

      const chartData = Object.values(typeSummary).map(t => ({
        name: t.type.charAt(0).toUpperCase() + t.type.slice(1).replace(/_/g, ' '),
        'Remaining': t.totalCredits,
        'Used': t.totalUsed,
      }));

      const totalCredits = (filtered || []).reduce((sum, c) => sum + (c.credits_remaining || 0), 0);
      const membersWithCredits = new Set((filtered || []).map(c => c.member_id)).size;

      return { 
        credits: filtered, 
        typeSummary: Object.values(typeSummary), 
        chartData, 
        totalCredits,
        membersWithCredits 
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Credits</p>
                <p className="text-2xl font-bold">{data?.totalCredits || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Members with Credits</p>
                <p className="text-2xl font-bold">{data?.membersWithCredits || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg per Member</p>
                <p className="text-2xl font-bold">
                  {data?.membersWithCredits 
                    ? (data.totalCredits / data.membersWithCredits).toFixed(1) 
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {data?.chartData && data.chartData.length > 0 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey="Remaining" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Used" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Credit Holders Table */}
      <div>
        <h4 className="font-semibold mb-4">Top Credit Holders</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Credit Type</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Purchased</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.credits
              ?.sort((a, b) => (b.credits_remaining || 0) - (a.credits_remaining || 0))
              .slice(0, 15)
              .map((credit) => (
                <TableRow key={credit.id}>
                  <TableCell className="font-medium">
                    {credit.members?.first_name} {credit.members?.last_name}
                  </TableCell>
                  <TableCell className="capitalize">
                    {credit.members?.membership_type?.split('_')[0]}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {credit.credit_type?.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{credit.credits_remaining}</TableCell>
                  <TableCell className="text-right">{credit.credits_total}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
