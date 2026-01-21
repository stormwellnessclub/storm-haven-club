import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function ClassAttendanceReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-class-attendance', dateRange, filters],
    queryFn: async () => {
      // Get class sessions with bookings
      const { data: sessions, error: sessionsError } = await supabase
        .from('class_sessions')
        .select(`
          id,
          session_date,
          start_time,
          max_capacity,
          current_enrollment,
          class_types (name)
        `)
        .gte('session_date', dateRange.start.toISOString().split('T')[0])
        .lte('session_date', dateRange.end.toISOString().split('T')[0]);

      if (sessionsError) throw sessionsError;

      // Get bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('class_bookings')
        .select('session_id, status')
        .in('session_id', (sessions || []).map(s => s.id));

      if (bookingsError) throw bookingsError;

      // Group by class type
      const classStats = (sessions || []).reduce((acc, session) => {
        const className = session.class_types?.name || 'Unknown';
        const sessionBookings = (bookings || []).filter(b => b.session_id === session.id);
        
        if (!acc[className]) {
          acc[className] = { name: className, sessions: 0, totalCapacity: 0, totalBooked: 0, checkedIn: 0 };
        }
        
        acc[className].sessions += 1;
        acc[className].totalCapacity += session.max_capacity || 0;
        acc[className].totalBooked += sessionBookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length;
        acc[className].checkedIn += sessionBookings.filter(b => b.status === 'completed').length;
        
        return acc;
      }, {} as Record<string, { name: string; sessions: number; totalCapacity: number; totalBooked: number; checkedIn: number }>);

      const chartData = Object.values(classStats).map(c => ({
        name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
        fullName: c.name,
        'Booked': c.totalBooked,
        'Checked In': c.checkedIn,
        'Capacity': c.totalCapacity,
      }));

      const totalSessions = Object.values(classStats).reduce((sum, c) => sum + c.sessions, 0);
      const totalBooked = Object.values(classStats).reduce((sum, c) => sum + c.totalBooked, 0);

      return { classStats: Object.values(classStats), chartData, totalSessions, totalBooked };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={80} />
            <YAxis className="text-xs" />
            <Tooltip />
            <Legend />
            <Bar dataKey="Booked" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Checked In" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Class Type</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Total Booked</TableHead>
            <TableHead className="text-right">Checked In</TableHead>
            <TableHead className="text-right">Capacity</TableHead>
            <TableHead className="text-right">Utilization</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.classStats
            .sort((a, b) => b.totalBooked - a.totalBooked)
            .map((row) => {
              const utilization = row.totalCapacity > 0 ? (row.totalBooked / row.totalCapacity) * 100 : 0;
              return (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">{row.sessions}</TableCell>
                  <TableCell className="text-right">{row.totalBooked}</TableCell>
                  <TableCell className="text-right">{row.checkedIn}</TableCell>
                  <TableCell className="text-right">{row.totalCapacity}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={utilization >= 80 ? "default" : utilization >= 50 ? "secondary" : "outline"}>
                      {utilization.toFixed(0)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}
