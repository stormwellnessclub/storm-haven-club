import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface NoShowReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const COLORS = ['hsl(var(--chart-2))', 'hsl(var(--destructive))', 'hsl(var(--chart-4))'];

export function NoShowReport({ dateRange }: NoShowReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['no-show-report', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      // Fetch bookings with member info
      const { data: bookings, error } = await supabase
        .from('class_bookings')
        .select(`
          id,
          status,
          booked_at,
          cancelled_at,
          cancellation_reason,
          member_id,
          members!class_bookings_member_id_fkey(first_name, last_name)
        `)
        .gte('booked_at', startDate)
        .lte('booked_at', endDate);

      if (error) throw error;

      // Count by status
      const statusCounts = {
        completed: 0,
        no_show: 0,
        cancelled: 0,
        confirmed: 0,
      };

      const memberNoShows: Record<string, { name: string; noShows: number; bookings: number }> = {};

      (bookings || []).forEach(booking => {
        const status = booking.status as keyof typeof statusCounts;
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        }

        if (booking.member_id) {
          const memberName = booking.members 
            ? `${booking.members.first_name} ${booking.members.last_name}`
            : 'Unknown';
          
          if (!memberNoShows[booking.member_id]) {
            memberNoShows[booking.member_id] = { name: memberName, noShows: 0, bookings: 0 };
          }
          memberNoShows[booking.member_id].bookings++;
          if (booking.status === 'no_show') {
            memberNoShows[booking.member_id].noShows++;
          }
        }
      });

      // Cancellation reasons
      const cancellationReasons: Record<string, number> = {};
      (bookings || []).filter(b => b.status === 'cancelled').forEach(booking => {
        const reason = booking.cancellation_reason || 'Not specified';
        cancellationReasons[reason] = (cancellationReasons[reason] || 0) + 1;
      });

      const pieData = [
        { name: 'Attended', value: statusCounts.completed },
        { name: 'No Show', value: statusCounts.no_show },
        { name: 'Cancelled', value: statusCounts.cancelled },
      ].filter(d => d.value > 0);

      const repeatOffenders = Object.entries(memberNoShows)
        .filter(([_, data]) => data.noShows >= 2)
        .map(([id, data]) => ({ id, ...data, rate: Math.round((data.noShows / data.bookings) * 100) }))
        .sort((a, b) => b.noShows - a.noShows)
        .slice(0, 10);

      const totalBookings = bookings?.length || 0;
      const noShowRate = totalBookings > 0 ? Math.round((statusCounts.no_show / totalBookings) * 100) : 0;
      const cancelRate = totalBookings > 0 ? Math.round((statusCounts.cancelled / totalBookings) * 100) : 0;

      return {
        pieData,
        statusCounts,
        repeatOffenders,
        cancellationReasons: Object.entries(cancellationReasons)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        totalBookings,
        noShowRate,
        cancelRate,
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalBookings || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">No-Shows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data?.statusCounts.no_show || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">No-Show Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.noShowRate || 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancellation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.cancelRate || 0}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Booking Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data?.pieData || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(data?.pieData || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'Bookings']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Cancellation Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.cancellationReasons || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" />
                <YAxis dataKey="reason" type="category" width={120} className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Repeat No-Show Offenders</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.repeatOffenders?.length || 0) === 0 ? (
            <p className="text-muted-foreground text-center py-8">No repeat offenders found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">No-Shows</TableHead>
                  <TableHead className="text-right">Total Bookings</TableHead>
                  <TableHead className="text-right">No-Show Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.repeatOffenders || []).map(member => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{member.noShows}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{member.bookings}</TableCell>
                    <TableCell className="text-right font-bold">{member.rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
