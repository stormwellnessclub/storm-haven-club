import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { Printer, Copy, Check, ChevronLeft, ChevronRight, AlertTriangle, ExternalLink } from 'lucide-react';
import { useScheduleWeek, shiftHours } from '@/hooks/useScheduleWeek';
import { formatDateLocal, getWeekStart } from '@/lib/staffScheduleResolution';
import { getDepartment } from '@/lib/schedule/departments';
import {
  buildGapReport,
  DEFAULT_ASSUMPTIONS,
  fmtHrs,
  fmtMoney,
  type GapAssumptions,
} from '@/lib/schedule/staffingGap';
import { BENCHMARKS, BENCHMARK_LIST, EVIDENCE_GAPS } from '@/lib/schedule/industryBenchmarks';
import { usePersistedState } from '@/hooks/usePersistedState';

const PLAN_KEYS = ['front_desk', 'cafe', 'kids_care'];

export default function StaffingGap() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [copied, setCopied] = useState(false);
  const [assumptions, setAssumptions] = usePersistedState<GapAssumptions>(
    'staffing-gap-assumptions',
    DEFAULT_ASSUMPTIONS,
    'local'
  );

  const dates = useMemo(() => {
    const start = getWeekStart(new Date());
    start.setDate(start.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return formatDateLocal(d);
    });
  }, [weekOffset]);

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

  const report = useMemo(
    () => buildGapReport(scheduled, assumptions),
    [scheduled, assumptions]
  );

  const weekLabel = useMemo(() => {
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    return `${fmt(dates[0])} – ${fmt(dates[6])}`;
  }, [dates]);

  const dayChart = useMemo(
    () =>
      report.departments[0].days.map((_, i) => {
        const row: Record<string, string | number> = {
          day: report.departments[0].days[i].day.slice(0, 3),
        };
        for (const dept of report.departments) row[dept.name] = dept.days[i].uncovered;
        return row;
      }),
    [report]
  );

  const coveragePie = [
    { name: 'Covered', value: report.totals.scheduled },
    { name: 'Uncovered', value: report.totals.uncovered },
  ];

  const text = useMemo(() => {
    const l: string[] = [
      'STORM WELLNESS CLUB — STAFFING GAP & BUSINESS IMPACT',
      `Week of ${weekLabel}`,
      '',
      `COVERAGE: ${report.totals.scheduled} of ${report.totals.needed} staffed hours filled — ${report.totals.uncoveredPct}% of the week is uncovered (${report.totals.uncovered} hours).`,
      '',
    ];
    for (const d of report.departments) {
      l.push(
        `${d.name}: needs ${d.needed} h, scheduled ${d.scheduled} h, uncovered ${d.uncovered} h (${d.uncoveredPct}%). Hires needed: ${d.hiresMin}-${d.hiresMax}.`
      );
    }
    l.push(
      '',
      `TOTAL HIRES NEEDED: ${report.totals.hiresMin}-${report.totals.hiresMax}.`,
      `Payroll to staff the plan: ${fmtMoney(report.totals.weeklyPayrollToFullStaff)}/week, ${fmtMoney(report.totals.annualPayrollToFullStaff)}/year at BLS median wages.`,
      '',
      `SINCE OPENING (${assumptions.weeksOpen} weeks): ${Math.round(report.cumulative.uncoveredHours).toLocaleString()} uncovered hours, worth ${fmtMoney(report.cumulative.payrollValue)} of labour absorbed by the owner or simply not delivered.`,
      `Owner floor time: ${Math.round(report.cumulative.ownerFloorHours).toLocaleString()} hours at ${assumptions.ownerFloorHours} h/week.`,
      '',
      'INDUSTRY CONTEXT:',
      `- ${BENCHMARKS.first_year_failure.display} of fitness studios fail in year one (${BENCHMARKS.first_year_failure.source}, ${BENCHMARKS.first_year_failure.year}).`,
      `- US clubs retain ${BENCHMARKS.retention_annual.display} of members a year (${BENCHMARKS.retention_annual.source}, ${BENCHMARKS.retention_annual.year}).`,
      `- ${BENCHMARKS.childcare_demand.display} of parents would use the club more with childcare (${BENCHMARKS.childcare_demand.source}).`,
      `- Replacing a burned-out employee costs ${BENCHMARKS.turnover_cost.display} (${BENCHMARKS.turnover_cost.source}).`,
    ];
    return l.join('\n');
  }, [report, weekLabel, assumptions]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setWage = (key: string, v: number) =>
    setAssumptions({ ...assumptions, wages: { ...assumptions.wages, [key]: v } });

  return (
    <ScheduleShell
      title="Staffing gap & business impact"
      description={`Week of ${weekLabel} · measured against the staffing plan`}
      actions={
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
            This week
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Staffed hours needed" value={fmtHrs(report.totals.needed)} />
        <Stat label="Actually scheduled" value={loading ? '…' : fmtHrs(report.totals.scheduled)} />
        <Stat
          label="Uncovered"
          value={`${report.totals.uncoveredPct}%`}
          sub={fmtHrs(report.totals.uncovered)}
          tone="danger"
        />
        <Stat
          label="Hires still needed"
          value={`${report.totals.hiresMin}–${report.totals.hiresMax}`}
          sub="people"
          tone="danger"
        />
      </div>

      {/* Coverage charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Week coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={coveragePie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="hsl(var(--primary))" />
                  <Cell fill="hsl(var(--destructive))" />
                </Pie>
                <Tooltip formatter={(v: number) => `${v} h`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center -mt-2">
              <div className="text-3xl font-bold">{report.totals.coveredPct}%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">covered</div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Needed vs scheduled, by department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={report.departments} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `${v} h`} />
                <Legend />
                <Bar dataKey="needed" name="Needed" fill="hsl(var(--muted-foreground))" radius={3} />
                <Bar dataKey="scheduled" name="Scheduled" fill="hsl(var(--primary))" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Uncovered hours, day by day</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dayChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `${v} h`} />
              <Legend />
              {report.departments.map((d) => (
                <Bar
                  key={d.key}
                  dataKey={d.name}
                  stackId="a"
                  fill={`hsl(var(${getDepartment(d.key).token}))`}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Department table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Where the gap sits</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Department</th>
                  <th className="px-4 py-2 font-medium text-right">Needed</th>
                  <th className="px-4 py-2 font-medium text-right">Scheduled</th>
                  <th className="px-4 py-2 font-medium text-right">Uncovered</th>
                  <th className="px-4 py-2 font-medium text-right">% uncovered</th>
                  <th className="px-4 py-2 font-medium text-right">Shifts to fill</th>
                  <th className="px-4 py-2 font-medium text-right">Hires</th>
                  <th className="px-4 py-2 font-medium text-right">Weekly payroll</th>
                </tr>
              </thead>
              <tbody>
                {report.departments.map((d) => (
                  <tr key={d.key} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{d.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.needed}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.scheduled}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.uncovered}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <Badge variant={d.uncoveredPct >= 50 ? 'destructive' : 'secondary'}>
                        {d.uncoveredPct}%
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.shiftsToFill}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {d.hiresMin}–{d.hiresMax}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtMoney(d.weeklyPayrollToFullStaff)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">{report.totals.needed}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{report.totals.scheduled}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{report.totals.uncovered}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {report.totals.uncoveredPct}%
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{report.totals.shiftsToFill}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {report.totals.hiresMin}–{report.totals.hiresMax}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmtMoney(report.totals.weeklyPayrollToFullStaff)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-4 py-3 text-xs text-muted-foreground border-t">
            Payroll priced at US Bureau of Labor Statistics median wages ({BENCHMARKS.wage_front_desk.display} front
            desk, {BENCHMARKS.wage_cafe.display} cafe, {BENCHMARKS.wage_kids_care.display} kids care). Fully staffing
            the plan costs {fmtMoney(report.totals.annualPayrollToFullStaff)} a year.
          </div>
        </CardContent>
      </Card>

      {/* Hiring runway */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How long to close the gap</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {report.hiring.map((h) => (
            <div key={h.hiresPerMonth} className="rounded-lg border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {h.hiresPerMonth} hires a month
              </div>
              <div className="text-2xl font-bold mt-1">{h.monthsToFull} months</div>
              <div className="text-xs text-muted-foreground mt-1">
                until the schedule is fully covered
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Assumptions */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your numbers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {report.departments.map((d) => (
            <Field
              key={d.key}
              label={`${d.name} $/hr`}
              value={assumptions.wages[d.key]}
              onChange={(v) => setWage(d.key, v)}
            />
          ))}
          <Field
            label="Weeks open"
            value={assumptions.weeksOpen}
            onChange={(v) => setAssumptions({ ...assumptions, weeksOpen: v })}
          />
          <Field
            label="Your floor hours / week"
            value={assumptions.ownerFloorHours}
            onChange={(v) => setAssumptions({ ...assumptions, ownerFloorHours: v })}
          />
          <Field
            label="Active members"
            value={assumptions.activeMembers}
            onChange={(v) => setAssumptions({ ...assumptions, activeMembers: v })}
          />
        </CardContent>
      </Card>

      {/* Year one impact */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Year one: what the gap has already cost
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label={`Uncovered hours in ${assumptions.weeksOpen} weeks`}
              value={Math.round(report.cumulative.uncoveredHours).toLocaleString()}
              sub="hours the club was short"
              tone="danger"
            />
            <Stat
              label="Labour value of those hours"
              value={fmtMoney(report.cumulative.payrollValue)}
              sub="absorbed by you or not delivered"
              tone="danger"
            />
            <Stat
              label="Your own hours on the floor"
              value={Math.round(report.cumulative.ownerFloorHours).toLocaleString()}
              sub={`at ${assumptions.ownerFloorHours} h/week since opening`}
              tone="danger"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            These three figures are measured from your own schedule and wage rates — no industry
            estimate is involved. Everything below is benchmarked against published research, with
            the source shown next to each number.
          </p>
        </CardContent>
      </Card>

      {/* Benchmarked context */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BenchCard
          title="The founder load is the risk"
          points={[
            {
              b: BENCHMARKS.first_year_failure,
              line: `You are ${report.totals.uncoveredPct}% uncovered in month ${Math.round(assumptions.weeksOpen / 4.33)} of year one, with undercapitalised staffing the named cause in this research.`,
            },
            {
              b: BENCHMARKS.owner_hours,
              line: `You are carrying ${assumptions.ownerFloorHours} floor hours a week on top of running the business.`,
            },
            { b: BENCHMARKS.founder_burnout, line: 'The cost of continuing is not only financial.' },
            {
              b: BENCHMARKS.turnover_cost,
              line: `Losing one of the ${report.totals.hiresMin ? 'few' : ''} people you already have restarts the clock at ${BENCHMARKS.cost_per_hire.display} per hire.`,
            },
          ]}
        />
        <BenchCard
          title="What understaffed hours do to membership"
          points={[
            {
              b: BENCHMARKS.retention_annual,
              line: `At ${assumptions.activeMembers} active members, a normal year would see roughly ${Math.round(assumptions.activeMembers * (1 - BENCHMARKS.retention_annual.value! / 100))} leave.`,
            },
            {
              b: BENCHMARKS.retention_independent,
              line: 'Independently run clubs retain better precisely because of staffed, personal service — the thing the gap removes.',
            },
            {
              b: BENCHMARKS.revenue_per_member_multipurpose,
              line: `Your ${assumptions.activeMembers} members represent about ${fmtMoney(assumptions.activeMembers * assumptions.revenuePerMember)} a year on this benchmark.`,
            },
            {
              b: BENCHMARKS.childcare_demand,
              line: `Kids care is ${report.departments.find((d) => d.key === 'kids_care')?.uncoveredPct ?? 0}% uncovered.`,
            },
          ]}
        />
      </div>

      {/* Ancillary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revenue the closed departments cannot earn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {report.ancillary.map((a) => (
              <div key={a.key} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.name}</span>
                  <Badge variant="secondary">{a.sharePct.toFixed(1)}% of club revenue</Badge>
                </div>
                <div className="text-2xl font-bold mt-2 text-destructive">
                  {fmtMoney(a.modelledForfeit)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  modelled annual forfeit — {fmtMoney(a.annualPotential)} potential, of which the
                  department is unstaffed for{' '}
                  {report.departments.find((d) => d.key === a.key)?.uncoveredPct}% of its hours
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Revenue shares from IHRSA Profiles of Success (2019): food and beverage{' '}
            {BENCHMARKS.mix_fb.display}, children and youth {BENCHMARKS.mix_kids.display}, spa{' '}
            {BENCHMARKS.mix_spa.display}, personal training {BENCHMARKS.mix_pt.display} of total club
            revenue. No published study measures losses from a closed amenity directly, so these are
            modelled from the revenue mix rather than observed.
          </p>
        </CardContent>
      </Card>

      {/* Projection */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">The cost of waiting — next 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={report.projection}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
              />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="asIs"
                name="Stay as we are"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="slow"
                name="Hire 2 a month"
                stroke="hsl(var(--dept-cafe))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="toPlan"
                name="Hire to plan (5 a month)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            Cumulative labour value of hours left uncovered, month on month. Built only from measured
            hours and wage rates — no churn or revenue assumption is inside these lines. Staying as
            we are costs {fmtMoney(report.projection[11].asIs)} of unfilled work over the year
            against {fmtMoney(report.projection[11].toPlan)} if hiring runs to plan.
          </p>
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
            <div className="text-sm font-medium mb-1">What this report cannot measure</div>
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
        <div
          className={`text-2xl font-bold mt-1 ${tone === 'danger' ? 'text-destructive' : ''}`}
        >
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
        step="0.01"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8"
      />
    </div>
  );
}

function BenchCard({
  title,
  points,
}: {
  title: string;
  points: { b: (typeof BENCHMARK_LIST)[number]; line: string }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {points.map((p) => (
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
