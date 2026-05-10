import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatShortTime, type ResolvedShift } from '@/lib/staffScheduleResolution';
import type { TeamMember } from './types';

interface Props {
  members: TeamMember[];
  date: string;
  resolved: ResolvedShift[];
  onCellClick: (member: TeamMember, date: string) => void;
  onShiftClick: (shift: ResolvedShift, member: TeamMember) => void;
}

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_WIDTH = 60; // px per hour

function timeToHours(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

export function DayTimelineView({ members, date, resolved, onCellClick, onShiftClick }: Props) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  // Filter resolved to only this date
  const dayShifts = resolved.filter((r) => r.shift_date === date);
  const memberKeyOf = (m: TeamMember) => m.user_id ?? `ref:${m.email ?? ''}`;
  const byMember = new Map<string, ResolvedShift[]>();
  for (const s of dayShifts) {
    const k = s.user_id ?? `ref:${s.person_ref ?? ''}`;
    (byMember.get(k) ?? byMember.set(k, []).get(k)!).push(s);
  }

  // Who's on now (only if date is today)
  const todayIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const isToday = date === todayIso;
  let nowOn: { name: string; until: string }[] = [];
  if (isToday) {
    const now = new Date();
    const nowHours = now.getHours() + now.getMinutes() / 60;
    nowOn = dayShifts
      .filter((s) => s.status === 'scheduled')
      .filter((s) => timeToHours(s.start_time) <= nowHours && timeToHours(s.end_time) > nowHours)
      .map((s) => ({ name: s.person_name ?? 'Unknown', until: formatShortTime(s.end_time) }));
  }

  const totalWidth = (END_HOUR - START_HOUR) * HOUR_WIDTH;

  return (
    <div className="space-y-3">
      {isToday && (
        <Card className="p-3 bg-primary/5 border-primary/20">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Who's on now
          </div>
          {nowOn.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nobody currently scheduled.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {nowOn.map((p, i) => (
                <span
                  key={i}
                  className="text-sm px-2 py-1 rounded bg-primary/10 border border-primary/30"
                >
                  {p.name} <span className="text-muted-foreground">until {p.until}</span>
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-x-auto">
        <div style={{ minWidth: 200 + totalWidth }}>
          {/* Hour header */}
          <div className="flex border-b bg-muted/40 sticky top-0 z-10">
            <div className="w-[200px] flex-shrink-0 p-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Team Member
            </div>
            <div className="relative flex-1" style={{ width: totalWidth }}>
              <div className="flex">
                {hours.slice(0, -1).map((h) => (
                  <div
                    key={h}
                    style={{ width: HOUR_WIDTH }}
                    className="text-center text-xs text-muted-foreground py-3 border-l"
                  >
                    {formatShortTime(`${String(h).padStart(2, '0')}:00:00`)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {members.map((m) => {
            const shifts = byMember.get(memberKeyOf(m)) ?? [];
            return (
              <div key={m.key} className="flex border-b hover:bg-muted/10 group/row">
                <div className="w-[200px] flex-shrink-0 p-3 flex flex-col justify-center">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {m.name}
                    {m.isPlaceholder && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Unactivated
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.group}</div>
                </div>
                <div
                  className="relative flex-1 cursor-pointer min-h-[56px]"
                  style={{ width: totalWidth }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-shift-bar]')) return;
                    onCellClick(m, date);
                  }}
                >
                  {/* Hour gridlines */}
                  {hours.slice(0, -1).map((h, i) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-l border-border/40"
                      style={{ left: i * HOUR_WIDTH }}
                    />
                  ))}
                  {/* Shift bars */}
                  {shifts.map((s) => {
                    const startH = Math.max(START_HOUR, timeToHours(s.start_time));
                    const endH = Math.min(END_HOUR, timeToHours(s.end_time));
                    if (endH <= startH) return null;
                    const left = (startH - START_HOUR) * HOUR_WIDTH;
                    const width = (endH - startH) * HOUR_WIDTH;
                    return (
                      <button
                        key={s.key}
                        data-shift-bar
                        onClick={() => onShiftClick(s, m)}
                        className={cn(
                          'absolute top-1.5 bottom-1.5 rounded border px-2 text-xs text-left overflow-hidden',
                          s.status === 'pto' &&
                            'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
                          s.status === 'cancelled' &&
                            'bg-destructive/10 border-destructive/30 line-through opacity-60',
                          s.status === 'swapped' &&
                            'bg-purple-500/10 border-purple-500/30',
                          s.status === 'scheduled' && s.source === 'shift' &&
                            'bg-primary/10 border-primary/30',
                          s.status === 'scheduled' && s.source === 'template' &&
                            'bg-muted/60 border-dashed border-muted-foreground/30 text-muted-foreground'
                        )}
                        style={{ left, width }}
                      >
                        <div className="font-medium truncate">
                          {s.status === 'pto'
                            ? 'PTO'
                            : `${formatShortTime(s.start_time)}–${formatShortTime(s.end_time)}`}
                        </div>
                        {s.position && (
                          <div className="truncate text-[10px] opacity-80">{s.position}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
