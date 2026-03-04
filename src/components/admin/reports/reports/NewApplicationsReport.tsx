import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, eachDayOfInterval, addDays, differenceInDays } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserCheck, TrendingUp, Target } from "lucide-react";

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
  const [memberGoal, setMemberGoal] = useState(500);

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

      // Conversion funnel
      const totalApps = filtered.length;
      const approved = filtered.filter(a => ['approved', 'active', 'pending_activation'].includes(a.status)).length;
      const activated = filtered.filter(a => a.status === 'active').length;
      const conversionRate = totalApps > 0 ? (activated / totalApps) * 100 : 0;

      // Group by date for daily apps
      const dailyCounts = filtered.reduce((acc, app) => {
        const date = format(parseISO(app.created_at), 'yyyy-MM-dd');
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Cumulative approved count by date
      const approvedApps = filtered.filter(a => ['approved', 'active', 'pending_activation'].includes(a.status));
      const approvedCounts = approvedApps.reduce((acc, app) => {
        const date = format(parseISO(app.created_at), 'yyyy-MM-dd');
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Fill in missing dates
      const allDates = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      let cumulative = 0;
      const chartData = allDates.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        cumulative += approvedCounts[dateStr] || 0;
        return {
          date: format(date, 'MMM d'),
          fullDate: dateStr,
          Applications: dailyCounts[dateStr] || 0,
          'Cumulative Approved': cumulative,
        };
      });

      // Get current total active members for goal projection
      const { count: currentMembers } = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      // Calculate application rate (apps per day) and conversion rate for projection
      const periodDays = Math.max(differenceInDays(dateRange.end, dateRange.start), 1);
      const appsPerDay = totalApps / periodDays;
      const dailyConversions = (appsPerDay * conversionRate) / 100;

      return {
        applications: filtered,
        chartData,
        total: totalApps,
        approved,
        activated,
        conversionRate,
        currentMembers: currentMembers || 0,
        appsPerDay,
        dailyConversions,
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Goal projection calculation
  const membersNeeded = Math.max(memberGoal - (data?.currentMembers || 0), 0);
  const daysToGoal = data?.dailyConversions && data.dailyConversions > 0
    ? Math.ceil(membersNeeded / data.dailyConversions)
    : null;
  const projectedDate = daysToGoal ? addDays(new Date(), daysToGoal) : null;

  return (
    <div className="space-y-6">
      {/* Conversion Funnel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Applications</p>
                <p className="text-2xl font-bold">{data?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{data?.approved || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Activated</p>
                <p className="text-2xl font-bold">{data?.activated || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{data?.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Projection */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Membership Goal Projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="goal">Target Members:</Label>
              <Input
                id="goal"
                type="number"
                value={memberGoal}
                onChange={(e) => setMemberGoal(Number(e.target.value) || 0)}
                className="w-24"
              />
            </div>
            <div className="flex-1 text-sm space-y-1">
              <p>Current active members: <strong>{data?.currentMembers}</strong></p>
              <p>Application rate: <strong>{data?.appsPerDay.toFixed(1)} apps/day</strong></p>
              <p>New members/day (at {data?.conversionRate.toFixed(0)}% conversion): <strong>{data?.dailyConversions.toFixed(2)}/day</strong></p>
            </div>
            <div className="text-center md:text-right">
              {projectedDate ? (
                <>
                  <p className="text-3xl font-bold text-primary">{format(projectedDate, 'MMM d, yyyy')}</p>
                  <p className="text-sm text-muted-foreground">~{daysToGoal} days from now</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {membersNeeded === 0 ? '🎉 Goal already reached!' : 'Not enough data to project'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data?.chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis yAxisId="left" className="text-xs" allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" className="text-xs" allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="Applications"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))' }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Cumulative Approved"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              strokeDasharray="5 5"
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
