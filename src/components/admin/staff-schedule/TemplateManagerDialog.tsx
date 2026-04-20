import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Trash2, Plus, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { DAYS_OF_WEEK, formatShortTime, type ShiftTemplate } from '@/lib/staffScheduleResolution';
import type { TeamMember } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  weekStart: string; // ISO date for "Generate week of"
  onChanged: () => void;
}

export function TemplateManagerDialog({ open, onOpenChange, members, weekStart, onChanged }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberKey, setMemberKey] = useState<string>('');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [position, setPosition] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_shift_templates' as any)
      .select('*')
      .eq('is_active', true);
    if (!error) setTemplates((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleAdd = async () => {
    const member = members.find((m) => m.key === memberKey);
    if (!member) {
      toast({ title: 'Select a person', variant: 'destructive' });
      return;
    }
    if (endTime <= startTime) {
      toast({ title: 'Invalid times', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('staff_shift_templates' as any).insert({
      user_id: member.user_id,
      person_ref: member.user_id ? null : member.email,
      person_name: member.name,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      position: position.trim() || null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Template added' });
    setPosition('');
    load();
    onChanged();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('staff_shift_templates' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    load();
    onChanged();
  };

  const handleGenerate = async () => {
    const { data, error } = await supabase.rpc('generate_shifts_from_templates' as any, {
      week_start: weekStart,
    });
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    const row = (data as any)?.[0];
    toast({
      title: 'Shifts generated',
      description: `${row?.inserted_count ?? 0} added, ${row?.skipped_count ?? 0} already existed.`,
    });
    onChanged();
  };

  // Group templates by person
  const memberByKey = new Map(members.map((m) => [m.key, m] as const));
  const templatesByPerson = new Map<string, ShiftTemplate[]>();
  for (const t of templates) {
    const k = t.user_id ?? `ref:${t.person_ref ?? ''}`;
    (templatesByPerson.get(k) ?? templatesByPerson.set(k, []).get(k)!).push(t);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recurring Schedule Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Generate */}
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-medium text-sm">Generate shifts from templates</div>
                <div className="text-xs text-muted-foreground">
                  Materialize recurring templates into editable shifts for week of {weekStart}.
                </div>
              </div>
              <Button onClick={handleGenerate} size="sm">
                <Sparkles className="h-4 w-4 mr-1.5" />
                Generate Week
              </Button>
            </div>
          </Card>

          {/* Add new template */}
          <Card className="p-4 space-y-3">
            <div className="text-sm font-medium">Add Recurring Shift</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Person</Label>
                <Select value={memberKey} onValueChange={setMemberKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
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
                <Label className="text-xs">Day of Week</Label>
                <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.long}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">End</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Position (optional)</Label>
                <Input
                  placeholder="e.g. Front Desk"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Template
            </Button>
          </Card>

          {/* Existing */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Existing Templates</div>
            {loading ? (
              <div className="text-sm text-muted-foreground p-4">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4">No templates yet.</div>
            ) : (
              Array.from(templatesByPerson.entries()).map(([key, ts]) => {
                const m = memberByKey.get(key);
                return (
                  <Card key={key} className="p-3">
                    <div className="font-medium text-sm mb-2">
                      {m?.name ?? ts[0].person_name ?? 'Unknown'}
                    </div>
                    <div className="space-y-1.5">
                      {ts
                        .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                        .map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between gap-2 text-sm bg-muted/30 rounded px-2 py-1.5"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium w-12">
                                {DAYS_OF_WEEK[t.day_of_week]?.short}
                              </span>
                              <span>
                                {formatShortTime(t.start_time)}–{formatShortTime(t.end_time)}
                              </span>
                              {t.position && (
                                <span className="text-muted-foreground">· {t.position}</span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDelete(t.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
