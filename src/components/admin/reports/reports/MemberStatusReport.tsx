import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'hsl(142, 76%, 36%)',
  pending_activation: 'hsl(45, 93%, 47%)',
  frozen: 'hsl(199, 89%, 48%)',
  cancelled: 'hsl(0, 84%, 60%)',
  past_due: 'hsl(25, 95%, 53%)',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending_activation: 'Pending Activation',
  frozen: 'Frozen',
  cancelled: 'Cancelled',
  past_due: 'Past Due',
};

export function MemberStatusReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-member-status', dateRange, filters],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('membership_applications')
        .select('status, membership_plan, founding_member');

      if (error) throw error;

      const tierFilter = filters.tier as string;
      const filtered = tierFilter && tierFilter !== 'all'
        ? members?.filter(m => m.membership_plan?.toLowerCase().includes(tierFilter.toLowerCase()))
        : members;

      // Group by status
      const statusCounts = (filtered || []).reduce((acc, member) => {
        const status = member.status || 'unknown';
        if (!acc[status]) {
          acc[status] = { status, count: 0, founding: 0, regular: 0 };
        }
        acc[status].count += 1;
        if (member.founding_member) {
          acc[status].founding += 1;
        } else {
          acc[status].regular += 1;
        }
        return acc;
      }, {} as Record<string, { status: string; count: number; founding: number; regular: number }>);

      const chartData = Object.values(statusCounts).map(s => ({
        name: STATUS_LABELS[s.status] || s.status,
        value: s.count,
        color: STATUS_COLORS[s.status] || 'hsl(var(--muted))',
      }));

      const total = Object.values(statusCounts).reduce((sum, s) => sum + s.count, 0);

      return { statusCounts: Object.values(statusCounts), chartData, total };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
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

        {/* Summary */}
        <div className="flex items-center justify-center">
          <div className="text-center">
            <p className="text-6xl font-bold text-primary">{data?.total || 0}</p>
            <p className="text-lg text-muted-foreground mt-2">Total Members</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="text-right">Founding</TableHead>
            <TableHead className="text-right">Regular</TableHead>
            <TableHead className="text-right">% of Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.statusCounts.map((row) => (
            <TableRow key={row.status}>
              <TableCell>
                <Badge 
                  variant="outline" 
                  style={{ borderColor: STATUS_COLORS[row.status], color: STATUS_COLORS[row.status] }}
                >
                  {STATUS_LABELS[row.status] || row.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-semibold">{row.count}</TableCell>
              <TableCell className="text-right">{row.founding}</TableCell>
              <TableCell className="text-right">{row.regular}</TableCell>
              <TableCell className="text-right">
                {data?.total ? ((row.count / data.total) * 100).toFixed(1) : 0}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
