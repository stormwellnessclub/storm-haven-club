import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Layers, PlaneTakeoff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  formatDateLocal,
  getDateRange,
  getWeekStart,
  resolveSchedule,
  type ResolvedShift,
  type Shift,
  type ShiftTemplate,
} from '@/lib/staffScheduleResolution';
import { useTeamMembers } from '@/components/admin/staff-schedule/useTeamMembers';
import { WeekGridView } from '@/components/admin/staff-schedule/WeekGridView';
import { DayTimelineView } from '@/components/admin/staff-schedule/DayTimelineView';
import { ShiftDialog } from '@/components/admin/staff-schedule/ShiftDialog';
import { TemplateManagerDialog } from '@/components/admin/staff-schedule/TemplateManagerDialog';
import { TimeOffPanel } from '@/components/admin/staff-schedule/TimeOffPanel';
import type { TeamMember } from '@/components/admin/staff-schedule/types';

export default function StaffSchedule() {
  const { members, loading: loadingMembers } = useTeamMembers();
  const [view, setView] = useState<'week' | 'day'>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Dialog state
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftDialogMember, setShiftDialogMember] = useState<TeamMember | null>(null);
  const [shiftDialogDate, setShiftDialogDate] = useState<string | null>(null);
  const [shiftDialogExisting, setShiftDialogExisting] = useState<ResolvedShift | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);

  const dates = useMemo(() => {
    if (view === 'week') {
      const ws = getWeekStart(anchorDate);
      return getDateRange(ws, 7);
    }
    return [formatDateLocal(anchorDate)];
  }, [view, anchorDate]);

  const weekStartIso = useMemo(() => formatDateLocal(getWeekStart(anchorDate)), [anchorDate]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const dateMin = dates[0];
      const dateMax = dates[dates.length - 1];
      const [tplRes, shiftRes] = await Promise.all([
        supabase.from('staff_shift_templates' as any).select('*').eq('is_active', true),
        supabase
          .from('staff_shifts' as any)
          .select('*')
          .gte('shift_date', dateMin)
          .lte('shift_date', dateMax),
      ]);
      setTemplates((tplRes.data as any) ?? []);
      setShifts((shiftRes.data as any) ?? []);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, weekStartIso, dates[0]]);

  const resolved = useMemo(
    () => resolveSchedule(templates, shifts, dates),
    [templates, shifts, dates]
  );

  const goPrev = () => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - (view === 'week' ? 7 : 1));
    setAnchorDate(d);
  };
  const goNext = () => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + (view === 'week' ? 7 : 1));
    setAnchorDate(d);
  };
  const goToday = () => setAnchorDate(new Date());

  const headerLabel = useMemo(() => {
    if (view === 'day') {
      return new Date(dates[0] + 'T12:00:00').toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    const start = new Date(dates[0] + 'T12:00:00');
    const end = new Date(dates[dates.length - 1] + 'T12:00:00');
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} – ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [view, dates]);

  const openAddShift = (member: TeamMember | null, date: string | null) => {
    setShiftDialogMember(member);
    setShiftDialogDate(date);
    setShiftDialogExisting(null);
    setShiftDialogOpen(true);
  };

  const openShift = (shift: ResolvedShift, member: TeamMember) => {
    setShiftDialogMember(member);
    setShiftDialogDate(shift.shift_date);
    setShiftDialogExisting(shift);
    setShiftDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Staff Schedule</h1>
            <p className="text-sm text-muted-foreground">
              Plan shifts for staff, instructors, and therapists.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setTimeOffOpen(true)}>
              <PlaneTakeoff className="h-4 w-4 mr-1.5" /> Time Off
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}>
              <Layers className="h-4 w-4 mr-1.5" /> Manage Templates
            </Button>
            <Button size="sm" onClick={() => openAddShift(null, dates[0])}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Shift
            </Button>
          </div>
        </div>

        <Card className="p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goPrev} aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>
                <CalendarIcon className="h-4 w-4 mr-1.5" /> Today
              </Button>
              <Button variant="outline" size="icon" onClick={goNext} aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-2 font-semibold">{headerLabel}</div>
            </div>
            <Tabs value={view} onValueChange={(v) => setView(v as 'week' | 'day')}>
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="day">Day</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Card>

        {loadingMembers || loadingData ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Loading schedule...</Card>
        ) : view === 'week' ? (
          <WeekGridView
            members={members}
            dates={dates}
            resolved={resolved}
            onCellClick={(m, d) => openAddShift(m, d)}
            onShiftClick={openShift}
          />
        ) : (
          <DayTimelineView
            members={members}
            date={dates[0]}
            resolved={resolved}
            onCellClick={(m, d) => openAddShift(m, d)}
            onShiftClick={openShift}
          />
        )}
      </div>

      <ShiftDialog
        open={shiftDialogOpen}
        onOpenChange={setShiftDialogOpen}
        initialDate={shiftDialogDate}
        initialMember={shiftDialogMember}
        existing={shiftDialogExisting}
        members={members}
        onSaved={fetchData}
      />
      <TemplateManagerDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        members={members}
        weekStart={weekStartIso}
        onChanged={fetchData}
      />
      <TimeOffPanel
        open={timeOffOpen}
        onOpenChange={setTimeOffOpen}
        members={members}
        onChanged={fetchData}
      />
    </AdminLayout>
  );
}
