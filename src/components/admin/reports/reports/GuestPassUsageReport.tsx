import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, CheckCircle, Clock, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function GuestPassUsageReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-guest-pass-usage', dateRange, filters],
    queryFn: async () => {
      const { data: passes, error } = await supabase
        .from('guest_passes')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      if (error) throw error;

      const statusCounts = (passes || []).reduce((acc, pass) => {
        const status = pass.status || 'unknown';
        if (!acc[status]) {
          acc[status] = 0;
        }
        acc[status] += 1;
        return acc;
      }, {} as Record<string, number>);

      const chartData = [
        { name: 'Pending', value: statusCounts['pending'] || 0, color: 'hsl(45, 93%, 47%)' },
        { name: 'Used', value: statusCounts['used'] || 0, color: 'hsl(142, 76%, 36%)' },
        { name: 'Expired', value: statusCounts['expired'] || 0, color: 'hsl(0, 84%, 60%)' },
      ].filter(d => d.value > 0);

      const total = (passes || []).length;
      const used = statusCounts['used'] || 0;
      const conversionRate = total > 0 ? (used / total) * 100 : 0;

      return { passes, statusCounts, chartData, total, used, conversionRate };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Ticket className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Issued</p>
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
                <p className="text-sm text-muted-foreground">Used</p>
                <p className="text-2xl font-bold">{data?.statusCounts?.['used'] || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{data?.statusCounts?.['pending'] || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold">{data?.statusCounts?.['expired'] || 0}</p>
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

        {/* Conversion Rate */}
        <div className="flex items-center justify-center">
          <div className="text-center">
            <p className="text-6xl font-bold text-primary">{data?.conversionRate.toFixed(1)}%</p>
            <p className="text-lg text-muted-foreground mt-2">Conversion Rate</p>
            <p className="text-sm text-muted-foreground">Passes used out of total issued</p>
          </div>
        </div>
      </div>

      {/* Recent Passes Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>Expires</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.passes?.slice(0, 10).map((pass) => (
            <TableRow key={pass.id}>
              <TableCell className="font-medium">{pass.guest_name}</TableCell>
              <TableCell>{pass.guest_email}</TableCell>
              <TableCell className="capitalize">{pass.status}</TableCell>
              <TableCell>{format(parseISO(pass.created_at), 'MMM d, yyyy')}</TableCell>
              <TableCell>{pass.expires_at ? format(parseISO(pass.expires_at), 'MMM d, yyyy') : '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
