import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ClassUtilizationReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function ClassUtilizationReport({ dateRange }: ClassUtilizationReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['class-utilization', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      // Fetch sessions with class types and bookings
      const { data: sessions, error } = await supabase
        .from('class_sessions')
        .select(`
          id,
          session_date,
          max_capacity,
          current_enrollment,
          is_cancelled,
          class_types!inner(name, category)
        `)
        .gte('session_date', startDate)
        .lte('session_date', endDate)
        .eq('is_cancelled', false);

      if (error) throw error;

      // Calculate utilization by class type
      const classStats: Record<string, {
        name: string;
        category: string;
        sessions: number;
        totalCapacity: number;
        totalEnrollment: number;
        utilizationRate: number;
      }> = {};

      (sessions || []).forEach(session => {
        const className = session.class_types?.name || 'Unknown';
        const category = session.class_types?.category || 'other';

        if (!classStats[className]) {
          classStats[className] = {
            name: className,
            category,
            sessions: 0,
            totalCapacity: 0,
            totalEnrollment: 0,
            utilizationRate: 0,
          };
        }

        classStats[className].sessions += 1;
        classStats[className].totalCapacity += session.max_capacity || 0;
        classStats[className].totalEnrollment += session.current_enrollment || 0;
      });

      // Calculate utilization rates
      Object.values(classStats).forEach(stat => {
        stat.utilizationRate = stat.totalCapacity > 0 
          ? Math.round((stat.totalEnrollment / stat.totalCapacity) * 100) 
          : 0;
      });

      const sortedClasses = Object.values(classStats).sort((a, b) => b.utilizationRate - a.utilizationRate);

      // Overall stats
      const totalCapacity = sortedClasses.reduce((sum, c) => sum + c.totalCapacity, 0);
      const totalEnrollment = sortedClasses.reduce((sum, c) => sum + c.totalEnrollment, 0);

      return {
        classes: sortedClasses,
        overallUtilization: totalCapacity > 0 ? Math.round((totalEnrollment / totalCapacity) * 100) : 0,
        totalSessions: sessions?.length || 0,
        totalCapacity,
        totalEnrollment,
        underperforming: sortedClasses.filter(c => c.utilizationRate < 50),
        popular: sortedClasses.filter(c => c.utilizationRate >= 80),
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  const getUtilizationColor = (rate: number) => {
    if (rate >= 80) return 'hsl(var(--chart-2))';
    if (rate >= 50) return 'hsl(var(--primary))';
    return 'hsl(var(--destructive))';
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.overallUtilization || 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalSessions || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Popular Classes (80%+)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data?.popular?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Underperforming (&lt;50%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data?.underperforming?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilization by Class</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(300, (data?.classes?.length || 0) * 35)}>
            <BarChart data={data?.classes || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="name" type="category" width={150} className="text-xs" />
              <Tooltip 
                formatter={(value: number) => [`${value}%`, 'Utilization']}
                labelFormatter={(label) => `Class: ${label}`}
              />
              <Bar dataKey="utilizationRate" radius={[0, 4, 4, 0]}>
                {(data?.classes || []).map((entry) => (
                  <Cell key={entry.name} fill={getUtilizationColor(entry.utilizationRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead className="text-right">Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.classes || []).map(cls => (
                <TableRow key={cls.name}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell className="capitalize">{cls.category}</TableCell>
                  <TableCell className="text-right">{cls.sessions}</TableCell>
                  <TableCell className="text-right">{cls.totalCapacity}</TableCell>
                  <TableCell className="text-right">{cls.totalEnrollment}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={cls.utilizationRate >= 80 ? 'default' : cls.utilizationRate >= 50 ? 'secondary' : 'destructive'}>
                      {cls.utilizationRate}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
