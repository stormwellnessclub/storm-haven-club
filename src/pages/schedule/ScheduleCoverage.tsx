import { useEffect, useState } from 'react';
import { ScheduleShell } from '@/components/schedule/ScheduleShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { DEPARTMENTS, departmentDotStyle, departmentLabel } from '@/lib/schedule/departments';
import type { CoverageRule } from '@/hooks/useScheduleWeek';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ScheduleCoverage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rules, setRules] = useState<CoverageRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    department: 'front_desk',
    days: [1] as number[],
    start_time: '09:00',
    end_time: '17:00',
    min_staff: '1',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('staff_coverage_rules')
      .select('*')
      .order('day_of_week')
      .order('start_time');
    setRules((data ?? []) as CoverageRule[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleDay = (d: number) =>
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));

  const save = async () => {
    if (!form.days.length) {
      toast({ title: 'Pick at least one day', variant: 'destructive' });
      return;
    }
    if (form.end_time <= form.start_time) {
      toast({ title: 'End must be after start', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const rows = form.days.map((d) => ({
        department: form.department,
        day_of_week: d,
        start_time: form.start_time,
        end_time: form.end_time,
        min_staff: Number(form.min_staff) || 1,
        created_by: user?.id ?? null,
      }));
      const { error } = await (supabase as any).from('staff_coverage_rules').insert(rows);
      if (error) throw error;
      toast({ title: 'Coverage rule saved' });
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from('staff_coverage_rules').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    load();
  };

  return (
    <ScheduleShell
      title="Coverage rules"
      description="The minimum number of people each area needs. Gaps show in red on Today and the schedule."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add rule
        </Button>
      }
    >
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading rules…</Card>
      ) : rules.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No rules yet. Add one, for example: Front Desk needs 2 people Monday 9:00–14:00.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {DAYS.map((day, i) => {
            const dayRules = rules.filter((r) => r.day_of_week === i);
            if (!dayRules.length) return null;
            return (
              <Card key={day} className="p-3">
                <div className="font-medium mb-2">{day}</div>
                <div className="space-y-1.5">
                  {dayRules.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={departmentDotStyle(r.department)} />
                        <span>{departmentLabel(r.department)}</span>
                        <span className="text-muted-foreground">
                          {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                        </span>
                        <span className="text-muted-foreground">· {r.min_staff} needed</span>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)} aria-label="Delete rule">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add coverage rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Days</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {DAYS.map((d, i) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={form.days.includes(i) ? 'default' : 'outline'}
                    onClick={() => toggleDay(i)}
                  >
                    {d.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>From</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
              <div>
                <Label>People</Label>
                <Input type="number" min={1} value={form.min_staff} onChange={(e) => setForm({ ...form, min_staff: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScheduleShell>
  );
}
