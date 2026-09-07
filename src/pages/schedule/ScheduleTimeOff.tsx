import { useEffect, useState } from 'react';
import { ScheduleShell } from '@/components/schedule/ScheduleShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useScheduleTeam, personRefFor, userIdFor } from '@/hooks/useScheduleTeam';

interface Request {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
}

interface PtoDay {
  id: string;
  person_name: string | null;
  shift_date: string;
  notes: string | null;
}

function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (d <= last) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function ScheduleTimeOff() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { people } = useScheduleTeam(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [days, setDays] = useState<PtoDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ personKey: '', start: '', end: '', reason: '' });

  const load = async () => {
    setLoading(true);
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Detroit' });
    const [reqRes, ptoRes] = await Promise.all([
      (supabase as any)
        .from('staff_time_off_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      (supabase as any)
        .from('staff_shifts')
        .select('id, person_name, shift_date, notes')
        .eq('status', 'pto')
        .gte('shift_date', todayIso)
        .order('shift_date'),
    ]);
    setRequests((reqRes.data ?? []) as Request[]);
    setDays((ptoRes.data ?? []) as PtoDay[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addDaysOff = async () => {
    const person = people.find((p) => p.key === form.personKey);
    if (!person || !form.start) {
      toast({ title: 'Pick a person and a start date', variant: 'destructive' });
      return;
    }
    const end = form.end || form.start;
    setSaving(true);
    try {
      const rows = datesBetween(form.start, end).map((d) => ({
        user_id: userIdFor(person.key),
        person_ref: personRefFor(person.key),
        person_name: person.name,
        shift_date: d,
        start_time: '00:00',
        end_time: '23:59',
        status: 'pto',
        notes: form.reason.trim() || null,
        created_by: user?.id ?? null,
      }));
      const { error } = await (supabase as any).from('staff_shifts').insert(rows);
      if (error) throw error;
      toast({ title: 'Time off added' });
      setOpen(false);
      setForm({ personKey: '', start: '', end: '', reason: '' });
      load();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const review = async (r: Request, status: 'approved' | 'denied') => {
    const { error } = await (supabase as any)
      .from('staff_time_off_requests')
      .update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq('id', r.id);
    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
      return;
    }
    if (status === 'approved') {
      const person = people.find((p) => p.user_id === r.user_id);
      const rows = datesBetween(r.start_date, r.end_date).map((d) => ({
        user_id: r.user_id,
        person_name: person?.name ?? null,
        shift_date: d,
        start_time: '00:00',
        end_time: '23:59',
        status: 'pto',
        notes: r.reason,
        created_by: user?.id ?? null,
      }));
      await (supabase as any).from('staff_shifts').insert(rows);
    }
    toast({ title: status === 'approved' ? 'Approved' : 'Denied' });
    load();
  };

  const removeDay = async (id: string) => {
    const { error } = await (supabase as any).from('staff_shifts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not remove', description: error.message, variant: 'destructive' });
      return;
    }
    load();
  };

  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <ScheduleShell
      title="Time off"
      description="Approve requests and block out days so nobody gets scheduled."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add time off
        </Button>
      }
    >
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : (
        <>
          <Card className="p-3">
            <div className="font-medium text-sm mb-2">Requests {pending.length > 0 && <Badge className="ml-1">{pending.length} pending</Badge>}</div>
            {requests.length === 0 ? (
              <div className="text-sm text-muted-foreground">No requests.</div>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => {
                  const person = people.find((p) => p.user_id === r.user_id);
                  return (
                    <div key={r.id} className="flex items-start justify-between gap-3 rounded border p-2">
                      <div>
                        <div className="text-sm font-medium">{person?.name ?? 'Staff member'}</div>
                        <div className="text-xs text-muted-foreground">{r.start_date} → {r.end_date}</div>
                        {r.reason && <div className="text-sm mt-0.5">{r.reason}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === 'approved' ? 'default' : r.status === 'denied' ? 'destructive' : 'secondary'}>
                          {r.status}
                        </Badge>
                        {r.status === 'pending' && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => review(r, 'approved')} aria-label="Approve">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => review(r, 'denied')} aria-label="Deny">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-3">
            <div className="font-medium text-sm mb-2">Upcoming days off</div>
            {days.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nothing booked.</div>
            ) : (
              <div className="space-y-1.5">
                {days.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 text-sm rounded border p-2">
                    <div>
                      <span className="font-medium">{d.person_name ?? 'Staff'}</span>{' '}
                      <span className="text-muted-foreground">
                        {new Date(d.shift_date + 'T12:00:00').toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {d.notes && <span className="text-muted-foreground"> · {d.notes}</span>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeDay(d.id)} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add time off</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Person</Label>
              <Select value={form.personKey} onValueChange={(v) => setForm({ ...form, personKey: v })}>
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
                <Label>From</Label>
                <Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={addDaysOff} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScheduleShell>
  );
}
