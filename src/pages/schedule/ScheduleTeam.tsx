import { useState } from 'react';
import { ScheduleShell } from '@/components/schedule/ScheduleShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, UserPlus, Archive, ArchiveRestore } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useScheduleTeam, type SchedulePerson } from '@/hooks/useScheduleTeam';
import { DEPARTMENTS, departmentDotStyle, departmentLabel } from '@/lib/schedule/departments';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface FormState {
  name: string;
  email: string;
  phone: string;
  departments: string[];
  rate: string;
  notes: string;
  availability: Record<string, { enabled: boolean; start: string; end: string }>;
}

const emptyAvailability = () =>
  Object.fromEntries(DAYS.map((_, i) => [String(i), { enabled: false, start: '09:00', end: '17:00' }]));

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  phone: '',
  departments: [],
  rate: '',
  notes: '',
  availability: emptyAvailability(),
});

export default function ScheduleTeam() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { roles } = useUserRoles();
  const canSeePay = roles.some((r) => ['super_admin', 'admin', 'manager'].includes(r));
  const { people, candidates, loading, reload } = useScheduleTeam(canSeePay);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchedulePerson | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (p: SchedulePerson) => {
    setEditing(p);
    const av = emptyAvailability();
    Object.entries(p.availability ?? {}).forEach(([d, v]) => {
      if (v) av[d] = { enabled: true, start: v.start, end: v.end };
    });
    setForm({
      name: p.name,
      email: p.email ?? '',
      phone: p.phone ?? '',
      departments: p.departments,
      rate: p.rate != null ? String(p.rate) : '',
      notes: p.notes ?? '',
      availability: av,
    });
    setOpen(true);
  };

  const toggleDept = (id: string) =>
    setForm((f) => ({
      ...f,
      departments: f.departments.includes(id)
        ? f.departments.filter((d) => d !== id)
        : [...f.departments, id],
    }));

  const savePayRate = async (personKey: string, rate: string) => {
    if (!canSeePay || rate.trim() === '') return;
    await (supabase as any)
      .from('staff_pay_rates')
      .upsert(
        { person_key: personKey, hourly_rate: Number(rate) || 0, created_by: user?.id ?? null },
        { onConflict: 'person_key' }
      );
  };

  const availabilityPayload = () =>
    Object.fromEntries(
      Object.entries(form.availability)
        .filter(([, v]) => v.enabled)
        .map(([d, v]) => [d, { start: v.start, end: v.end }])
    );

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any)
          .from('staff_schedule_profiles')
          .update({
            display_name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            departments: form.departments,
            default_availability: availabilityPayload(),
            notes: form.notes.trim() || null,
          })
          .eq('id', editing.id);
        if (error) throw error;
        await savePayRate(editing.key, form.rate);
      } else {
        const [first, ...rest] = form.name.trim().split(' ');
        const { data: ph, error: phErr } = await (supabase as any)
          .from('staff_placeholders')
          .insert({
            first_name: first,
            last_name: rest.join(' ') || '',
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            roles: [],
            created_by: user?.id ?? null,
          })
          .select('id')
          .single();
        if (phErr) throw phErr;
        const key = `ref:placeholder:${ph.id}`;
        const { error } = await (supabase as any).from('staff_schedule_profiles').insert({
          person_key: key,
          placeholder_id: ph.id,
          display_name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          departments: form.departments,
          default_availability: availabilityPayload(),
          notes: form.notes.trim() || null,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
        await savePayRate(key, form.rate);
      }
      toast({ title: 'Saved' });
      setOpen(false);
      reload();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addExisting = async (c: (typeof candidates)[number]) => {
    try {
      const { error } = await (supabase as any).from('staff_schedule_profiles').insert({
        person_key: c.key,
        user_id: c.user_id,
        placeholder_id: c.placeholder_id,
        display_name: c.name,
        email: c.email,
        departments: [],
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast({ title: `${c.name} added to the schedule` });
      reload();
    } catch (e: any) {
      toast({ title: 'Could not add', description: e.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (p: SchedulePerson) => {
    const { error } = await (supabase as any)
      .from('staff_schedule_profiles')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
      return;
    }
    reload();
  };

  return (
    <ScheduleShell
      title="Team"
      description="Everyone who can be scheduled, the areas they work, and their rate."
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Add person
        </Button>
      }
    >
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading team…</Card>
      ) : (
        <Card className="divide-y">
          {people.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No one on the schedule yet. Add a person, or bring in an existing staff account below.
            </div>
          )}
          {people.map((p) => (
            <div key={p.id} className="p-3 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2">
                  {p.name}
                  {!p.is_active && <Badge variant="secondary">Archived</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{p.email ?? 'No email'} · {p.phone ?? 'No phone'}</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {p.departments.length === 0 && (
                    <span className="text-xs text-muted-foreground">No departments assigned</span>
                  )}
                  {p.departments.map((d) => (
                    <Badge key={d} variant="outline" className="gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={departmentDotStyle(d)} />
                      {departmentLabel(d)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canSeePay && (
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {p.rate != null ? `$${p.rate.toFixed(2)}/hr` : 'No rate'}
                  </span>
                )}
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(p)} aria-label="Archive">
                  {p.is_active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {candidates.length > 0 && (
        <Card className="p-3">
          <div className="font-medium text-sm mb-2">Staff not on the schedule yet</div>
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <Button key={c.key} size="sm" variant="outline" onClick={() => addExisting(c)}>
                <UserPlus className="h-4 w-4 mr-1.5" /> {c.name}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit person' : 'Add person'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Departments they can work</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {DEPARTMENTS.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.departments.includes(d.id)}
                      onCheckedChange={() => toggleDept(d.id)}
                    />
                    <span className="h-2 w-2 rounded-full" style={departmentDotStyle(d.id)} />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
            {canSeePay && (
              <div>
                <Label>Hourly rate (managers only)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Usual availability</Label>
              <div className="space-y-1.5 mt-1">
                {DAYS.map((d, i) => {
                  const v = form.availability[String(i)];
                  return (
                    <div key={d} className="flex items-center gap-2">
                      <Checkbox
                        checked={v.enabled}
                        onCheckedChange={(c) =>
                          setForm({
                            ...form,
                            availability: { ...form.availability, [String(i)]: { ...v, enabled: !!c } },
                          })
                        }
                      />
                      <span className="w-10 text-sm">{d}</span>
                      <Input
                        type="time"
                        className="h-8 w-28"
                        disabled={!v.enabled}
                        value={v.start}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            availability: {
                              ...form.availability,
                              [String(i)]: { ...v, start: e.target.value },
                            },
                          })
                        }
                      />
                      <Input
                        type="time"
                        className="h-8 w-28"
                        disabled={!v.enabled}
                        value={v.end}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            availability: {
                              ...form.availability,
                              [String(i)]: { ...v, end: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
