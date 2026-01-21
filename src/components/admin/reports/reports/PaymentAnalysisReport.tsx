import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function PaymentAnalysisReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-payment-analysis', dateRange, filters],
    queryFn: async () => {
      const { data: attempts, error } = await supabase
        .from('payment_attempts')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      if (error) throw error;

      const statusFilter = filters.status as string;
      const filtered = statusFilter && statusFilter !== 'all'
        ? attempts?.filter(a => a.status === statusFilter)
        : attempts;

      const statusCounts = (filtered || []).reduce((acc, attempt) => {
        const status = attempt.status || 'unknown';
        if (!acc[status]) {
          acc[status] = { status, count: 0, amount: 0 };
        }
        acc[status].count += 1;
        acc[status].amount += Number(attempt.amount) || 0;
        return acc;
      }, {} as Record<string, { status: string; count: number; amount: number }>);

      const total = (filtered || []).length;
      const totalAmount = (filtered || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
      const succeeded = statusCounts['succeeded']?.count || 0;
      const successRate = total > 0 ? (succeeded / total) * 100 : 0;

      const chartData = [
        { name: 'Succeeded', value: statusCounts['succeeded']?.count || 0, color: 'hsl(142, 76%, 36%)' },
        { name: 'Failed', value: statusCounts['failed']?.count || 0, color: 'hsl(0, 84%, 60%)' },
        { name: 'Pending', value: statusCounts['pending']?.count || 0, color: 'hsl(45, 93%, 47%)' },
      ].filter(d => d.value > 0);

      // Decline reasons
      const declineReasons = (attempts || [])
        .filter(a => a.status === 'failed' && a.decline_reason)
        .reduce((acc, a) => {
          const reason = a.decline_reason || 'Unknown';
          acc[reason] = (acc[reason] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      return { statusCounts, chartData, total, totalAmount, successRate, declineReasons };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Attempts</p>
                <p className="text-2xl font-bold">{data?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{data?.successRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.statusCounts?.['succeeded']?.amount || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.statusCounts?.['failed']?.amount || 0)}</p>
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

        {/* Decline Reasons */}
        <div>
          <h4 className="font-semibold mb-4">Top Decline Reasons</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(data?.declineReasons || {})
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([reason, count]) => (
                  <TableRow key={reason}>
                    <TableCell className="capitalize">{reason.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                  </TableRow>
                ))}
              {Object.keys(data?.declineReasons || {}).length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No decline data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
