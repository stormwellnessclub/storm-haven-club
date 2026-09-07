import { useMemo, useState } from 'react';
import { ScheduleShell } from '@/components/schedule/ScheduleShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useScheduleWeek, formatTime, shiftHours, type ScheduleShift } from '@/hooks/useScheduleWeek';
import { DEPARTMENTS, departmentDotStyle, departmentLabel } from '@/lib/schedule/departments';
import { findCoverageGaps } from '@/lib/schedule/coverage';

function detroitToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Detroit' });
}
function detroitNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export default function ScheduleToday() {
  const { toast } = useToast();
  const today = detroitToday();
  const dates = useMemo(() => [today], [today]);
  const { shifts, rules, loading, reload } = useScheduleWeek(dates);
  const [busyId, setBusyId] = useState<string | null>(null);
  const now = detroitNowMinutes();

  const gaps = useMemo(() => findCoverageGaps(rules, shifts, dates), [rules, shifts, dates]);

  const callOff = async (s: ScheduleShift) => {
    setBusyId(s.id);
    try {
      const { error } = await (supabase as any)
        .from('staff_shifts')
        .update({ status: 'cancelled' })
        .eq('id', s.id);
      if (error) throw error;
      toast({ title: 'Marked as called off' });
      reload();
    } catch (e: any) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const scheduled = shifts.filter((s) => s.status === 'scheduled');
  const totalHours = scheduled.reduce((sum, s) => sum + shiftHours(s), 0);

  return (
    <ScheduleShell
      title="Today"
      description={new Date(today + 'T12:00:00').toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Shifts today</div>
          <div className="text-2xl font-bold">{scheduled.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Scheduled hours</div>
          <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Coverage gaps</div>
          <div className={`text-2xl font-bold ${gaps.length ? 'text-destructive' : ''}`}>{gaps.length}</div>
        </Card>
      </div>

      {gaps.length > 0 && (
        <Card className="p-3 border-destructive/50">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm mb-2">
            <AlertTriangle className="h-4 w-4" /> Uncovered blocks
          </div>
          <div className="flex flex-wrap gap-2">
            {gaps.map((g, i) => (
              <Badge key={i} variant="outline" className="text-destructive border-destructive/40">
                {departmentLabel(g.department)} {g.start}–{g.end} ({g.scheduled}/{g.required})
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {DEPARTMENTS.filter((d) => d.id !== 'other' || shifts.some((s) => (s.department ?? 'other') === 'other')).map(
            (dept) => {
              const list = shifts
                .filter((s) => (s.department ?? 'other') === dept.id)
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
              return (
                <Card key={dept.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={departmentDotStyle(dept.id)} />
                    {dept.label}
                  </div>
                  {list.length === 0 && <div className="text-sm text-muted-foreground">Nobody scheduled.</div>}
                  {list.map((s) => {
                    const onNow =
                      s.status === 'scheduled' && toMin(s.start_time) <= now && toMin(s.end_time) > now;
                    const done = toMin(s.end_time) <= now;
                    return (
                      <div key={s.id} className="rounded border p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className={s.status !== 'scheduled' ? 'line-through text-muted-foreground' : ''}>
                            {s.person_name ?? 'Staff'}
                          </span>
                          {s.status === 'cancelled' ? (
                            <Badge variant="destructive">Called off</Badge>
                          ) : s.status === 'pto' ? (
                            <Badge variant="secondary">Time off</Badge>
                          ) : onNow ? (
                            <Badge>On now</Badge>
                          ) : done ? (
                            <Badge variant="outline">Done</Badge>
                          ) : (
                            <Badge variant="outline">Upcoming</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {formatTime(s.start_time)}–{formatTime(s.end_time)}
                        </div>
                        {s.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-1 h-7 px-2 text-xs"
                            disabled={busyId === s.id}
                            onClick={() => callOff(s)}
                          >
                            <UserX className="h-3.5 w-3.5 mr-1" /> Called off
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </Card>
              );
            }
          )}
        </div>
      )}
    </ScheduleShell>
  );
}
