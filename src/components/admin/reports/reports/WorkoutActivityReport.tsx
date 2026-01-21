import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfDay, eachDayOfInterval } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface WorkoutActivityReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function WorkoutActivityReport({ dateRange }: WorkoutActivityReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['workout-activity', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      // Fetch workout logs with member info
      const { data: workouts, error } = await supabase
        .from('workout_logs')
        .select(`
          id,
          workout_type,
          duration_minutes,
          calories_burned,
          logged_at,
          member_id,
          members!workout_logs_member_id_fkey(first_name, last_name)
        `)
        .gte('logged_at', startDate)
        .lte('logged_at', endDate);

      if (error) throw error;

      // Workouts by type
      const workoutTypes: Record<string, number> = {};
      (workouts || []).forEach(w => {
        const type = w.workout_type || 'Other';
        workoutTypes[type] = (workoutTypes[type] || 0) + 1;
      });

      const typeData = Object.entries(workoutTypes)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Daily workout trend
      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      const dailyData = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayWorkouts = (workouts || []).filter(w => 
          format(parseISO(w.logged_at), 'yyyy-MM-dd') === dayStr
        );
        return {
          date: format(day, 'MMM d'),
          workouts: dayWorkouts.length,
          totalMinutes: dayWorkouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0),
          calories: dayWorkouts.reduce((sum, w) => sum + (w.calories_burned || 0), 0),
        };
      });

      // Top active members
      const memberActivity: Record<string, { name: string; workouts: number; minutes: number; calories: number }> = {};
      (workouts || []).forEach(w => {
        if (!w.member_id) return;
        const name = w.members ? `${w.members.first_name} ${w.members.last_name}` : 'Unknown';
        if (!memberActivity[w.member_id]) {
          memberActivity[w.member_id] = { name, workouts: 0, minutes: 0, calories: 0 };
        }
        memberActivity[w.member_id].workouts++;
        memberActivity[w.member_id].minutes += w.duration_minutes || 0;
        memberActivity[w.member_id].calories += w.calories_burned || 0;
      });

      const topMembers = Object.entries(memberActivity)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.workouts - a.workouts)
        .slice(0, 10);

      const totalMinutes = (workouts || []).reduce((sum, w) => sum + (w.duration_minutes || 0), 0);
      const totalCalories = (workouts || []).reduce((sum, w) => sum + (w.calories_burned || 0), 0);

      return {
        typeData,
        dailyData,
        topMembers,
        totalWorkouts: workouts?.length || 0,
        totalMinutes,
        totalCalories,
        avgDuration: workouts?.length ? Math.round(totalMinutes / workouts.length) : 0,
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Workouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalWorkouts || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Minutes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalMinutes?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.avgDuration || 0} min</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Calories Burned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalCalories?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workouts by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data?.typeData || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ type, percent }) => `${type} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(data?.typeData || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'Workouts']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Workout Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.dailyData || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="workouts" name="Workouts" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Most Active Members</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.topMembers?.length || 0) === 0 ? (
            <p className="text-muted-foreground text-center py-8">No workout data available</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Workouts</TableHead>
                  <TableHead className="text-right">Total Minutes</TableHead>
                  <TableHead className="text-right">Calories</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.topMembers || []).map((member, index) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-bold">{index + 1}</TableCell>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-right">{member.workouts}</TableCell>
                    <TableCell className="text-right">{member.minutes}</TableCell>
                    <TableCell className="text-right">{member.calories.toLocaleString()}</TableCell>
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
