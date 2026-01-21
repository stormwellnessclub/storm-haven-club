import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, getDay, getHours } from "date-fns";

interface PeakHoursReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 5); // 5 AM to 8 PM

export function PeakHoursReport({ dateRange }: PeakHoursReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['peak-hours', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const { data: checkIns, error } = await supabase
        .from('check_ins')
        .select('checked_in_at')
        .gte('checked_in_at', startDate)
        .lte('checked_in_at', endDate);

      if (error) throw error;

      // Create heatmap data
      const heatmap: Record<string, Record<number, number>> = {};
      DAYS.forEach(day => {
        heatmap[day] = {};
        HOURS.forEach(hour => {
          heatmap[day][hour] = 0;
        });
      });

      (checkIns || []).forEach(checkIn => {
        const date = parseISO(checkIn.checked_in_at);
        const day = DAYS[getDay(date)];
        const hour = getHours(date);
        
        if (hour >= 5 && hour <= 20) {
          heatmap[day][hour] = (heatmap[day][hour] || 0) + 1;
        }
      });

      // Find max value for color scaling
      let maxCount = 0;
      Object.values(heatmap).forEach(hours => {
        Object.values(hours).forEach(count => {
          if (count > maxCount) maxCount = count;
        });
      });

      // Find peak hour
      let peakDay = '';
      let peakHour = 0;
      let peakCount = 0;
      Object.entries(heatmap).forEach(([day, hours]) => {
        Object.entries(hours).forEach(([hour, count]) => {
          if (count > peakCount) {
            peakDay = day;
            peakHour = Number(hour);
            peakCount = count;
          }
        });
      });

      return {
        heatmap,
        maxCount,
        totalCheckIns: checkIns?.length || 0,
        peakTime: peakCount > 0 ? `${peakDay} at ${peakHour}:00` : 'N/A',
        peakCount,
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  const getColor = (count: number) => {
    if (!data?.maxCount || data.maxCount === 0) return 'bg-muted';
    const intensity = count / data.maxCount;
    if (intensity === 0) return 'bg-muted';
    if (intensity < 0.25) return 'bg-primary/20';
    if (intensity < 0.5) return 'bg-primary/40';
    if (intensity < 0.75) return 'bg-primary/60';
    return 'bg-primary';
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalCheckIns || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Peak Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.peakTime}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Peak Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.peakCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Check-in Heatmap by Day & Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header row with hours */}
              <div className="flex gap-1 mb-1">
                <div className="w-12" />
                {HOURS.map(hour => (
                  <div 
                    key={hour} 
                    className="flex-1 text-center text-xs text-muted-foreground"
                  >
                    {hour}:00
                  </div>
                ))}
              </div>

              {/* Heatmap rows */}
              {DAYS.map(day => (
                <div key={day} className="flex gap-1 mb-1">
                  <div className="w-12 text-sm font-medium flex items-center">
                    {day}
                  </div>
                  {HOURS.map(hour => (
                    <div
                      key={`${day}-${hour}`}
                      className={`flex-1 h-8 rounded ${getColor(data?.heatmap[day]?.[hour] || 0)} flex items-center justify-center text-xs`}
                      title={`${day} ${hour}:00 - ${data?.heatmap[day]?.[hour] || 0} check-ins`}
                    >
                      {(data?.heatmap[day]?.[hour] || 0) > 0 && (
                        <span className="text-primary-foreground font-medium">
                          {data?.heatmap[day]?.[hour]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 text-sm">
                <span className="text-muted-foreground">Less</span>
                <div className="flex gap-1">
                  <div className="w-6 h-6 rounded bg-muted" />
                  <div className="w-6 h-6 rounded bg-primary/20" />
                  <div className="w-6 h-6 rounded bg-primary/40" />
                  <div className="w-6 h-6 rounded bg-primary/60" />
                  <div className="w-6 h-6 rounded bg-primary" />
                </div>
                <span className="text-muted-foreground">More</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
