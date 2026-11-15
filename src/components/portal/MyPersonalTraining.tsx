import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarDays, ChevronRight, CreditCard, Info, Layers, Package } from "lucide-react";
import { format, parseISO } from "date-fns";
import { PT_FORMAT_LABEL } from "@/lib/ptFormat";
import { ptRequestProblem, PT_REQUEST_NOTE_MAX } from "@/lib/ptRequestForm";
import { useMyPTPortal, useMyPTRequests, upcomingPT, type MyPTPortalData, type MyPTRequest } from "@/hooks/useMyPTPortal";

/** Client requests stay off until the owner activates them; the server also refuses client submissions. */
const REQUESTS_ACTIVE = false;

const money = (c: number | null | undefined) => c == null ? "—" : `$${(c / 100).toFixed(2)}`;
const day = (d: string | null | undefined) => (d ? format(parseISO(d), "MMM d, yyyy") : "—");
const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const clock = (t: string | null | undefined) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
type Appt = MyPTPortalData["appointments"][number];
const sessionName = (a: Appt) => a.session_type ?? PT_FORMAT_LABEL[a.format as keyof typeof PT_FORMAT_LABEL] ?? label(a.format);
const apptTime = (a: Appt) => `${format(parseISO(a.starts_at), "h:mm a")} – ${format(new Date(parseISO(a.starts_at).getTime() + a.duration_minutes * 60000), "h:mm a")}`;
const detroitToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit" }).format(new Date());

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3 text-sm py-1.5 border-t border-border first:border-t-0"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
}

function InfoCard({ icon: Icon, title, children, onClick }: { icon: any; title: string; children: React.ReactNode; onClick?: () => void }) {
  const body = (
    <CardContent className="flex items-start gap-3 py-4">
      <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p>{children}</div>
      {onClick && <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />}
    </CardContent>
  );
  return <Card className="bg-secondary/40">{onClick ? <button type="button" className="w-full text-left" onClick={onClick}>{body}</button> : body}</Card>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0" /><p>{children}</p></div>;
}

