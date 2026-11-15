import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { PT_FORMAT_LABEL } from "@/lib/ptFormat";

/** Client-safe PT data, read only through pt_my_portal() (never raw tables with staff notes). */
interface PortalData {
  trainer: { name: string } | null;
  appointments: { id: string; starts_at: string; duration_minutes: number; status: string; format: string; session_type: string | null; trainer: string }[];
  passes: { id: string; pack_name: string; format: string; status: string; sessions_total: number; sessions_remaining: number; activated_at: string | null; expires_at: string | null; purchased_at: string | null; price_cents: number | null; amount_paid_cents: number | null; amount_outstanding_cents: number | null; plan_name: string | null; plan_status: string | null; next_payment_date: string | null }[];
  installments: { id: string; pass_id: string; installment_number: number; due_date: string; amount_cents: number; status: string; paid_at: string | null; card_brand: string | null; card_last4: string | null }[];
  payments: { id: string; amount_cents: number; refunded_cents: number | null; method: string | null; status: string; paid_at: string }[];
  refunds: { id: string; amount_cents: number; refunded_at: string }[];
  programs: { id: string; name: string; status: string | null; start_date: string | null; length_weeks: number | null }[];
}

const money = (c: number | null | undefined) => c == null ? "—" : `$${(c / 100).toFixed(2)}`;
const day = (d: string | null | undefined) => (d ? format(parseISO(d), "MMM d, yyyy") : "—");
const when = (d: string) => format(parseISO(d), "EEE, MMM d, yyyy · h:mm a");
const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const sessionName = (a: PortalData["appointments"][number]) =>
  a.session_type ?? PT_FORMAT_LABEL[a.format as keyof typeof PT_FORMAT_LABEL] ?? label(a.format);

function RequestComingSoon() {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div>
          <p className="font-medium text-sm">Request a Session</p>
          <p className="text-xs text-muted-foreground">Online session requests are coming soon. Please contact your trainer or the front desk to schedule.</p>
        </div>
        <Button size="sm" variant="outline" disabled aria-disabled="true">Coming Soon</Button>
      </CardContent>
    </Card>
  );
}

function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <Card><CardContent className="py-10 text-center space-y-1">
      <p className="font-medium">{title}</p>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-sm text-muted-foreground pt-2">{text}</p>
    </CardContent></Card>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3 text-sm py-1"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
}

export function MyPersonalTraining() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["pt-my-portal", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pt_my_portal");
      if (error) throw error;
      return data as PortalData;
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const now = Date.now();
  const upcoming = data.appointments.filter((a) => a.status === "scheduled" && parseISO(a.starts_at).getTime() >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = data.appointments.filter((a) => !upcoming.includes(a));
  const active = data.passes.filter((p) => p.status === "active");
  const remaining = active.reduce((s, p) => s + (p.sessions_remaining ?? 0), 0);
  const nextInstallment = data.installments
    .filter((i) => !["paid", "void", "cancelled", "refunded"].includes(i.status))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  const apptList = (list: PortalData["appointments"], empty: string) => list.length === 0
    ? <p className="text-sm text-muted-foreground">{empty}</p>
    : <div className="space-y-2">{list.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/50">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{sessionName(a)}</p>
            <p className="text-xs text-muted-foreground">{when(a.starts_at)} · {a.duration_minutes} min{a.trainer ? ` · ${a.trainer}` : ""}</p>
          </div>
          <Badge variant="outline">{label(a.status)}</Badge>
        </div>))}</div>;

  return (
    <div className="space-y-4">
      <RequestComingSoon />
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="billing">Packages & Billing</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="messages">Messages & Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-3">
          <Card><CardContent className="py-4">
            <Row k="Active package" v={active.map((p) => p.pack_name).join(", ") || "None"} />
            <Row k="Sessions remaining" v={remaining} />
            <Row k="Next session" v={upcoming[0] ? `${when(upcoming[0].starts_at)}` : "None scheduled"} />
            <Row k="Next payment" v={nextInstallment ? `${money(nextInstallment.amount_cents)} on ${day(nextInstallment.due_date)}` : "None scheduled"} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="schedule" className="pt-3 space-y-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Upcoming</CardTitle></CardHeader>
            <CardContent>{apptList(upcoming, "No upcoming sessions.")}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">History</CardTitle></CardHeader>
            <CardContent>{apptList(past, "No past sessions yet.")}</CardContent></Card>
        </TabsContent>

        <TabsContent value="billing" className="pt-3 space-y-4">
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
                  {data.payments.map((m) => (
                    <div key={m.id} className="flex justify-between text-sm py-1 border-t border-border first:border-t-0">
                      <span>{day(m.paid_at)} · {m.method ? label(m.method) : "Payment"}</span>
                      <span>{money(m.amount_cents)} · {label(m.status)}{m.refunded_cents ? ` (refunded ${money(m.refunded_cents)})` : ""}</span>
                    </div>))}
                  {data.refunds.map((r) => (
                    <div key={r.id} className="flex justify-between text-sm py-1 border-t border-border">
                      <span>{day(r.refunded_at)} · Refund</span><span>-{money(r.amount_cents)}</span>
                    </div>))}
                </>}
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="training" className="pt-3">
          {data.programs.length === 0
            ? <ComingSoon title="Training programs" text="Your trainer's programs and workouts will appear here." />
            : <Card><CardContent className="py-4">{data.programs.map((g) => (
                <Row key={g.id} k={g.name} v={`${g.status ? label(g.status) : ""}${g.start_date ? ` · from ${day(g.start_date)}` : ""}`} />))}</CardContent></Card>}
        </TabsContent>
        <TabsContent value="progress" className="pt-3">
          <ComingSoon title="Progress" text="Measurements and reassessments will appear here." />
        </TabsContent>
        <TabsContent value="messages" className="pt-3">
          <ComingSoon title="Messages & Documents" text="Messages and documents from your trainer will appear here." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
