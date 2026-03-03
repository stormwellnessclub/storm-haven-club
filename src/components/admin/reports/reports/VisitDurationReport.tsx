import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Clock, TrendingUp, Calendar } from "lucide-react";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TIER_COLORS: Record<string, string> = {
  diamond: 'hsl(var(--chart-1))',
  platinum: 'hsl(var(--chart-2))',
  gold: 'hsl(var(--chart-3))',
  silver: 'hsl(var(--chart-4))',
  other: 'hsl(var(--chart-5))',
};

const BUCKET_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

export function VisitDurationReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['visit-duration-analysis', dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const { data: checkIns, error: ciErr } = await supabase
        .from('check_ins')
        .select('member_id, checked_in_at, checked_out_at')
        .gte('checked_in_at', startDate)
        .lte('checked_in_at', endDate)
        .not('checked_out_at', 'is', null);
      if (ciErr) throw ciErr;

      const { data: members, error: mErr } = await supabase
        .from('members')
        .select('id, membership_type');
      if (mErr) throw mErr;

      const memberTier: Record<string, string> = {};
      (members || []).forEach(m => {
        const type = m.membership_type?.toLowerCase() || '';
        memberTier[m.id] = ['diamond', 'platinum', 'gold', 'silver'].find(t => type.includes(t)) || 'other';
      });

      // Compute durations
      const durations: { minutes: number; tier: string; dayOfWeek: number }[] = [];
      (checkIns || []).forEach(ci => {
        if (!ci.checked_out_at) return;
        const dur = (new Date(ci.checked_out_at).getTime() - new Date(ci.checked_in_at).getTime()) / 60000;
        if (dur > 0 && dur < 1440) {
          durations.push({
            minutes: dur,
            tier: memberTier[ci.member_id] || 'other',
            dayOfWeek: new Date(ci.checked_in_at).getDay(),
          });
        }
      });

      // By tier
      const tierAgg: Record<string, { total: number; count: number }> = {};
      durations.forEach(d => {
        if (!tierAgg[d.tier]) tierAgg[d.tier] = { total: 0, count: 0 };
        tierAgg[d.tier].total += d.minutes;
        tierAgg[d.tier].count += 1;
      });
      const byTier = Object.entries(tierAgg)
        .map(([tier, v]) => ({ tier, avgMinutes: Math.round(v.total / v.count) }))
        .sort((a, b) => b.avgMinutes - a.avgMinutes);

      // By day of week
      const dayAgg: Record<number, { total: number; count: number }> = {};
      durations.forEach(d => {
        if (!dayAgg[d.dayOfWeek]) dayAgg[d.dayOfWeek] = { total: 0, count: 0 };
        dayAgg[d.dayOfWeek].total += d.minutes;
        dayAgg[d.dayOfWeek].count += 1;
      });
      const byDay = [1, 2, 3, 4, 5, 6, 0].map(dow => ({
        day: DAY_NAMES[dow],
        avgMinutes: dayAgg[dow] ? Math.round(dayAgg[dow].total / dayAgg[dow].count) : 0,
        visits: dayAgg[dow]?.count || 0,
      }));

      // Distribution buckets
      const buckets = [
        { label: '< 30 min', min: 0, max: 30, count: 0 },
        { label: '30–60 min', min: 30, max: 60, count: 0 },
        { label: '1–2 hrs', min: 60, max: 120, count: 0 },
        { label: '2+ hrs', min: 120, max: Infinity, count: 0 },
      ];
      durations.forEach(d => {
        const b = buckets.find(b => d.minutes >= b.min && d.minutes < b.max);
        if (b) b.count += 1;
      });

      const overallAvg = durations.length > 0
        ? durations.reduce((s, d) => s + d.minutes, 0) / durations.length
        : 0;

      const longestTier = byTier[0]?.tier || '—';
      const busiestDay = [...byDay].sort((a, b) => b.visits - a.visits)[0]?.day || '—';

      return { byTier, byDay, buckets, overallAvg, longestTier, busiestDay, totalVisits: durations.length };
    },
  });

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg Visit Duration</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{formatDuration(data?.overallAvg || 0)}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Longest Avg Tier</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /><span className="text-2xl font-bold capitalize">{data?.longestTier}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Busiest Day</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{data?.busiestDay}</span></div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Avg Duration by Tier</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.byTier || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={v => formatDuration(v)} />
                <YAxis dataKey="tier" type="category" width={80} className="capitalize" />
                <Tooltip formatter={(v: number) => [formatDuration(v), 'Avg Duration']} />
                <Bar dataKey="avgMinutes" radius={[0, 4, 4, 0]}>
                  {(data?.byTier || []).map(e => (
                    <Cell key={e.tier} fill={TIER_COLORS[e.tier] || TIER_COLORS.other} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Avg Duration by Day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.byDay || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={v => formatDuration(v)} />
                <Tooltip formatter={(v: number) => [formatDuration(v), 'Avg Duration']} />
                <Bar dataKey="avgMinutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Duration Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={(data?.buckets || []).filter(b => b.count > 0)}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ label, count }) => `${label}: ${count}`}
                >
                  {(data?.buckets || []).filter(b => b.count > 0).map((_, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Based on {data?.totalVisits || 0} visits with checkout times
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
