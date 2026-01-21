import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface GoalsProgressReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const COLORS = ['hsl(var(--chart-2))', 'hsl(var(--primary))', 'hsl(var(--chart-4))', 'hsl(var(--destructive))'];

export function GoalsProgressReport({ dateRange }: GoalsProgressReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['goals-progress', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      // Fetch goals with member info
      const { data: goals, error } = await supabase
        .from('member_goals')
        .select(`
          id,
          goal_type,
          target_value,
          current_value,
          status,
          start_date,
          target_date,
          member_id,
          members!member_goals_member_id_fkey(first_name, last_name)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      // Count by status
      const statusCounts: Record<string, number> = {
        active: 0,
        completed: 0,
        paused: 0,
        abandoned: 0,
      };

      (goals || []).forEach(goal => {
        const status = goal.status || 'active';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const statusData = Object.entries(statusCounts)
        .map(([status, count]) => ({ status, count }))
        .filter(d => d.count > 0);

      // Goals by type
      const typeData: Record<string, { type: string; total: number; completed: number }> = {};
      (goals || []).forEach(goal => {
        const type = goal.goal_type || 'Other';
        if (!typeData[type]) {
          typeData[type] = { type, total: 0, completed: 0 };
        }
        typeData[type].total++;
        if (goal.status === 'completed') {
          typeData[type].completed++;
        }
      });

      const typeDataArray = Object.values(typeData).sort((a, b) => b.total - a.total);

      // Goals with highest progress
      const goalsWithProgress = (goals || [])
        .filter(g => g.target_value && g.target_value > 0)
        .map(goal => ({
          id: goal.id,
          type: goal.goal_type,
          memberName: goal.members ? `${goal.members.first_name} ${goal.members.last_name}` : 'Unknown',
          target: goal.target_value,
          current: goal.current_value || 0,
          progress: Math.min(100, Math.round(((goal.current_value || 0) / goal.target_value) * 100)),
          status: goal.status,
        }))
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 10);

      const totalGoals = goals?.length || 0;
      const completedGoals = statusCounts.completed || 0;
      const completionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
      const activeGoals = statusCounts.active || 0;

      return {
        statusData,
        typeData: typeDataArray,
        goalsWithProgress,
        totalGoals,
        completedGoals,
        activeGoals,
        completionRate,
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalGoals || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{data?.activeGoals || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data?.completedGoals || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.completionRate || 0}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Goals by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data?.statusData || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, percent }) => `${status} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(data?.statusData || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'Goals']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Goals by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.typeData || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="type" className="text-xs" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" />
                <Bar dataKey="completed" name="Completed" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Goals with Highest Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.goalsWithProgress?.length || 0) === 0 ? (
            <p className="text-muted-foreground text-center py-8">No goals with progress data</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Goal Type</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.goalsWithProgress || []).map(goal => (
                  <TableRow key={goal.id}>
                    <TableCell className="font-medium">{goal.memberName}</TableCell>
                    <TableCell>{goal.type}</TableCell>
                    <TableCell className="w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={goal.progress} className="h-2" />
                        <span className="text-sm font-medium">{goal.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{goal.current}</TableCell>
                    <TableCell className="text-right">{goal.target}</TableCell>
                    <TableCell>
                      <Badge variant={goal.status === 'completed' ? 'default' : goal.status === 'active' ? 'secondary' : 'outline'}>
                        {goal.status}
                      </Badge>
                    </TableCell>
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
