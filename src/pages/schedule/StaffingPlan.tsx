import { useMemo, useState } from 'react';
import { ScheduleShell } from '@/components/schedule/ScheduleShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Copy, Check } from 'lucide-react';
import {
  buildStaffingPlan,
  planTotals,
  fmtClock,
  fmtHours,
  staffingPlanText,
  SHIFT_MIN_HOURS,
  SHIFT_MAX_HOURS,
  DAYS_MIN_PER_PERSON,
  DAYS_MAX_PER_PERSON,
} from '@/lib/schedule/staffingPlan';

export default function StaffingPlan() {
  const breakdown = useMemo(() => buildStaffingPlan(), []);
  const totals = useMemo(() => planTotals(breakdown), [breakdown]);
  const [copied, setCopied] = useState(false);

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        timeZone: 'America/Detroit',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );

  const copy = async () => {
    await navigator.clipboard.writeText(staffingPlanText(breakdown, `Prepared ${dateLabel}`));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScheduleShell
      title="Staffing requirements"
      description={`Planning report · prepared ${dateLabel}`}
      actions={
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
            {copied ? 'Copied' : 'Copy as text'}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Print / PDF
          </Button>
        </div>
      }
    >
      <style>{`@media print { nav, header button { display: none !important; } }`}</style>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assumptions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            Shifts run {SHIFT_MIN_HOURS}–{SHIFT_MAX_HOURS} hours. Each person works{' '}
            {DAYS_MIN_PER_PERSON}–{DAYS_MAX_PER_PERSON} days a week, so some staff are on twice a
            week and others four times.
          </p>
          <p>
            Front desk is staffed by 2 people at all times; the cafe and kids care by 1 person at a
            time. Hours are Detroit time and assume no overlap or handover padding between shifts.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Staffed hours per week" value={fmtHours(totals.weeklyHours)} />
        <SummaryStat label="Shifts per week" value={String(totals.weeklyShifts)} />
        <SummaryStat
          label="Staff members needed"
          value={`${totals.minPeople}–${totals.maxPeople}`}
        />
        <SummaryStat
          label="Average shift length"
          value={`${(totals.weeklyHours / totals.weeklyShifts).toFixed(1)} h`}
        />
      </div>

      {breakdown.map((dept) => (
        <Card key={dept.key}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                {dept.name}
                <Badge variant="secondary">
                  {dept.concurrency} {dept.concurrency === 1 ? 'person' : 'people'} on at a time
                </Badge>
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {fmtHours(dept.weeklyHours)} hours
                </span>{' '}
                · {dept.weeklyShifts} shifts ·{' '}
                <span className="font-semibold text-foreground">
                  {dept.minPeople}–{dept.maxPeople} people
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Day</th>
                    <th className="px-4 py-2 font-medium">Open</th>
                    <th className="px-4 py-2 font-medium text-right">Staffed hours</th>
                    <th className="px-4 py-2 font-medium text-right">Shifts</th>
                    <th className="px-4 py-2 font-medium">Shift blocks</th>
                  </tr>
                </thead>
                <tbody>
                  {dept.days.map((d) => (
                    <tr key={d.day} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium whitespace-nowrap">{d.day}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {fmtClock(d.open)} – {fmtClock(d.close)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {fmtHours(d.staffedHours)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.shiftCount}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {d.blocks.map((b, i) => (
                            <span
                              key={i}
                              className="rounded border px-1.5 py-0.5 text-xs whitespace-nowrap text-muted-foreground"
                            >
                              {fmtClock(b.start)}–{fmtClock(b.end)} ({b.hours.toFixed(1)}h)
                              {dept.concurrency > 1 ? ` ×${dept.concurrency}` : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-medium">
                    <td className="px-4 py-2" colSpan={2}>
                      Weekly total
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtHours(dept.weeklyHours)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{dept.weeklyShifts}</td>
                    <td className="px-4 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How the headcount is calculated</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {breakdown.map((dept) => (
            <p key={dept.key}>
              <span className="font-medium">{dept.name}:</span> {fmtHours(dept.weeklyHours)} staffed
              hours ÷ about {dept.avgShiftHours.toFixed(1)} hours per shift ={' '}
              {dept.weeklyShifts} shifts a week. At {DAYS_MIN_PER_PERSON}–{DAYS_MAX_PER_PERSON}{' '}
              shifts per person that is{' '}
              <span className="font-medium">
                {dept.minPeople}–{dept.maxPeople} people
              </span>
              .
            </p>
          ))}
          <p className="pt-2 border-t">
            <span className="font-medium">Total:</span> {fmtHours(totals.weeklyHours)} staffed hours
            a week across {totals.weeklyShifts} shifts, needing{' '}
            <span className="font-medium">
              {totals.minPeople}–{totals.maxPeople} staff members
            </span>
            . Plan toward the higher number to absorb call-offs, time off and holidays.
          </p>
        </CardContent>
      </Card>
    </ScheduleShell>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
