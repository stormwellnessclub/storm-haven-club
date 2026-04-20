import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { TeamMember } from './types';
import type { ResolvedShift } from '@/lib/staffScheduleResolution';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: string | null;
  initialMember: TeamMember | null;
  existing?: ResolvedShift | null;
  members: TeamMember[];
  onSaved: () => void;
}

export function ShiftDialog({
  open,
  onOpenChange,
  initialDate,
  initialMember,
  existing,
  members,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [memberKey, setMemberKey] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'scheduled' | 'pto' | 'cancelled' | 'swapped'>('scheduled');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMemberKey(initialMember?.key ?? '');
    setDate(existing?.shift_date ?? initialDate ?? '');
    setStartTime((existing?.start_time ?? '09:00:00').slice(0, 5));
    setEndTime((existing?.end_time ?? '17:00:00').slice(0, 5));
    setPosition(existing?.position ?? '');
    setNotes(existing?.notes ?? '');
    setStatus(existing?.status ?? 'scheduled');
  }, [open, initialDate, initialMember, existing]);

  const isEdit = !!existing && existing.source === 'shift';

  const handleSave = async () => {
    const member = members.find((m) => m.key === memberKey);
    if (!member || !date) {
      toast({ title: 'Missing info', description: 'Select a person and date.', variant: 'destructive' });
      return;
    }
    if (endTime <= startTime) {
      toast({ title: 'Invalid times', description: 'End must be after start.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        user_id: member.user_id,
        person_ref: member.user_id ? null : member.email,
        person_name: member.name,
        shift_date: date,
        start_time: startTime,
        end_time: endTime,
        position: position.trim() || null,
        notes: notes.trim() || null,
        status,
      };

      if (isEdit && existing?.shiftId) {
        const { error } = await supabase
          .from('staff_shifts' as any)
          .update(payload)
          .eq('id', existing.shiftId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        if (existing?.source === 'template' && existing.templateId) {
          payload.template_id = existing.templateId;
        }
        const { error } = await supabase.from('staff_shifts' as any).insert(payload);
        if (error) throw error;
      }
      toast({ title: 'Shift saved' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !existing?.shiftId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('staff_shifts' as any)
        .delete()
        .eq('id', existing.shiftId);
      if (error) throw error;
      toast({ title: 'Shift deleted' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Person</Label>
            <Select value={memberKey} onValueChange={setMemberKey}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {members.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.name} <span className="text-muted-foreground ml-1">({m.group})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Position (optional)</Label>
            <Input
              placeholder="e.g. Front Desk, Closer"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="pto">PTO / Off</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="swapped">Swapped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="e.g. Opening, Cover for Sarah"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
