import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Check, Copy, ExternalLink, Printer } from 'lucide-react';
import { ScheduleShell } from '@/components/schedule/ScheduleShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useScheduleWeek, shiftHours } from '@/hooks/useScheduleWeek';
import { useLaunchOperations, STORM_OPENING_DATE } from '@/hooks/useLaunchOperations';
import { formatDateLocal, getWeekStart } from '@/lib/staffScheduleResolution';
import { DEFAULT_ASSUMPTIONS, fmtMoney, type GapAssumptions } from '@/lib/schedule/staffingGap';
import { buildLaunchCostReport, DEFAULT_OWNER_LOAD, FULL_TIME_WEEK, type OwnerLoad } from '@/lib/schedule/launchCost';
import { buildOperationalLaunchReport, DEFAULT_FOUNDER_ROLES } from '@/lib/schedule/operationalLaunch';
import { BENCHMARKS } from '@/lib/schedule/industryBenchmarks';
import { usePersistedState } from '@/hooks/usePersistedState';

const PLAN_KEYS = ['front_desk', 'cafe', 'kids_care'];
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

const EVIDENCE = [
  {
    stat: 'First impressions matter most',
    copy: 'A field study of more than 5,000 hotel stays found first impressions were the strongest contributor to overall satisfaction.',
    source: 'Journal of Business Research', year: '2024',
    url: 'https://ideas.repec.org/a/eee/jbrese/v185y2024ics014829632400403x.html', strength: 'strong',
  },
  {
    stat: 'Recovery does not erase image damage',
    copy: 'A meta-analysis found strong service recovery can restore satisfaction, but not reliably repurchase intent, word of mouth, or corporate image.',
    source: 'Journal of Service Research', year: '2007',
    url: 'https://doi.org/10.1177/1094670507303012', strength: 'strong',
  },
  {
    stat: '12–24 month café ramp',
    copy: 'New food-service units commonly begin below mature-unit revenue and need time to build repeat traffic. This is directional context, not Storm revenue.',
    source: 'Franchise working-capital analysis', year: '2025',
    url: 'https://fddiq.com/blog/franchise-working-capital-break-even-timeline', strength: 'directional',
  },
  {
    stat: 'Founder overload is measurable',
    copy: 'Peer-reviewed research links sustained emotional demands and work overload with entrepreneurial burnout and reduced operating resilience.',
    source: 'Small Business Economics', year: '2022',
    url: 'https://link.springer.com/article/10.1007/s11187-022-00702-w', strength: 'strong',
  },
];

