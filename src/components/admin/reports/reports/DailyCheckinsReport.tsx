import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, Calendar, Clock } from "lucide-react";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function DailyCheckinsReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-daily-checkins', dateRange, filters],
    queryFn: async () => {
      const { data: checkins, error } = await supabase
        .from('check_ins')
        .select('checked_in_at, checked_out_at, member_id')
        .gte('checked_in_at', dateRange.start.toISOString())
        .lte('checked_in_at', dateRange.end.toISOString());

      if (error) throw error;

      // Group by date
      const dailyCounts = (checkins || []).reduce((acc, checkin) => {
        const date = format(parseISO(checkin.checked_in_at), 'yyyy-MM-dd');
        if (!acc[date]) {
          acc[date] = { date, count: 0, uniqueMembers: new Set() };
        }
        acc[date].count += 1;
        acc[date].uniqueMembers.add(checkin.member_id);
        return acc;
      }, {} as Record<string, { date: string; count: number; uniqueMembers: Set<string> }>);

      // Fill in missing dates with zeros
      const allDates = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      const chartData = allDates.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayData = dailyCounts[dateStr];
        return {
          date: format(date, 'MMM d'),
          fullDate: dateStr,
          'Check-ins': dayData?.count || 0,
          'Unique Members': dayData?.uniqueMembers.size || 0,
        };
      });

      const total = (checkins || []).length;
      const uniqueTotal = new Set((checkins || []).map(c => c.member_id)).size;
      const avgPerDay = chartData.length > 0 ? total / chartData.length : 0;

      // Calculate avg visit duration from check-ins with checkout times
      const durationsMinutes = (checkins || [])
        .filter(c => c.checked_out_at)
        .map(c => (new Date(c.checked_out_at!).getTime() - new Date(c.checked_in_at).getTime()) / 60000)
        .filter(d => d > 0 && d < 1440);
      const avgDuration = durationsMinutes.length > 0
        ? durationsMinutes.reduce((s, d) => s + d, 0) / durationsMinutes.length
        : 0;

      return { chartData, dailyCounts: Object.values(dailyCounts), total, uniqueTotal, avgPerDay, avgDuration };
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
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Check-ins</p>
                <p className="text-2xl font-bold">{data?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Unique Members</p>
                <p className="text-2xl font-bold">{data?.uniqueTotal || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg per Day</p>
                <p className="text-2xl font-bold">{data?.avgPerDay.toFixed(1) || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {data?.avgDuration ? `${Math.floor(data.avgDuration / 60)}h ${Math.round(data.avgDuration % 60)}m` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            <Bar dataKey="Check-ins" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Check-ins</TableHead>
            <TableHead className="text-right">Unique Members</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.chartData
            .filter(row => row['Check-ins'] > 0)
            .reverse()
            .slice(0, 14)
            .map((row) => (
              <TableRow key={row.fullDate}>
                <TableCell className="font-medium">{row.date}</TableCell>
                <TableCell className="text-right">{row['Check-ins']}</TableCell>
                <TableCell className="text-right">{row['Unique Members']}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