function RequestForm({ trainers }: { trainers: string[] }) {
  const [trainer, setTrainer] = useState("any");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [earliest, setEarliest] = useState("10:00");
  const [latest, setLatest] = useState("13:00");
  const [flexibility, setFlexibility] = useState<"window" | "exact">("window");
  const [note, setNote] = useState("");
  const problem = ptRequestProblem({ date, time, flexibility, earliest, latest }, detroitToday());
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Request a PT Session</h2>
        <p className="text-sm text-muted-foreground">Tell us your preferred details and we'll confirm your session as soon as possible.</p>
      </div>
      <Notice><strong className="text-foreground">This is a session request, not a confirmed booking.</strong> We'll review your request and send a confirmation once it's scheduled.</Notice>
      {!REQUESTS_ACTIVE && <Badge variant="secondary">Online requests coming soon</Badge>}
      <fieldset disabled={!REQUESTS_ACTIVE} className="space-y-4 disabled:opacity-60">
        <div className="space-y-1.5"><Label>Trainer preference</Label>
          <Select value={trainer} onValueChange={setTrainer}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="any">Any trainer</SelectItem>{trainers.map((t) => <SelectItem key={t} value={t}>{t} (Preferred)</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="pt-date">Preferred date</Label><Input id="pt-date" type="date" min={detroitToday()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="pt-time">Preferred time</Label><Input id="pt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Availability window</Label>
          <div className="flex items-center gap-2">
            <Input aria-label="Window starts" type="time" value={earliest} onChange={(e) => setEarliest(e.target.value)} disabled={!REQUESTS_ACTIVE || flexibility === "exact"} />
            <span className="text-muted-foreground">–</span>
            <Input aria-label="Window ends" type="time" value={latest} onChange={(e) => setLatest(e.target.value)} disabled={!REQUESTS_ACTIVE || flexibility === "exact"} />
          </div>
          <p className="text-xs text-muted-foreground">We can confirm a time at any point within this window if your exact requested time isn't available.</p></div>
        <div className="space-y-1.5"><Label>Flexibility</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="h-auto whitespace-normal py-2 normal-case tracking-normal text-xs" variant={flexibility === "window" ? "default" : "outline"} onClick={() => setFlexibility("window")}>Flexible within my window</Button>
            <Button type="button" className="h-auto whitespace-normal py-2 normal-case tracking-normal text-xs" variant={flexibility === "exact" ? "default" : "outline"} onClick={() => setFlexibility("exact")}>Only at my preferred time</Button>
          </div></div>
        <div className="space-y-1.5"><Label htmlFor="pt-note">Notes (optional)</Label>
          <Textarea id="pt-note" maxLength={PT_REQUEST_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any additional details (e.g., focus areas, preferences, or scheduling context)" />
          <p className="text-right text-xs text-muted-foreground">{note.length} / {PT_REQUEST_NOTE_MAX}</p></div>
        {REQUESTS_ACTIVE && date && problem && <p className="text-sm text-destructive">{problem}</p>}
        <Button className="w-full" size="lg" disabled aria-disabled="true">{REQUESTS_ACTIVE ? "Request Session" : "Coming Soon"}</Button>
      </fieldset>
    </div>
  );
}

function RequestCard({ r }: { r: MyPTRequest }) {
  const offered = r.request_status === "alternate_offered" && r.alt_date;
  return (
    <InfoCard icon={CalendarDays} title={offered ? "New Time Offered — Awaiting Your Reply" : "Requested — Awaiting Confirmation"}>
      <p className="text-sm">{r.preferred_date ? day(r.preferred_date) : "Date to be set"}</p>
      <p className="text-xs text-muted-foreground">
        {clock(r.preferred_time)}{r.flexibility === "window" && r.earliest_time ? ` (Window: ${clock(r.earliest_time)} – ${clock(r.latest_time)})` : r.flexibility === "exact" ? " (Exact time only)" : ""}
      </p>
      <p className="text-xs text-muted-foreground">Trainer: {r.trainer ? `${r.trainer} (Preferred)` : "Any trainer"}</p>
      {offered && <p className="text-xs pt-1">Offered: <strong>{day(r.alt_date)} at {clock(r.alt_time)}</strong>{r.alt_trainer ? ` with ${r.alt_trainer}` : ""}. Contact us to accept.</p>}
    </InfoCard>
  );
}

export function MyPersonalTraining() {
  const { data, isLoading } = useMyPTPortal();
  const { data: requests = [] } = useMyPTRequests();
  const [tab, setTab] = useState("overview");
  const [showPackages, setShowPackages] = useState(false);
  const trainers = useMemo(() => Array.from(new Set((data?.appointments ?? []).map((a) => a.trainer).filter(Boolean))), [data]);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const upcoming = upcomingPT(data);
  const past = data.appointments.filter((a) => !upcoming.includes(a));
  const active = data.passes.filter((p) => p.status === "active");
  const main = active[0];
  const nextInstallment = data.installments
    .filter((i) => !["paid", "void", "cancelled", "refunded"].includes(i.status))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const next = upcoming[0];

  const apptList = (list: Appt[], empty: string) => list.length === 0
    ? <p className="text-sm text-muted-foreground">{empty}</p>
    : <div className="space-y-2">{list.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/50">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{sessionName(a)}</p>
            <p className="text-xs text-muted-foreground">{format(parseISO(a.starts_at), "EEE, MMM d, yyyy")} · {apptTime(a)}{a.trainer ? ` · with ${a.trainer}` : ""}</p>
          </div>
          <Badge variant="outline">{label(a.status)}</Badge>
        </div>))}</div>;

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 h-auto rounded-full p-1">
        <TabsTrigger value="overview" className="rounded-full text-xs sm:text-sm">Overview</TabsTrigger>
        <TabsTrigger value="request" className="rounded-full text-xs sm:text-sm">Request Session</TabsTrigger>
        <TabsTrigger value="requests" className="rounded-full text-xs sm:text-sm whitespace-normal leading-tight">Requests + Upcoming</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-3">
        <InfoCard icon={CalendarDays} title="Next Confirmed Session" onClick={next ? () => setTab("requests") : undefined}>
          {next ? <>
            <p className="text-xl font-semibold">{format(parseISO(next.starts_at), "EEE, MMM d")}</p>
            <p className="text-sm">{apptTime(next)}</p>
            {next.trainer && <p className="text-xs text-muted-foreground">with {next.trainer}</p>}
          </> : <p className="text-sm text-muted-foreground">None scheduled</p>}
        </InfoCard>
        <InfoCard icon={Layers} title="Sessions Remaining">
          {main ? <p><span className="text-3xl font-semibold">{main.sessions_remaining}</span> <span className="text-sm text-muted-foreground">of {main.sessions_total}</span></p>
            : <p className="text-sm text-muted-foreground">No active package</p>}
        </InfoCard>

        <h3 className="text-base font-semibold pt-2">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon={CalendarDays} title="Request Session" onClick={() => setTab("request")}>{null}</InfoCard>
          <InfoCard icon={Package} title="View Package" onClick={() => setShowPackages(true)}>{null}</InfoCard>
        </div>

        {main && <Card><CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" />Package Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{main.pack_name}</p>
            <p className="text-xs text-muted-foreground pb-2">{PT_FORMAT_LABEL[main.format as keyof typeof PT_FORMAT_LABEL] ?? label(main.format)}</p>
            <Row k="Sessions used" v={main.sessions_total - main.sessions_remaining} />
            <Row k="Sessions remaining" v={main.sessions_remaining} />
            <Row k="Package expires" v={day(main.expires_at)} />
          </CardContent></Card>}

        <InfoCard icon={CreditCard} title="Next PT Payment" onClick={nextInstallment ? () => setShowPackages(true) : undefined}>
          {nextInstallment ? <><p className="text-xl font-semibold">{money(nextInstallment.amount_cents)}</p><p className="text-xs text-muted-foreground">Due {day(nextInstallment.due_date)}{nextInstallment.card_last4 ? ` · autopay ${nextInstallment.card_brand ?? "card"} ${nextInstallment.card_last4}` : ""}</p></>
            : <p className="text-sm text-muted-foreground">None scheduled</p>}
        </InfoCard>

        <Collapsible open={showPackages} onOpenChange={setShowPackages}>
          <CollapsibleTrigger asChild><Button variant="ghost" className="w-full justify-between">Packages & payment history <ChevronRight className={`h-4 w-4 transition-transform ${showPackages ? "rotate-90" : ""}`} /></Button></CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {data.passes.length === 0 && <p className="text-sm text-muted-foreground">No packages yet.</p>}
            {data.passes.map((p) => {
              const plan = data.installments.filter((i) => i.pass_id === p.id);
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">{p.pack_name}</CardTitle>
                    <Badge variant={p.status === "active" ? "default" : "secondary"}>{label(p.status)}</Badge>
                  </CardHeader>
                  <CardContent>
                    <Row k="Sessions purchased" v={p.sessions_total} />
                    <Row k="Sessions remaining" v={p.sessions_remaining} />
                    <Row k="Purchased" v={day(p.purchased_at)} />
                    <Row k="Expires" v={day(p.expires_at)} />
                    <Row k="Package price" v={money(p.price_cents)} />
                    <Row k="Amount paid" v={money(p.amount_paid_cents)} />
                    <Row k="Remaining balance" v={money(p.amount_outstanding_cents ?? 0)} />
                    {plan.length > 0 && (
                      <div className="pt-3">
                        <p className="text-xs font-medium pb-1">{p.plan_name || "Payment plan"}</p>
                        {plan.map((i) => (
                          <div key={i.id} className="flex justify-between text-xs py-1 border-t border-border">
                            <span>#{i.installment_number} · {day(i.due_date)}</span>
                            <span>{money(i.amount_cents)} · {label(i.status)}{i.card_last4 ? ` · ${i.card_brand ?? "Card"} ${i.card_last4}` : ""}</span>
                          </div>))}
                      </div>)}
                  </CardContent>
                </Card>);
            })}
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Payment history</CardTitle></CardHeader>
              <CardContent>
                {data.payments.length === 0 && data.refunds.length === 0
                  ? <p className="text-sm text-muted-foreground">No payments recorded.</p>
                  : <>
                    {data.payments.map((m) => <Row key={m.id} k={`${day(m.paid_at)} · ${m.method ? label(m.method) : "Payment"}`} v={`${money(m.amount_cents)} · ${label(m.status)}${m.refunded_cents ? ` (refunded ${money(m.refunded_cents)})` : ""}`} />)}
                    {data.refunds.map((r) => <Row key={r.id} k={`${day(r.refunded_at)} · Refund`} v={`-${money(r.amount_cents)}`} />)}
                  </>}
              </CardContent></Card>
            <Card><CardContent className="py-4 space-y-1">
              <p className="text-sm font-medium">Training programs, Progress, Messages & Documents</p>
              <Badge variant="secondary">Coming Soon</Badge>
            </CardContent></Card>
          </CollapsibleContent>
        </Collapsible>
      </TabsContent>

      <TabsContent value="request"><RequestForm trainers={trainers} /></TabsContent>

      <TabsContent value="requests" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Requests + Upcoming</h2>
          <p className="text-sm text-muted-foreground">Track your PT session requests and confirmed sessions.</p>
        </div>
        <section className="space-y-2"><h3 className="text-base font-semibold">Requested</h3>
          {requests.length === 0 ? <p className="text-sm text-muted-foreground">No pending requests.</p> : requests.map((r) => <RequestCard key={r.id} r={r} />)}
        </section>
        <section className="space-y-2"><h3 className="text-base font-semibold">Confirmed</h3>{apptList(upcoming, "No upcoming sessions.")}</section>
        <Notice>If the exact requested time is unavailable, Storm may confirm a different time within the submitted time window and notify you by portal, email, and text.</Notice>
        <section className="space-y-2"><h3 className="text-base font-semibold">Past sessions</h3>{apptList(past, "No past sessions yet.")}</section>
      </TabsContent>
    </Tabs>
  );
}
