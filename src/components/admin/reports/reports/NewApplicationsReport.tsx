import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500',
  pending_activation: 'bg-blue-500',
  active: 'bg-green-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  cancelled: 'bg-gray-500',
};

export function NewApplicationsReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-new-applications', dateRange, filters],
    queryFn: async () => {
      const { data: applications, error } = await supabase
        .from('membership_applications')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      let filtered = applications || [];
      
      const statusFilter = filters.status as string;
      if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(a => a.status === statusFilter);
      }

      const tierFilter = filters.tier as string;
      if (tierFilter && tierFilter !== 'all') {
        filtered = filtered.filter(a => a.membership_plan?.toLowerCase().includes(tierFilter.toLowerCase()));
      }

      // Group by date
      const dailyCounts = filtered.reduce((acc, app) => {
        const date = format(parseISO(app.created_at), 'yyyy-MM-dd');
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Fill in missing dates
      const allDates = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      const chartData = allDates.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return {
          date: format(date, 'MMM d'),
          fullDate: dateStr,
          Applications: dailyCounts[dateStr] || 0,
        };
      });

      return { applications: filtered, chartData, total: filtered.length };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="text-center py-4">
        <p className="text-5xl font-bold text-primary">{data?.total || 0}</p>
        <p className="text-muted-foreground">New Applications</p>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data?.chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" allowDecimals={false} />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="Applications" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Applied</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.applications?.slice(0, 20).map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-medium">
                {app.first_name} {app.last_name}
              </TableCell>
              <TableCell>{app.email}</TableCell>
              <TableCell className="capitalize">{app.membership_plan?.split('_')[0]}</TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={`${STATUS_COLORS[app.status] || 'bg-gray-500'} text-white border-0`}
                >
                  {app.status?.replace(/_/g, ' ')}
                </Badge>
              </TableCell>
              <TableCell>{format(parseISO(app.created_at), 'MMM d, yyyy')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
