import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface InstructorPerformanceReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function InstructorPerformanceReport({ dateRange }: InstructorPerformanceReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['instructor-performance', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      // Fetch instructors
      const { data: instructors, error: instructorsError } = await supabase
        .from('instructors')
        .select('id, first_name, last_name, photo_url, specialties')
        .eq('is_active', true);

      if (instructorsError) throw instructorsError;

      // Fetch sessions with enrollment data
      const { data: sessions, error: sessionsError } = await supabase
        .from('class_sessions')
        .select('instructor_id, max_capacity, current_enrollment, is_cancelled')
        .gte('session_date', startDate)
        .lte('session_date', endDate)
        .eq('is_cancelled', false);

      if (sessionsError) throw sessionsError;

      // Calculate stats per instructor
      const instructorStats = (instructors || []).map(instructor => {
        const instructorSessions = (sessions || []).filter(s => s.instructor_id === instructor.id);
        const totalCapacity = instructorSessions.reduce((sum, s) => sum + (s.max_capacity || 0), 0);
        const totalEnrollment = instructorSessions.reduce((sum, s) => sum + (s.current_enrollment || 0), 0);
        const avgAttendance = instructorSessions.length > 0 
          ? Math.round(totalEnrollment / instructorSessions.length * 10) / 10 
          : 0;
        const fillRate = totalCapacity > 0 
          ? Math.round((totalEnrollment / totalCapacity) * 100) 
          : 0;

        return {
          id: instructor.id,
          name: `${instructor.first_name} ${instructor.last_name}`,
          photoUrl: instructor.photo_url,
          specialties: instructor.specialties || [],
          sessions: instructorSessions.length,
          totalEnrollment,
          avgAttendance,
          fillRate,
        };
      }).filter(i => i.sessions > 0).sort((a, b) => b.sessions - a.sessions);

      // Top performers by fill rate
      const topByFillRate = [...instructorStats].sort((a, b) => b.fillRate - a.fillRate).slice(0, 5);

      return {
        instructors: instructorStats,
        topByFillRate,
        totalSessions: sessions?.length || 0,
        activeInstructors: instructorStats.length,
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Instructors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.activeInstructors || 0}</div>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Sessions/Instructor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.activeInstructors && data.activeInstructors > 0 
                ? Math.round((data.totalSessions / data.activeInstructors) * 10) / 10 
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sessions by Instructor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.instructors?.slice(0, 10) || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} className="text-xs" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sessions" name="Sessions" fill="hsl(var(--primary))" />
                <Bar dataKey="avgAttendance" name="Avg Attendance" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Instructors by Fill Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data?.topByFillRate || []).map((instructor, index) => (
                <div key={instructor.id} className="flex items-center gap-4">
                  <span className="text-lg font-bold text-muted-foreground w-6">
                    {index + 1}
                  </span>
                  <Avatar>
                    <AvatarImage src={instructor.photoUrl || undefined} />
                    <AvatarFallback>
                      {instructor.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{instructor.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {instructor.sessions} sessions
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{instructor.fillRate}%</div>
                    <div className="text-sm text-muted-foreground">fill rate</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Instructor Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor</TableHead>
                <TableHead>Specialties</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Total Attendees</TableHead>
                <TableHead className="text-right">Avg Attendance</TableHead>
                <TableHead className="text-right">Fill Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.instructors || []).map(instructor => (
                <TableRow key={instructor.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={instructor.photoUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {instructor.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{instructor.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {instructor.specialties.slice(0, 2).join(', ') || '-'}
                  </TableCell>
                  <TableCell className="text-right">{instructor.sessions}</TableCell>
                  <TableCell className="text-right">{instructor.totalEnrollment}</TableCell>
                  <TableCell className="text-right">{instructor.avgAttendance}</TableCell>
                  <TableCell className="text-right font-bold">{instructor.fillRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
