import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, differenceInMonths, startOfMonth } from "date-fns";
import { useState, useMemo } from "react";
import { ArrowUpDown, Users, Clock, TrendingUp, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

type SortKey = 'name' | 'tier' | 'lifetime' | 'thisMonth' | 'avgPerMonth' | 'avgDuration' | 'lastVisit' | 'daysSince';
type SortDir = 'asc' | 'desc';

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

export function MemberAttendanceOverviewReport({ dateRange, filters }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('lifetime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['member-attendance-overview', filters.tier, filters.status],
    queryFn: async () => {
      // Fetch all active members
      const { data: members, error: mErr } = await supabase
        .from('members')
        .select('id, first_name, last_name, membership_type, status, membership_start_date');
      if (mErr) throw mErr;

      // Fetch ALL check-ins (lifetime)
      const { data: allCheckIns, error: ciErr } = await supabase
        .from('check_ins')
        .select('member_id, checked_in_at, checked_out_at');
      if (ciErr) throw ciErr;

      const now = new Date();
      const monthStart = startOfMonth(now);

      // Build per-member stats
      const checkInsByMember: Record<string, {
        lifetime: number;
        thisMonth: number;
        lastVisit: string | null;
        totalDurationMinutes: number;
        durationCount: number;
      }> = {};

      (allCheckIns || []).forEach(ci => {
        if (!checkInsByMember[ci.member_id]) {
          checkInsByMember[ci.member_id] = {
            lifetime: 0, thisMonth: 0, lastVisit: null,
            totalDurationMinutes: 0, durationCount: 0,
          };
        }
        const s = checkInsByMember[ci.member_id];
        s.lifetime += 1;

        const checkedAt = new Date(ci.checked_in_at);
        if (checkedAt >= monthStart) s.thisMonth += 1;

        if (!s.lastVisit || ci.checked_in_at > s.lastVisit) {
          s.lastVisit = ci.checked_in_at;
        }

        if (ci.checked_out_at) {
          const dur = (new Date(ci.checked_out_at).getTime() - checkedAt.getTime()) / 60000;
          if (dur > 0 && dur < 1440) { // sanity: < 24hrs
            s.totalDurationMinutes += dur;
            s.durationCount += 1;
          }
        }
      });

      const memberRows = (members || [])
        .map(m => {
          const type = m.membership_type?.toLowerCase() || '';
          const tier = ['diamond', 'platinum', 'gold', 'silver'].find(t => type.includes(t)) || 'other';
          if (filters.tier && filters.tier !== 'all' && tier !== filters.tier) return null;
          if (filters.status && filters.status !== 'all' && m.status !== filters.status) return null;

          const stats = checkInsByMember[m.id];
          const lifetime = stats?.lifetime || 0;
          const thisMonth = stats?.thisMonth || 0;

          const monthsSinceStart = m.membership_start_date
            ? Math.max(differenceInMonths(now, new Date(m.membership_start_date)), 1)
            : 1;
          const avgPerMonth = Math.round((lifetime / monthsSinceStart) * 10) / 10;

          const avgDuration = stats && stats.durationCount > 0
            ? stats.totalDurationMinutes / stats.durationCount
            : 0;

          const lastVisit = stats?.lastVisit || null;
          const daysSince = lastVisit ? differenceInDays(now, new Date(lastVisit)) : 999;

          return {
            id: m.id,
            name: `${m.first_name} ${m.last_name}`,
            tier,
            status: m.status,
            lifetime,
            thisMonth,
            avgPerMonth,
            avgDuration,
            lastVisit,
            daysSince,
          };
        })
        .filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.map>[number]>[];

      return memberRows as Array<{
        id: string; name: string; tier: string; status: string;
        lifetime: number; thisMonth: number; avgPerMonth: number;
        avgDuration: number; lastVisit: string | null; daysSince: number;
      }>;
    },
  });

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'tier': cmp = a.tier.localeCompare(b.tier); break;
        default: cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  const totalLifetime = data?.reduce((s, m) => s + m.lifetime, 0) || 0;
  const avgDurationAll = data && data.length > 0
    ? data.reduce((s, m) => s + m.avgDuration, 0) / data.filter(m => m.avgDuration > 0).length
    : 0;
  const activeCount = data?.filter(m => m.daysSince <= 30).length || 0;

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent"
      onClick={() => toggleSort(field)}>
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{data?.length || 0}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Lifetime Check-ins</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{totalLifetime.toLocaleString()}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg Visit Duration</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{formatDuration(avgDurationAll || 0)}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active (30d)</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{activeCount}</span></div></CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-auto max-h-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortHeader label="Member" field="name" /></TableHead>
              <TableHead><SortHeader label="Tier" field="tier" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Lifetime" field="lifetime" /></TableHead>
              <TableHead className="text-right"><SortHeader label="This Month" field="thisMonth" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Avg/Month" field="avgPerMonth" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Avg Duration" field="avgDuration" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Last Visit" field="lastVisit" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Days Since" field="daysSince" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.slice(0, 100).map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="capitalize">{m.tier}</TableCell>
                <TableCell className="text-right font-bold">{m.lifetime}</TableCell>
                <TableCell className="text-right">{m.thisMonth}</TableCell>
                <TableCell className="text-right">{m.avgPerMonth}</TableCell>
                <TableCell className="text-right">{formatDuration(m.avgDuration)}</TableCell>
                <TableCell className="text-right">{m.lastVisit ? format(new Date(m.lastVisit), 'MMM d, yyyy') : '—'}</TableCell>
                <TableCell className="text-right">
                  <span className={m.daysSince > 30 ? 'text-destructive font-medium' : ''}>
                    {m.daysSince === 999 ? 'Never' : m.daysSince}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {sorted.length > 100 && (
        <p className="text-sm text-muted-foreground text-center">Showing top 100 of {sorted.length} members</p>
      )}
    </div>
  );
}
