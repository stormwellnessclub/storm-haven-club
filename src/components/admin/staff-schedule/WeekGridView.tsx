import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatShortTime, type ResolvedShift } from '@/lib/staffScheduleResolution';
import type { TeamMember } from './types';

interface Props {
  members: TeamMember[];
  dates: string[];
  resolved: ResolvedShift[];
  onCellClick: (member: TeamMember, date: string) => void;
  onShiftClick: (shift: ResolvedShift, member: TeamMember) => void;
}

const groupOrder: TeamMember['group'][] = [
  'Managers',
  'Front Desk',
  'Operations',
  'Instructors',
  'Therapists',
  'Other',
];

export function WeekGridView({ members, dates, resolved, onCellClick, onShiftClick }: Props) {
  // Index resolved by personKey|date
  const byCell = new Map<string, ResolvedShift[]>();
  for (const r of resolved) {
    const personKey = r.user_id ?? `ref:${r.person_ref ?? ''}`;
    const k = `${personKey}|${r.shift_date}`;
    const arr = byCell.get(k) ?? [];
    arr.push(r);
    byCell.set(k, arr);
  }

  const memberKeyOf = (m: TeamMember) => m.user_id ?? `ref:${m.email ?? ''}`;

  // Group members
  const grouped: Record<string, TeamMember[]> = {};
  for (const m of members) {
    (grouped[m.group] ??= []).push(m);
  }

  const dayLabels = dates.map((d) => {
    const dt = new Date(d + 'T12:00:00');
    return {
      iso: d,
      weekday: dt.toLocaleDateString(undefined, { weekday: 'short' }),
      day: dt.getDate(),
      month: dt.toLocaleDateString(undefined, { month: 'short' }),
    };
  });

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header */}
          <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b bg-muted/40 sticky top-0 z-10">
            <div className="p-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Team Member
            </div>
            {dayLabels.map((d) => (
              <div key={d.iso} className="p-3 text-center border-l">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{d.weekday}</div>
                <div className="text-sm font-semibold">
                  {d.month} {d.day}
                </div>
              </div>
            ))}
          </div>

          {groupOrder.map((g) => {
            const groupMembers = grouped[g];
            if (!groupMembers?.length) return null;
            return (
              <div key={g}>
                <div className="px-3 py-2 bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground font-medium border-b">
                  {g}
                </div>
                {groupMembers.map((m) => (
                  <div
                    key={m.key}
                    className="grid grid-cols-[200px_repeat(7,1fr)] border-b hover:bg-muted/10 transition-colors"
                  >
                    <div className="p-3 flex flex-col justify-center">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      {m.email && (
                        <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                      )}
                    </div>
                    {dates.map((date) => {
                      const cellKey = `${memberKeyOf(m)}|${date}`;
                      const cellShifts = byCell.get(cellKey) ?? [];
                      return (
                        <div
                          key={date}
                          className="border-l p-1.5 min-h-[64px] cursor-pointer group/cell"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('[data-shift-block]')) return;
                            onCellClick(m, date);
                          }}
                        >
                          <div className="space-y-1">
                            {cellShifts.map((s) => (
                              <Tooltip key={s.key}>
                                <TooltipTrigger asChild>
                                  <button
                                    data-shift-block
                                    onClick={() => onShiftClick(s, m)}
                                    className={cn(
                                      'w-full text-left text-xs px-2 py-1 rounded border transition-all',
                                      s.status === 'pto' &&
                                        'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
                                      s.status === 'cancelled' &&
                                        'bg-destructive/10 border-destructive/30 line-through opacity-60',
                                      s.status === 'swapped' &&
                                        'bg-purple-500/10 border-purple-500/30',
                                      s.status === 'scheduled' && s.source === 'shift' &&
                                        'bg-primary/10 border-primary/30 text-foreground',
                                      s.status === 'scheduled' && s.source === 'template' &&
                                        'bg-muted/60 border-dashed border-muted-foreground/30 text-muted-foreground'
                                    )}
                                  >
                                    <div className="font-medium">
                                      {s.status === 'pto'
                                        ? 'PTO'
                                        : `${formatShortTime(s.start_time)}–${formatShortTime(s.end_time)}`}
                                    </div>
                                    {s.position && (
                                      <div className="truncate text-[10px] opacity-80">{s.position}</div>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                {(s.notes || s.source === 'template') && (
                                  <TooltipContent>
                                    {s.source === 'template' && (
                                      <div className="text-xs italic mb-1">From recurring template</div>
                                    )}
                                    {s.notes && <div className="text-xs">{s.notes}</div>}
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            ))}
                            {cellShifts.length === 0 && (
                              <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity text-muted-foreground flex items-center justify-center h-full text-xs">
                                <Plus className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No team members found.
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="bg-primary/10 border-primary/30">Scheduled</Badge>
        </span>
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="border-dashed border-muted-foreground/30 bg-muted/60">
            From template
          </Badge>
        </span>
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400">
            PTO
          </Badge>
        </span>
      </div>
    </TooltipProvider>
  );
}
