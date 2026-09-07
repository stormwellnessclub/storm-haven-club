import { useEffect, useMemo, useState } from 'react';
import { ScheduleShell } from '@/components/schedule/ScheduleShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRoles } from '@/hooks/useUserRoles';
import { departmentLabel } from '@/lib/schedule/departments';
import { formatDateLocal, getWeekStart } from '@/lib/staffScheduleResolution';

interface CostRow {
  person_key: string;
  person_name: string | null;
  department: string | null;
  hours: number;
  hourly_rate: number;
  cost: number;
}

export default function ScheduleHours() {
  const { roles } = useUserRoles();
  const canSeePay = roles.some((r) => ['super_admin', 'admin', 'manager'].includes(r));

  const defaults = useMemo(() => {
    const start = getWeekStart(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    return { start: formatDateLocal(start), end: formatDateLocal(end) };
  }, []);

  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await (supabase as any).rpc('schedule_labor_cost', {
      p_start: start,
      p_end: end,
    });
    if (error) setError(error.message);
    setRows(
      ((data ?? []) as any[]).map((r) => ({
        ...r,
        hours: Number(r.hours),
        hourly_rate: Number(r.hourly_rate),
        cost: Number(r.cost),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byPerson = useMemo(() => {
    const map = new Map<string, { name: string; hours: number; cost: number; rate: number; depts: Set<string> }>();
    for (const r of rows) {
      const cur = map.get(r.person_key) ?? {
        name: r.person_name ?? 'Staff',
        hours: 0,
        cost: 0,
        rate: r.hourly_rate,
        depts: new Set<string>(),
      };
      cur.hours += r.hours;
      cur.cost += r.cost;
      cur.rate = r.hourly_rate;
      if (r.department) cur.depts.add(r.department);
      map.set(r.person_key, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].hours - a[1].hours);
  }, [rows]);

  const byDept = useMemo(() => {
    const map = new Map<string, { hours: number; cost: number }>();
    for (const r of rows) {
      const key = r.department ?? 'other';
      const cur = map.get(key) ?? { hours: 0, cost: 0 };
      cur.hours += r.hours;
      cur.cost += r.cost;
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].hours - a[1].hours);
  }, [rows]);

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const weeks = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (7 * 864e5)));

  return (
    <ScheduleShell
      title="Hours & cost"
      description="Scheduled hours per person and department for the pay period."
      actions={
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1.5" /> Print for pay room
        </Button>
      }
    >
      <Card className="p-3 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <Label>From</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Update'}</Button>
      </Card>

      {error && (
        <Card className="p-4 text-sm text-destructive">{error}</Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total hours</div>
          <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
        </Card>
        {canSeePay && (
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Projected cost</div>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
          </Card>
        )}
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">People scheduled</div>
          <div className="text-2xl font-bold">{byPerson.length}</div>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left p-2">Staff</th>
              <th className="text-left p-2">Departments</th>
              <th className="text-right p-2">Hours</th>
              {canSeePay && <th className="text-right p-2">Rate</th>}
              {canSeePay && <th className="text-right p-2">Cost</th>}
            </tr>
          </thead>
          <tbody>
            {byPerson.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nothing scheduled in this range.</td></tr>
            )}
            {byPerson.map(([key, v]) => {
              const overtime = v.hours / weeks > 40;
              return (
                <tr key={key} className="border-b">
                  <td className="p-2 font-medium">
                    {v.name}
                    {overtime && (
                      <Badge variant="destructive" className="ml-2 gap-1">
                        <AlertTriangle className="h-3 w-3" /> Over 40/wk
                      </Badge>
                    )}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {Array.from(v.depts).map(departmentLabel).join(', ') || '—'}
                  </td>
                  <td className="p-2 text-right tabular-nums">{v.hours.toFixed(2)}</td>
                  {canSeePay && <td className="p-2 text-right tabular-nums">${v.rate.toFixed(2)}</td>}
                  {canSeePay && <td className="p-2 text-right tabular-nums">${v.cost.toFixed(2)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="p-3">
        <div className="font-medium text-sm mb-2">By department</div>
        <div className="space-y-1.5">
          {byDept.map(([dept, v]) => (
            <div key={dept} className="flex items-center justify-between text-sm">
              <span>{departmentLabel(dept)}</span>
              <span className="tabular-nums text-muted-foreground">
                {v.hours.toFixed(1)} hrs{canSeePay ? ` · $${v.cost.toFixed(2)}` : ''}
              </span>
            </div>
          ))}
          {byDept.length === 0 && <div className="text-sm text-muted-foreground">No data.</div>}
        </div>
      </Card>
    </ScheduleShell>
  );
}