export default function LaunchCost() {
  const [copied, setCopied] = useState(false);
  const [assumptions, setAssumptions] = usePersistedState<GapAssumptions>('staffing-gap-assumptions-v2', DEFAULT_ASSUMPTIONS, 'local');
  const [owner, setOwner] = usePersistedState<OwnerLoad>('launch-cost-owner-load', DEFAULT_OWNER_LOAD, 'local');
  const [founderRoles, setFounderRoles] = usePersistedState('launch-cost-founder-roles-v1', DEFAULT_FOUNDER_ROLES, 'local');
  const dates = useMemo(() => {
    const start = getWeekStart(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return formatDateLocal(d);
    });
  }, []);
  const { shifts, loading: scheduleLoading } = useScheduleWeek(dates);
  const { data: operations, loading: operationsLoading, error } = useLaunchOperations();
  const throughDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Detroit' });

  const scheduled = useMemo(() => {
    const byDepartmentDay: Record<string, number[]> = {};
    for (const key of PLAN_KEYS) byDepartmentDay[key] = [0, 0, 0, 0, 0, 0, 0];
    for (const shift of shifts) {
      if (shift.status !== 'scheduled') continue;
      const key = shift.department ?? 'other';
      const idx = dates.indexOf(shift.shift_date);
      if (byDepartmentDay[key] && idx >= 0) byDepartmentDay[key][idx] += shiftHours(shift);
    }
    return { byDepartmentDay };
  }, [shifts, dates]);

  const labor = useMemo(() => buildLaunchCostReport(scheduled, assumptions, owner), [scheduled, assumptions, owner]);
  const actual = useMemo(() => buildOperationalLaunchReport(operations, STORM_OPENING_DATE, throughDate), [operations, throughDate]);
  const founderTotal = founderRoles.reduce((sum, role) => sum + role.hours, 0);
  const nineMonthScenario = actual.scenarios.map((s) => ({ ...s, periodPotential: s.combinedMonthly * actual.period.months }));

  const copyText = async () => {
    const lines = [
      'STORM WELLNESS CLUB — NINE-MONTH LAUNCH DIAGNOSIS',
      `Classes: ${actual.classes.delivered.toLocaleString()} delivered of ${actual.classes.goal.toLocaleString()} weekday target (${actual.classes.goalPct}%).`,
      `Spa: ${actual.spa.completed} completed appointments, ${money(actual.spa.serviceRevenue)} service revenue, ${actual.spa.returningClients} returning clients, ${actual.spa.usedRooms}/${actual.spa.activeRooms} rooms used.`,
      `Cafe: ${actual.cafe.transactions} reconciled transactions, ${money(actual.cafe.revenue)}, ${actual.cafe.purchasingMembers} purchasing members.`,
      `Core staffing: ${labor.gap.totals.uncoveredPct}% uncovered; ${labor.gap.totals.uncovered} hours short each week.`,
      `Founder load: ${founderTotal} hours/week across ${founderRoles.length} operating roles (${(founderTotal / FULL_TIME_WEEK).toFixed(1)} full-time jobs).`,
      '', 'MODELED MONTHLY CAPACITY — NOT RECORDED LOST REVENUE',
      ...actual.scenarios.map((s) => `${s.name}: ${money(s.combinedMonthly)}/month across spa and cafe. ${s.note}`),
      '', 'CONCLUSION',
      'The business did not simply run short of labor. Core revenue engines did not receive enough consistent staffing, leadership time, marketing, or service inventory to complete a normal launch ramp.',
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const loading = scheduleLoading || operationsLoading;

  return (
    <ScheduleShell
      title="Nine-month launch diagnosis"
      description="Actual revenue, unrealized operating capacity, and the recovery path"
      actions={<div className="flex items-center gap-2 print:hidden"><Button variant="outline" size="sm" onClick={copyText}>{copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}{copied ? 'Copied' : 'Copy as text'}</Button><Button size="sm" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print / PDF</Button></div>}
    >
      <style>{`@media print { nav, .print\\:hidden { display: none !important; } }`}</style>
      {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>Some operating records could not be loaded: {error}</AlertDescription></Alert>}

      <section className="border-y border-destructive/40 py-7">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Nine months in</div>
        <h2 className="mt-2 max-w-4xl text-2xl font-semibold leading-snug sm:text-4xl">
          Storm has been open, but its classes, spa and café have not had the staffing or founder capacity to complete a real launch.
        </h2>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          This page leads with Storm's recorded activity. Models are shown separately and never described as revenue the club definitely lost.
        </p>
      </section>

      <section className="space-y-4">
        <SectionTitle eyebrow="What actually operated" title="The launch gap is visible in Storm’s own records" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Weekday class goal reached" value={loading ? '…' : `${actual.classes.goalPct}%`} sub={`${actual.classes.delivered.toLocaleString()} of ${actual.classes.goal.toLocaleString()} target classes`} tone="danger" />
          <Stat label="Spa service revenue" value={loading ? '…' : money(actual.spa.serviceRevenue)} sub={`${actual.spa.completed} completed appointments · tips excluded`} />
          <Stat label="Café revenue reconciled" value={loading ? '…' : money(actual.cafe.revenue)} sub={`${actual.cafe.transactions} transactions · ${actual.cafe.purchasingMembers} purchasing members`} />
          <Stat label="Core staffed week uncovered" value={loading ? '…' : `${labor.gap.totals.uncoveredPct}%`} sub={`${labor.gap.totals.uncovered} hours short every week`} tone="danger" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Monthly operating output</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={actual.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis yAxisId="classes" /><YAxis yAxisId="revenue" orientation="right" tickFormatter={(v) => `$${Math.round(v / 1000)}k`} /><Tooltip formatter={(v: number, name: string) => name.includes('revenue') ? money(v) : v} /><Legend /><Line yAxisId="classes" dataKey="classes" name="Classes delivered" stroke="hsl(var(--primary))" strokeWidth={2} /><Line yAxisId="revenue" dataKey="spaRevenue" name="Spa revenue" stroke="hsl(var(--destructive))" strokeWidth={2} /><Line yAxisId="revenue" dataKey="cafeRevenue" name="Café revenue" stroke="hsl(var(--accent-foreground))" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Verified scope</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <AuditRow label="Opening baseline" value="February 2026" />
            <AuditRow label="Report through" value={throughDate} />
            <AuditRow label="Class goal" value="20 per weekday" />
            <AuditRow label="Active spa rooms" value={String(actual.spa.activeRooms)} />
            <AuditRow label="Founder load" value={`${founderTotal} h/week`} />
            <p className="border-t pt-3 text-xs text-muted-foreground">All dates use America/Detroit. Future records are excluded.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionTitle eyebrow="What could not launch" title="Three revenue engines were constrained at the same time" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Department title="Classes" headline={`${actual.classes.shortfall.toLocaleString()} classes below goal`} facts={[`${actual.classes.delivered} delivered; ${actual.classes.cancelled} cancelled`, `${actual.classes.bookedSpots.toLocaleString()} bookings across ${actual.classes.offeredSpots.toLocaleString()} offered places`, `${actual.classes.fillPct}% recorded fill rate`, `${actual.classes.instructors} instructors and ${actual.classes.studios} studios appear in delivered sessions`]} note="A class community cannot build rapport around inventory that was never consistently offered. Low early fill does not prove a class should disappear; it shows the ramp was interrupted." />
          <Department title="Spa" headline={`${actual.spa.usedRooms} of ${actual.spa.activeRooms} rooms used`} facts={[`${actual.spa.completed} completed; ${actual.spa.cancelled} cancelled`, `${actual.spa.clients} recorded clients; ${actual.spa.returningClients} returned`, `${actual.spa.repeatClientPct}% of recorded clients became repeat clients`, `${actual.spa.usedTherapists} therapists appear in completed appointments`]} note="The repeat behavior demonstrates that demand can build once a service is activated. Room capacity and therapist capacity are shown separately; six rooms do not mean one therapist can serve six clients at once." />
          <Department title="Café" headline={`${money(actual.cafe.revenue)} actually generated`} facts={[`${actual.cafe.transactions} reconciled transactions`, `${actual.cafe.averageTicket.toFixed(2)} average ticket`, `${actual.cafe.repeatMembers} repeat purchasing members`, `${actual.cafe.ordersPerBuyer} transactions per identified buyer`]} note="This includes member-account/card charges, not only the café order screen. Matching payment references removes duplicate order tickets." />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle eyebrow="The founder bottleneck" title="One person became the operating system" />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card className="border-destructive/40"><CardContent className="p-5"><div className="grid gap-4 sm:grid-cols-3"><Stat label="Total weekly load" value={`${founderTotal} h`} sub="owner-entered role allocation" tone="danger" /><Stat label="Equivalent jobs" value={`${(founderTotal / FULL_TIME_WEEK).toFixed(1)}×`} sub="against a 40-hour week" tone="danger" /><Stat label="Beyond one job" value={`${Math.max(0, founderTotal - FULL_TIME_WEEK)} h`} sub="before recovery work can begin" tone="danger" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{founderRoles.map((role, index) => <div key={role.name} className="flex items-center gap-2"><Input className="h-8 w-20 print:hidden" type="number" value={role.hours} onChange={(e) => setFounderRoles(founderRoles.map((r, i) => i === index ? { ...r, hours: Number(e.target.value) || 0 } : r))} /><span className="hidden font-medium print:inline">{role.hours} h</span><span className="text-sm">{role.name}</span></div>)}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Why the damage compounds</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Chain n="1" text="Unfilled core roles force the founder onto the floor." /><Chain n="2" text="Hiring, onboarding, class development, marketing and systems work are displaced." /><Chain n="3" text="Classes, spa rooms and the café stay inconsistent or inactive." /><Chain n="4" text="Members cannot form reliable habits or see the full promised experience." /><Chain n="5" text="Each delayed month postpones the start of the recovery ramp itself." /></CardContent></Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle eyebrow="Revenue range" title="What consistent spa and café activation could support" />
        <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>These are transparent capacity scenarios, not booked revenue and not accounting losses. Class membership value is not converted to dollars because the records do not prove what one additional class would earn.</AlertDescription></Alert>
        <div className="grid gap-4 md:grid-cols-3">{nineMonthScenario.map((s) => <Card key={s.key} className={s.key === 'conservative' ? 'border-primary/50' : ''}><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">{s.name}</CardTitle><Badge variant={s.key === 'conservative' ? 'default' : 'outline'}>{s.key === 'capacity' ? 'target' : 'model'}</Badge></div></CardHeader><CardContent><div className="text-3xl font-bold">{money(s.combinedMonthly)}<span className="text-sm font-normal text-muted-foreground"> / month</span></div><div className="mt-3 space-y-1 text-sm"><AuditRow label="Spa" value={money(s.spaMonthly)} /><AuditRow label="Café" value={money(s.cafeMonthly)} /><AuditRow label={`${actual.period.months}-month equivalent`} value={money(s.periodPotential)} /></div><p className="mt-3 text-xs text-muted-foreground">{s.note}</p></CardContent></Card>)}</div>
      </section>

      <Card>
        <CardHeader><CardTitle className="text-base">Class delivery: goal versus reality</CardTitle></CardHeader>
        <CardContent><ResponsiveContainer width="100%" height={280}><BarChart data={actual.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend /><Bar dataKey="classGoal" name="20-per-weekday goal" fill="hsl(var(--muted-foreground))" radius={2} /><Bar dataKey="classes" name="Delivered" fill="hsl(var(--primary))" radius={2} /></BarChart></ResponsiveContainer></CardContent>
      </Card>

      <section className="space-y-4">
        <SectionTitle eyebrow="Brand consequence" title="Fixing staffing does not instantly reset the launch" />
        <div className="grid gap-4 sm:grid-cols-2">{EVIDENCE.map((e) => <Card key={e.stat}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="font-semibold">{e.stat}</div><Badge variant="outline">{e.strength}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{e.copy}</p><a href={e.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs underline">{e.source}, {e.year}<ExternalLink className="h-3 w-3" /></a></CardContent></Card>)}</div>
      </section>

      <section className="space-y-4">
        <SectionTitle eyebrow="Recovery plan" title="The next hire starts recovery; it does not recover the nine months already lost" />
        <div className="grid gap-3 md:grid-cols-5">{[
          ['1', 'Stabilize', 'Fill front desk, café and kids care coverage; remove the owner as the default substitute.'],
          ['2', 'Recruit', 'Create protected weekly hiring time for instructors and spa therapists.'],
          ['3', 'Rebuild inventory', 'Publish a dependable class calendar and activate spa rooms only with deliverable staffing.'],
          ['4', 'Restart demand', 'Resume marketing after service capacity is reliable enough to keep the promise.'],
          ['5', 'Re-earn habit', 'Allow months for instructor rapport, repeat spa bookings, café routine and referrals to compound.'],
        ].map(([n, title, copy]) => <Card key={n}><CardContent className="p-4"><div className="text-2xl font-bold text-primary">{n}</div><div className="mt-2 font-semibold">{title}</div><p className="mt-1 text-xs text-muted-foreground">{copy}</p></CardContent></Card>)}</div>
        <div className="grid gap-3 sm:grid-cols-3">{labor.catchUp.map((c) => <Card key={c.hiresPerMonth}><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{c.hiresPerMonth} core hires / month</div><div className="mt-1 text-2xl font-bold">{c.monthsToFull} months</div><div className="mt-1 text-xs text-muted-foreground">to close today’s core coverage gap; instructor and therapist recruitment follows separately</div></CardContent></Card>)}</div>
      </section>

      <Card className="print:hidden"><CardHeader><CardTitle className="text-base">Model inputs</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6"><Field label="Club hours / day" value={owner.clubHoursPerDay} onChange={(v) => setOwner({ ...owner, clubHoursPerDay: v })} /><Field label="Days / week" value={owner.daysPerWeek} onChange={(v) => setOwner({ ...owner, daysPerWeek: v })} /><Field label="Admin hours / day" value={owner.adminHoursPerDay} onChange={(v) => setOwner({ ...owner, adminHoursPerDay: v })} /><Field label="Weeks open" value={assumptions.weeksOpen} onChange={(v) => setAssumptions({ ...assumptions, weeksOpen: v })} /><Field label="Active members" value={assumptions.activeMembers} onChange={(v) => setAssumptions({ ...assumptions, activeMembers: v })} /><Field label="Hours / core hire" value={assumptions.hoursPerHire} onChange={(v) => setAssumptions({ ...assumptions, hoursPerHire: v })} /></CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Method and data-quality ledger</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><AuditRow label="Café" value="Successful café member charges plus unmatched café orders; duplicate payment references removed" /><AuditRow label="Spa" value="Completed appointments only; service amount plus add-ons; tips excluded" /><AuditRow label="Classes" value="Visible, non-cancelled, non-fundraiser dated sessions; weekdays only for the goal" /><AuditRow label="Founder hours" value="Owner-entered allocation; not reconstructed from incomplete time clocks" /><AuditRow label="Stripe reconciliation" value="Application payment references used; Stripe Sigma is not enabled" /><AuditRow label="Confidence" value="Actual activity: high · founder allocation: owner estimate · scenarios: modeled" /><p className="border-t pt-3 text-xs text-muted-foreground">This report cannot prove that every unoffered class, unused room or quiet café hour would have sold. It proves the operating capacity was not consistently available, measures what did happen, and shows bounded scenarios for what a stable launch could support.</p><a href={BENCHMARKS.revenue_per_member_multipurpose.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">Additional multipurpose-club context: {BENCHMARKS.revenue_per_member_multipurpose.source}<ExternalLink className="h-3 w-3" /></a></CardContent></Card>
    </ScheduleShell>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <div><div className="text-xs uppercase tracking-widest text-muted-foreground">{eyebrow}</div><h2 className="mt-1 text-xl font-semibold sm:text-2xl">{title}</h2></div>; }
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'danger' }) { return <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className={`mt-1 text-2xl font-bold ${tone === 'danger' ? 'text-destructive' : ''}`}>{value}</div>{sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}</CardContent></Card>; }
function Department({ title, headline, facts, note }: { title: string; headline: string; facts: string[]; note: string }) { return <Card><CardHeader><div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div><CardTitle className="text-xl">{headline}</CardTitle></CardHeader><CardContent><ul className="space-y-2 text-sm">{facts.map((fact) => <li key={fact} className="border-b pb-2 last:border-0">{fact}</li>)}</ul><p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{note}</p></CardContent></Card>; }
function AuditRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>; }
function Chain({ n, text }: { n: string; text: string }) { return <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span><span>{text}</span></div>; }
function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) { return <div className="space-y-1"><Label className="text-xs">{label}</Label><Input type="number" value={value} step="0.5" onChange={(e) => onChange(Number(e.target.value) || 0)} className="h-8" /></div>; }
