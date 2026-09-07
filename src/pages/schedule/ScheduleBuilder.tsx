import { useMemo, useState } from 'react';
import { ScheduleShell } from '@/components/schedule/ScheduleShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, CopyPlus, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useScheduleTeam } from '@/hooks/useScheduleTeam';
import { useScheduleWeek, personKeyOf, shiftHours, type ScheduleShift } from '@/hooks/useScheduleWeek';
import { ScheduleWeekGrid } from '@/components/schedule/ScheduleWeekGrid';
import { ShiftEditorDialog } from '@/components/schedule/ShiftEditorDialog';
import { DEPARTMENTS, departmentDotStyle, departmentLabel } from '@/lib/schedule/departments';
import { findCoverageGaps } from '@/lib/schedule/coverage';
import { formatDateLocal, getDateRange, getWeekStart } from '@/lib/staffScheduleResolution';

export default function ScheduleBuilder() {
  const { toast } = useToast();
  const [anchor, setAnchor] = useState(new Date());
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleShift | null>(null);
  const [initialPersonKey, setInitialPersonKey] = useState<string | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const weekStart = useMemo(() => getWeekStart(anchor), [anchor]);
  const dates = useMemo(() => getDateRange(weekStart, 7), [weekStart]);
  const { people, loading: loadingTeam } = useScheduleTeam(false);
  const { shifts, rules, loading, reload } = useScheduleWeek(dates);

  const visibleShifts = useMemo(
    () => (deptFilter === 'all' ? shifts : shifts.filter((s) => (s.department ?? 'other') === deptFilter)),
    [shifts, deptFilter]
  );
  const visiblePeople = useMemo(
    () =>
      deptFilter === 'all'
        ? people.filter((p) => p.is_active)
        : people.filter((p) => p.is_active && p.departments.includes(deptFilter)),
    [people, deptFilter]
  );

  const gaps = useMemo(() => findCoverageGaps(rules, shifts, dates), [rules, shifts, dates]);
  const totalHours = visibleShifts
    .filter((s) => s.status === 'scheduled')
    .reduce((sum, s) => sum + shiftHours(s), 0);
  const unpublished = shifts.filter((s) => s.status === 'scheduled' && !s.published_at).length;

  const shift = (days: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + days);
    setAnchor(d);
  };

  const openAdd = (personKey: string | null, date: string | null) => {
    setEditing(null);
    setInitialPersonKey(personKey);
    setInitialDate(date ?? dates[0]);
    setDialogOpen(true);
  };

  const handleDrop = async (shiftId: string, personKey: string, date: string, copy: boolean) => {
    const source = shifts.find((s) => s.id === shiftId);
    if (!source) return;
    const person = people.find((p) => p.key === personKey);
    if (!person) return;
    const target = {
      user_id: personKey.startsWith('ref:') ? null : personKey,
      person_ref: personKey.startsWith('ref:') ? personKey.slice(4) : null,
      person_name: person.name,
      shift_date: date,
    };
    setBusy(true);
    try {
      if (copy) {
        const { error } = await (supabase as any).from('staff_shifts').insert({
          ...target,
          start_time: source.start_time,
          end_time: source.end_time,
          department: source.department,
          position: source.position,
          break_minutes: source.break_minutes,
          notes: source.notes,
          status: 'scheduled',
        });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('staff_shifts').update(target).eq('id', shiftId);
        if (error) throw error;
      }
      reload();
    } catch (e: any) {
      toast({ title: 'Could not move shift', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const copyLastWeek = async () => {
    setBusy(true);
    try {
      const from = new Date(weekStart);
      from.setDate(from.getDate() - 7);
      const { data, error } = await (supabase as any).rpc('copy_schedule_week', {
        p_from_week: formatDateLocal(from),
        p_to_week: formatDateLocal(weekStart),
      });
      if (error) throw error;
      const res = data as any;
      toast({
        title: 'Copied last week',
        description: `${res?.inserted ?? 0} shifts added, ${res?.skipped ?? 0} already there.`,
      });
      reload();
    } catch (e: any) {
      toast({ title: 'Copy failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('publish_schedule_week', {
        p_week_start: formatDateLocal(weekStart),
      });
      if (error) throw error;
      toast({ title: 'Schedule published', description: `${data ?? 0} shifts marked as published.` });
      reload();
    } catch (e: any) {
      toast({ title: 'Publish failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const label = `${new Date(dates[0] + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${new Date(dates[6] + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  return (
    <ScheduleShell
      title="Schedule"
      description="Build the week, then publish it."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={copyLastWeek} disabled={busy}>
            <CopyPlus className="h-4 w-4 mr-1.5" /> Copy last week
          </Button>
          <Button variant="outline" size="sm" onClick={publish} disabled={busy || unpublished === 0}>
            <Send className="h-4 w-4 mr-1.5" /> Publish{unpublished ? ` (${unpublished})` : ''}
          </Button>
          <Button size="sm" onClick={() => openAdd(null, dates[0])}>
            <Plus className="h-4 w-4 mr-1.5" /> Add shift
          </Button>
        </>
      }
    >
      <Card className="p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shift(-7)} aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
              <CalendarDays className="h-4 w-4 mr-1.5" /> This week
            </Button>
            <Button variant="outline" size="icon" onClick={() => shift(7)} aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="ml-2 font-semibold">{label}</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm text-muted-foreground">{totalHours.toFixed(1)} scheduled hours</div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {DEPARTMENTS.map((d) => (
            <span key={d.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={departmentDotStyle(d.id)} />
              {d.label}
            </span>
          ))}
        </div>
      </Card>

      {gaps.length > 0 && (
        <Card className="p-3 border-destructive/50">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm mb-2">
            <AlertTriangle className="h-4 w-4" /> {gaps.length} uncovered block{gaps.length === 1 ? '' : 's'} this week
          </div>
          <div className="flex flex-wrap gap-2">
            {gaps.slice(0, 24).map((g, i) => (
              <Badge key={i} variant="outline" className="text-destructive border-destructive/40">
                {new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })} {g.start}–{g.end} ·{' '}
                {departmentLabel(g.department)} ({g.scheduled}/{g.required})
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {loading || loadingTeam ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading schedule…</Card>
      ) : (
        <ScheduleWeekGrid
          people={visiblePeople}
          dates={dates}
          shifts={visibleShifts}
          onCellClick={(k, d) => openAdd(k, d)}
          onShiftClick={(s) => {
            setEditing(s);
            setInitialPersonKey(personKeyOf(s));
            setInitialDate(s.shift_date);
            setDialogOpen(true);
          }}
          onShiftDrop={handleDrop}
        />
      )}

      <ShiftEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        people={people}
        existing={editing}
        initialPersonKey={initialPersonKey}
        initialDate={initialDate}
        onSaved={reload}
      />
    </ScheduleShell>
  );
}
