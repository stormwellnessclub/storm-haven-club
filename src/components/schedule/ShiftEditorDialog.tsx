import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { DEPARTMENTS } from '@/lib/schedule/departments';
import type { SchedulePerson } from '@/hooks/useScheduleTeam';
import { personRefFor, userIdFor } from '@/hooks/useScheduleTeam';
import type { ScheduleShift } from '@/hooks/useScheduleWeek';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: SchedulePerson[];
  initialPersonKey?: string | null;
  initialDate?: string | null;
  existing?: ScheduleShift | null;
  onSaved: () => void;
}

export function ShiftEditorDialog({
  open,
  onOpenChange,
  people,
  initialPersonKey,
  initialDate,
  existing,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [personKey, setPersonKey] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [department, setDepartment] = useState('front_desk');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ScheduleShift['status']>('scheduled');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const key = existing ? (existing.user_id ?? `ref:${existing.person_ref ?? ''}`) : initialPersonKey ?? '';
    setPersonKey(key);
    setDate(existing?.shift_date ?? initialDate ?? '');
    setStart((existing?.start_time ?? '09:00:00').slice(0, 5));
    setEnd((existing?.end_time ?? '17:00:00').slice(0, 5));
    const person = people.find((p) => p.key === key);
    setDepartment(existing?.department ?? person?.departments[0] ?? 'front_desk');
    setBreakMinutes(String(existing?.break_minutes ?? 0));
    setNotes(existing?.notes ?? '');
    setStatus(existing?.status ?? 'scheduled');
  }, [open, existing, initialDate, initialPersonKey, people]);

  const person = people.find((p) => p.key === personKey);
  const dow = date ? new Date(date + 'T12:00:00').getDay() : null;
  const availability = dow !== null ? person?.availability?.[String(dow)] : null;
  const outsideAvailability =
    !!availability && (start < availability.start || end > availability.end);
  const notAvailableDay =
    !!person && Object.keys(person.availability ?? {}).length > 0 && dow !== null && !availability;

  const save = async () => {
    if (!person || !date) {
      toast({ title: 'Missing info', description: 'Pick a person and a date.', variant: 'destructive' });
      return;
    }
    if (end <= start) {
      toast({ title: 'Check the times', description: 'End time must be after the start time.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        user_id: userIdFor(person.key),
        person_ref: personRefFor(person.key),
        person_name: person.name,
        shift_date: date,
        start_time: start,
        end_time: end,
        department,
        position: department,
        break_minutes: Number(breakMinutes) || 0,
        notes: notes.trim() || null,
        status,
      };
      if (existing?.id) {
        const { error } = await (supabase as any).from('staff_shifts').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        const { error } = await (supabase as any).from('staff_shifts').insert(payload);
        if (error) throw error;
      }
      toast({ title: 'Shift saved' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing?.id) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('staff_shifts').delete().eq('id', existing.id);
      if (error) throw error;
      toast({ title: 'Shift removed' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Could not remove', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit shift' : 'Add shift'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label>Person</Label>
            <Select value={personKey} onValueChange={setPersonKey}>
              <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {people.filter((p) => p.is_active).map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div>
              <Label>Break (min)</Label>
              <Input type="number" min={0} step={5} value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
            </div>
          </div>
          {(outsideAvailability || notAvailableDay) && (
            <p className="text-xs text-destructive">
              {notAvailableDay
                ? `${person?.name} is not marked available on this day.`
                : `Outside ${person?.name}'s usual availability (${availability?.start}–${availability?.end}).`}
            </p>
          )}
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ScheduleShift['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="pto">Time off</SelectItem>
                <SelectItem value="cancelled">Cancelled / called off</SelectItem>
                <SelectItem value="swapped">Swapped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {existing && (
            <Button variant="destructive" onClick={remove} disabled={saving}>Delete</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
