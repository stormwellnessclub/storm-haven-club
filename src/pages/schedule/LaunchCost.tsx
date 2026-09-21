import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ScheduleShell } from '@/components/schedule/ScheduleShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Check, Copy, ExternalLink, Printer } from 'lucide-react';
import { useScheduleWeek, shiftHours } from '@/hooks/useScheduleWeek';
import { formatDateLocal, getWeekStart } from '@/lib/staffScheduleResolution';
import {
  DEFAULT_ASSUMPTIONS,
  fmtMoney,
  type GapAssumptions,
} from '@/lib/schedule/staffingGap';
import {
  buildLaunchCostReport,
  DEFAULT_OWNER_LOAD,
  FULL_TIME_WEEK,
  type OwnerLoad,
} from '@/lib/schedule/launchCost';
import { BENCHMARKS, BENCHMARK_LIST, EVIDENCE_GAPS } from '@/lib/schedule/industryBenchmarks';
import { usePersistedState } from '@/hooks/usePersistedState';

const PLAN_KEYS = ['front_desk', 'cafe', 'kids_care'];

export default function LaunchCost() {
  const [copied, setCopied] = useState(false);
  const [assumptions, setAssumptions] = usePersistedState<GapAssumptions>(
    'staffing-gap-assumptions-v2',
    DEFAULT_ASSUMPTIONS,
    'local'
  );
  const [owner, setOwner] = usePersistedState<OwnerLoad>(
    'launch-cost-owner-load',
    DEFAULT_OWNER_LOAD,
    'local'
  );

  const dates = useMemo(() => {
    const start = getWeekStart(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return formatDateLocal(d);
    });
  }, []);

  const { shifts, loading } = useScheduleWeek(dates);

  const scheduled = useMemo(() => {
    const byDepartmentDay: Record<string, number[]> = {};
    for (const key of PLAN_KEYS) byDepartmentDay[key] = [0, 0, 0, 0, 0, 0, 0];
    for (const s of shifts) {
      if (s.status !== 'scheduled') continue;
      const key = s.department ?? 'other';
      if (!byDepartmentDay[key]) continue;
      const idx = dates.indexOf(s.shift_date);
      if (idx < 0) continue;
      byDepartmentDay[key][idx] += shiftHours(s);
    }
    return { byDepartmentDay };
  }, [shifts, dates]);

  const r = useMemo(
    () => buildLaunchCostReport(scheduled, assumptions, owner),
    [scheduled, assumptions, owner]
  );

  const rollChart = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        label: `M${i + 1}`,
        cost: r.perMonth.total * (i + 1),
      })),
    [r]
  );

  const monthlyBreakdown = [
    { name: 'Unfilled work', value: r.perMonth.unfilledWork },
    { name: 'Cafe & kids care revenue', value: r.perMonth.forfeitedRevenue },
    { name: 'Your unpaid hours', value: r.perMonth.ownerOverage },
  ];

  const text = useMemo(() => {
    const l = [
      'STORM WELLNESS CLUB — THE COST OF A STRETCHED LAUNCH',
      `${r.toDate.monthsOpen} months open. Coverage at ${r.gap.totals.coveredPct}%. ${r.gap.totals.uncoveredPct}% of the staffed week is uncovered.`,
      '',
      'WHAT IT HAS COST SO FAR',
      `- ${r.toDate.uncoveredHours.toLocaleString()} uncovered hours, worth ${fmtMoney(r.toDate.unfilledWorkValue)} of work.`,
      `- Owner hours: ${r.owner.totalHoursToDate.toLocaleString()} worked (${r.owner.totalHoursPerWeek} h/week — ${r.owner.fullTimeJobs} full-time jobs), ${r.owner.overageToDate.toLocaleString()} beyond a 40-hour week, worth ${fmtMoney(r.owner.overageValueToDate)} at the wages of the roles covered.`,
      `- Modelled cafe and kids care revenue forfeited: ${fmtMoney(r.toDate.forfeitedDepartmentRevenue)}.`,
      `- Total exposure to date: ${fmtMoney(r.toDate.totalExposure)}.`,
      '',
      `EVERY FURTHER MONTH COSTS ${fmtMoney(r.perMonth.total)}`,
      ...r.rollforward.map((f) => `- ${f.label}: ${fmtMoney(f.cost)}`),
      '',
      'HOW FAR BEHIND',
      `- ${r.behind.monthsOpen} months open, 0 months fully operating.`,
      `- That is ${r.behind.lifetimeSharePct}% of the average ${BENCHMARKS.membership_length.display} membership lifetime spent at partial staffing.`,
      ...r.catchUp.map(
        (c) =>
          `- Hiring ${c.hiresPerMonth} a month: fully covered in ${c.monthsToFull} months, at a further ${fmtMoney(c.costWhileHiring)} on the way.`
      ),
      '',
      'THE THREE OPTIONS, TWELVE MONTHS OUT',
      ...r.options.map(
        (o) =>
          `- ${o.name}: ${fmtMoney(o.totalExposure)} exposure, ${fmtMoney(o.payrollInvested)} payroll invested, ${o.ownerHoursCarried.toLocaleString()} owner hours still carried.`
      ),
    ];
    return l.join('\n');
  }, [r]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cheapest = [...r.options].sort((a, b) => a.totalExposure - b.totalExposure)[0];

  return (
    <ScheduleShell
      title="The cost of a stretched launch"
      description={`${r.toDate.monthsOpen} months open · ${r.gap.totals.coveredPct}% of the staffed week covered`}
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
      <style>{`@media print { nav, .print\\:hidden { display: none !important; } }`}</style>

      {/* Headline */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-6">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Where we are
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold mt-2 leading-snug">
            {r.toDate.monthsOpen} months open, still launching. {r.gap.totals.uncoveredPct}% of the
            staffed week is uncovered, and one person is absorbing the difference at{' '}
            {r.owner.totalHoursPerWeek} hours a week.
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-3xl">
            Every figure below is either measured from the club's own schedule and wage rates, or
            carries the published source it came from. Nothing here rests on a churn assumption.
          </p>
        </CardContent>
      </Card>

      {/* Cost to date */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            What the stretched launch has already cost
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Uncovered hours since opening"
              value={loading ? '…' : r.toDate.uncoveredHours.toLocaleString()}
              sub={`${r.gap.totals.uncovered} h short every week`}
              tone="danger"
            />
            <Stat
              label="Work that was never done"
              value={fmtMoney(r.toDate.unfilledWorkValue)}
              sub="at median wages for those roles"
              tone="danger"
            />
            <Stat
              label="Cafe & kids care revenue"
              value={fmtMoney(r.toDate.forfeitedDepartmentRevenue)}
              sub="modelled forfeit while unstaffed"
              tone="danger"
            />
            <Stat
              label="Total exposure to date"
              value={fmtMoney(r.toDate.totalExposure)}
              sub="unfilled work + lost revenue + your unpaid hours"
              tone="danger"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Payroll never spent on those hours is {fmtMoney(r.toDate.payrollNotSpent)} — the saving
            and the damage are the same number. The club did not keep that money; it simply did not
            deliver the work.
          </p>
        </CardContent>
      </Card>

      {/* Owner load */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">The hours one person is carrying</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Hours a week"
              value={`${r.owner.totalHoursPerWeek} h`}
              sub={`${r.owner.clubHoursPerWeek} h on the floor + ${r.owner.adminHoursPerWeek} h admin`}
              tone="danger"
            />
            <Stat
              label="Full-time jobs"
              value={`${r.owner.fullTimeJobs}×`}
              sub={`against a ${FULL_TIME_WEEK}-hour week`}
              tone="danger"
            />
            <Stat
              label="Hours worked since opening"
              value={r.owner.totalHoursToDate.toLocaleString()}
              sub={`${r.owner.overageToDate.toLocaleString()} of them unpaid overage`}
              tone="danger"
            />
            <Stat
              label="Value of the overage"
              value={fmtMoney(r.owner.overageValueToDate)}
              sub={`at $${r.owner.replacementWage.toFixed(2)}/hr, the blended wage of the roles covered`}
              tone="danger"
            />
          </div>
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <span className="font-medium">This is the single point of failure.</span> If the owner
            stops for any reason — illness, injury, burnout — {r.owner.clubHoursPerWeek} hours a week
            of floor coverage disappears overnight, worth{' '}
            {fmtMoney(r.owner.clubHoursPerWeek * 52 * r.owner.replacementWage)} a year to replace at
            short notice, on top of the {r.gap.totals.uncovered} hours already uncovered. There is no
            second person who can open the club.
          </div>
        </CardContent>
      </Card>

      {/* Cost per month */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Every further month of waiting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Cost of one more month
              </div>
              <div className="text-4xl font-bold text-destructive mt-1">
                {fmtMoney(r.perMonth.total)}
              </div>
            </div>
            <div className="text-sm text-muted-foreground max-w-md">
              {fmtMoney(r.perMonth.unfilledWork)} of work not done,{' '}
              {fmtMoney(r.perMonth.forfeitedRevenue)} of cafe and kids care revenue the closed hours
              cannot earn, and {fmtMoney(r.perMonth.ownerOverage)} of owner hours nobody is paid for.
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyBreakdown} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
              />
              <YAxis dataKey="name" type="category" width={170} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Bar dataKey="value" name="Per month" fill="hsl(var(--destructive))" radius={3} />
            </BarChart>
          </ResponsiveContainer>

          <div className="grid gap-3 sm:grid-cols-4">
            {r.rollforward.map((f) => (
              <div key={f.months} className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </div>
                <div className="text-2xl font-bold mt-1">{fmtMoney(f.cost)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rollforward chart */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">If nothing changes — the next twelve months</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={rollChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
              />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Line
                type="monotone"
                dataKey="cost"
                name="Cumulative cost of waiting"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            Cumulative cost of the delay at the current coverage level, month on month. Combined with
            what has already gone, staying as we are for another year brings the total to{' '}
            {fmtMoney(r.toDate.totalExposure + r.perMonth.total * 12)}.
          </p>
        </CardContent>
      </Card>

      {/* How far behind */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How far behind a club that launched staffed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Months open"
              value={String(r.behind.monthsOpen)}
              sub="since the doors opened"
            />
            <Stat
              label="Months fully operating"
              value="0"
              sub="no week has been fully covered"
              tone="danger"
            />
            <Stat
              label="Of an average membership lifetime"
              value={`${r.behind.lifetimeSharePct}%`}
              sub={`the average member stays ${BENCHMARKS.membership_length.display}`}
              tone="danger"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            The average member stays {BENCHMARKS.membership_length.display} (
            {BENCHMARKS.membership_length.source}, {BENCHMARKS.membership_length.year}). Every
            founding member has therefore spent {r.behind.lifetimeSharePct}% of a typical membership
            experiencing the club at partial staffing — that is the version of Storm they will
            renew or leave on. At {assumptions.activeMembers} members the base represents about{' '}
            {fmtMoney(r.behind.memberBaseAnnualRevenue)} a year on the published benchmark (
            {BENCHMARKS.revenue_per_member_multipurpose.source},{' '}
            {BENCHMARKS.revenue_per_member_multipurpose.year}).
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {r.catchUp.map((c) => (
              <div key={c.hiresPerMonth} className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {c.hiresPerMonth} hires a month
                </div>
                <div className="text-2xl font-bold mt-1">{c.monthsToFull} months</div>
                <div className="text-xs text-muted-foreground mt-1">
                  to a fully covered schedule, costing a further {fmtMoney(c.costWhileHiring)} on the
                  way there
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Member impact — cited */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            What partial staffing does to members — published data
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {[
            {
              b: BENCHMARKS.retention_annual,
              line: `Roughly one in three members leave every year as a baseline. At ${assumptions.activeMembers} members that is about ${Math.round(assumptions.activeMembers * (1 - (BENCHMARKS.retention_annual.value ?? 66.4) / 100))} people a year before any service problem is counted.`,
            },
            {
              b: BENCHMARKS.retention_independent,
              line: 'Independent clubs out-retain chains specifically on staffed, personal service — the one thing the gap removes.',
            },
            {
              b: BENCHMARKS.childcare_demand,
              line: `Kids care sits ${r.gap.departments.find((d) => d.key === 'kids_care')?.uncoveredPct ?? 0}% uncovered, so that demand cannot be served.`,
            },
            {
              b: BENCHMARKS.first_year_failure,
              line: 'Undercapitalised staffing and owner-carried operations are the named causes in this research.',
            },
            {
              b: BENCHMARKS.founder_burnout,
              line: `${r.owner.totalHoursPerWeek} hours a week is not a staffing strategy, and the research says how it ends.`,
            },
            {
              b: BENCHMARKS.turnover_cost,
              line: `Losing any one of the few people already on the schedule restarts hiring at ${BENCHMARKS.cost_per_hire.display} a head.`,
            },
          ].map((p) => (
            <div key={p.b.id} className="border-l-2 pl-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-bold">{p.b.display}</span>
                <span className="text-sm text-muted-foreground">{p.b.label}</span>
              </div>
              <p className="text-sm mt-1">{p.line}</p>
              <a
                href={p.b.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground underline inline-flex items-center gap-1 mt-1"
              >
                {p.b.source}, {p.b.year}
                <ExternalLink className="h-3 w-3" />
              </a>
              {p.b.confidence === 'directional' && (
                <Badge variant="outline" className="text-[10px] ml-2">
                  directional
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* The ask */}
      <Card className="border-primary/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">The three options, priced</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Option</th>
                  <th className="px-4 py-2 font-medium text-right">Hires / month</th>
                  <th className="px-4 py-2 font-medium text-right">Work left undone</th>
                  <th className="px-4 py-2 font-medium text-right">Payroll invested</th>
                  <th className="px-4 py-2 font-medium text-right">Owner hours carried</th>
                  <th className="px-4 py-2 font-medium text-right">Twelve-month exposure</th>
                </tr>
              </thead>
              <tbody>
                {r.options.map((o) => (
                  <tr key={o.key} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{o.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{o.hiresPerMonth}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtMoney(o.unfilledWorkYear)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtMoney(o.payrollInvested)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {o.ownerHoursCarried.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {fmtMoney(o.totalExposure)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-4 border-t text-sm">
            <span className="font-medium">The point of the page:</span> the cheapest option on it is{' '}
            <span className="font-medium">{cheapest.name.toLowerCase()}</span> at{' '}
            {fmtMoney(cheapest.totalExposure)} over twelve months, and it is the one we are not
            doing. Waiting is not the careful choice — it is the expensive one, and the bill arrives
            whether or not we hire.
          </div>
        </CardContent>
      </Card>

      {/* Your numbers */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your numbers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field
            label="Hours a day at the club"
            value={owner.clubHoursPerDay}
            onChange={(v) => setOwner({ ...owner, clubHoursPerDay: v })}
          />
          <Field
            label="Days a week"
            value={owner.daysPerWeek}
            onChange={(v) => setOwner({ ...owner, daysPerWeek: v })}
          />
          <Field
            label="Admin hours a day"
            value={owner.adminHoursPerDay}
            onChange={(v) => setOwner({ ...owner, adminHoursPerDay: v })}
          />
          <Field
            label="Weeks open"
            value={assumptions.weeksOpen}
            onChange={(v) => setAssumptions({ ...assumptions, weeksOpen: v })}
          />
          <Field
            label="Active members"
            value={assumptions.activeMembers}
            onChange={(v) => setAssumptions({ ...assumptions, activeMembers: v })}
          />
          <Field
            label="Hours covered per hire"
            value={assumptions.hoursPerHire}
            onChange={(v) => setAssumptions({ ...assumptions, hoursPerHire: v })}
          />
        </CardContent>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-sm">
            {BENCHMARK_LIST.map((b) => (
              <li key={b.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{b.display}</span>
                <span className="text-muted-foreground">— {b.label}.</span>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline inline-flex items-center gap-1"
                >
                  {b.source}, {b.year}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {b.confidence === 'directional' && (
                  <Badge variant="outline" className="text-[10px]">
                    directional
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t pt-3">
            <div className="text-sm font-medium mb-1">What this brief cannot measure</div>
            <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
              {EVIDENCE_GAPS.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </ScheduleShell>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'danger';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${tone === 'danger' ? 'text-destructive' : ''}`}>
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        step="0.5"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8"
      />
    </div>
  );
}
