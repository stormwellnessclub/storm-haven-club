import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Plus, Copy } from 'lucide-react';
import { departmentBlockStyle, departmentLabel } from '@/lib/schedule/departments';
import { formatTime, personKeyOf, shiftHours, type ScheduleShift } from '@/hooks/useScheduleWeek';
import type { SchedulePerson } from '@/hooks/useScheduleTeam';

interface Props {
  people: SchedulePerson[];
  dates: string[];
  shifts: ScheduleShift[];
  onCellClick: (personKey: string, date: string) => void;
  onShiftClick: (shift: ScheduleShift) => void;
  onShiftDrop: (shiftId: string, personKey: string, date: string, copy: boolean) => void;
}

export function ScheduleWeekGrid({ people, dates, shifts, onCellClick, onShiftClick, onShiftDrop }: Props) {
  const byCell = new Map<string, ScheduleShift[]>();
  for (const s of shifts) {
    const k = `${personKeyOf(s)}|${s.shift_date}`;
    const arr = byCell.get(k) ?? [];
    arr.push(s);
    byCell.set(k, arr);
  }

  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Detroit' });

  const hoursFor = (key: string) =>
    shifts
      .filter((s) => personKeyOf(s) === key && s.status === 'scheduled')
      .reduce((sum, s) => sum + shiftHours(s), 0);

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left p-2 w-52 font-medium">Staff</th>
            {dates.map((d) => {
              const dt = new Date(d + 'T12:00:00');
              return (
                <th key={d} className={cn('p-2 font-medium text-center', d === todayIso && 'bg-primary/10')}>
                  <div>{dt.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                  <div className="text-xs text-muted-foreground">
                    {dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </th>
              );
            })}
            <th className="p-2 w-16 text-right font-medium">Hrs</th>
          </tr>
        </thead>
        <tbody>
          {people.length === 0 && (
            <tr>
              <td colSpan={dates.length + 2} className="p-6 text-center text-muted-foreground">
                No staff on the schedule yet — add people on the Team tab.
              </td>
            </tr>
          )}
          {people.map((p) => (
            <tr key={p.key} className="border-b align-top">
              <td className="p-2">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.departments.length ? p.departments.map(departmentLabel).join(', ') : 'No department'}
                </div>
              </td>
              {dates.map((d) => {
                const cell = (byCell.get(`${p.key}|${d}`) ?? []).sort((a, b) =>
                  a.start_time.localeCompare(b.start_time)
                );
                return (
                  <td
                    key={d}
                    className={cn('p-1 group', d === todayIso && 'bg-primary/5')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('text/shift-id');
                      if (id) onShiftDrop(id, p.key, d, e.shiftKey || e.altKey);
                    }}
                  >
                    <div className="space-y-1">
                      {cell.map((s) => (
                        <button
                          key={s.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/shift-id', s.id)}
                          onClick={() => onShiftClick(s)}
                          style={s.status === 'scheduled' ? departmentBlockStyle(s.department) : undefined}
                          className={cn(
                            'w-full rounded border px-1.5 py-1 text-left text-xs leading-tight',
                            s.status !== 'scheduled' && 'bg-muted text-muted-foreground line-through',
                            !s.published_at && s.status === 'scheduled' && 'border-dashed'
                          )}
                          title={`${departmentLabel(s.department)} · ${s.status}${s.notes ? ` · ${s.notes}` : ''}`}
                        >
                          <div className="font-medium">
                            {formatTime(s.start_time)}–{formatTime(s.end_time)}
                          </div>
                          <div className="opacity-80 truncate">{departmentLabel(s.department)}</div>
                        </button>
                      ))}
                      <button
                        onClick={() => onCellClick(p.key, d)}
                        className="w-full flex items-center justify-center rounded border border-dashed py-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Add shift"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                );
              })}
              <td className="p-2 text-right tabular-nums text-muted-foreground">
                {hoursFor(p.key).toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <Copy className="h-3.5 w-3.5" />
        Drag a shift to move it. Hold Shift while dropping to duplicate it. Dashed edges mean not published yet.
      </div>
    </Card>
  );
}
