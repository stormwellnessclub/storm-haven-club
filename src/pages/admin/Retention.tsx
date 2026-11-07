import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, X, Loader2 } from "lucide-react";
import {
  computeAll, cohorts, weeklyTrend, suggestedOpener, SEGMENT_LABEL, KIND_LABEL, daysBetween,
  type MemberRetention, type RetentionMember, type Segment, type Visit,
} from "@/lib/retention";

const today = () => formatInTimeZone(new Date(), "America/Detroit", "yyyy-MM-dd");
const SEG_ORDER: Segment[] = ["at_risk", "gone_quiet", "never_started", "slipping", "steady", "thriving", "new", "frozen"];
const SEG_TONE: Record<Segment, string> = {
  at_risk: "bg-destructive/15 text-destructive", gone_quiet: "bg-destructive/10 text-destructive",
  never_started: "bg-accent text-accent-foreground", slipping: "bg-secondary text-secondary-foreground",
  steady: "bg-muted text-muted-foreground", thriving: "bg-primary/15 text-primary",
  new: "bg-muted text-muted-foreground", frozen: "bg-muted text-muted-foreground",
};
const OUTCOMES = ["reached", "left_message", "coming_back", "wants_to_cancel", "no_answer"];
const outcomeLabel = (o: string) => o.replace(/_/g, " ");

async function fetchVisits(): Promise<Visit[]> {
  const all: Visit[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.rpc("admin_retention_visits", { p_days: 365 }).range(from, from + 999);
    if (error) throw error;
    all.push(...((data ?? []) as Visit[]));
    if (!data || data.length < 1000) break;
  }
  return all;
}

export default function Retention() {
  const { hasAnyRole, loading } = useUserRoles() as any;
  const allowed = !loading && hasAnyRole?.(["super_admin", "admin", "manager"]);
  const t = today();
  const qc = useQueryClient();
  const { toast } = useToast();

  const membersQ = useQuery({
    queryKey: ["retention-members"], enabled: !!allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("members")
        .select("id, first_name, last_name, email, phone, membership_type, status, membership_start_date, activated_at")
        .neq("status", "cancelled").limit(5000);
      if (error) throw error;
      return (data ?? []) as RetentionMember[];
    },
  });
  const visitsQ = useQuery({ queryKey: ["retention-visits"], enabled: !!allowed, queryFn: fetchVisits });
  const outreachQ = useQuery({
    queryKey: ["retention-outreach"], enabled: !!allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("retention_outreach").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const visits = visitsQ.data ?? [];
  const members = membersQ.data ?? [];
  const rows = useMemo(() => computeAll(members, visits, t), [members, visits, t]);
  const [selected, setSelected] = useState<string | null>(null);
  const [segFilter, setSegFilter] = useState<string>("risk");
  const [tier, setTier] = useState<string>("all");
  const [search, setSearch] = useState("");

  const tiers = Array.from(new Set(rows.map((r) => r.member.membership_type).filter(Boolean))) as string[];
  const filtered = rows.filter((r) => {
    if (segFilter === "risk" && !["at_risk", "gone_quiet", "never_started", "slipping"].includes(r.segment)) return false;
    if (segFilter !== "risk" && segFilter !== "all" && r.segment !== segFilter) return false;
    if (tier !== "all" && r.member.membership_type !== tier) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${r.member.first_name} ${r.member.last_name} ${r.member.email}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const scored = rows.filter((r) => r.segment !== "frozen");
  const counts = SEG_ORDER.map((s) => ({ s, n: rows.filter((r) => r.segment === s).length }));
  const visited7 = scored.filter((r) => r.visits7 > 0).length;
  const visited30 = scored.filter((r) => r.visits30 > 0).length;
  const avgWeekly = scored.length ? scored.reduce((a, r) => a + r.visits30, 0) / scored.length / (30 / 7) : 0;
  const trend = useMemo(() => weeklyTrend(visits, t), [visits, t]);
  const maxTrend = Math.max(1, ...trend.map((w) => w.visits));
  const cohortRows = useMemo(() => cohorts(members, visits, t), [members, visits, t]);

  const visitsByMember = useMemo(() => {
    const m = new Map<string, Visit[]>();
    visits.forEach((v) => { const a = m.get(v.member_id) ?? []; a.push(v); m.set(v.member_id, a); });
    return m;
  }, [visits]);
  const outreach = outreachQ.data ?? [];
  const outreachWithResult = outreach.map((o: any) => {
    const day = formatInTimeZone(new Date(o.created_at), "America/Detroit", "yyyy-MM-dd");
    const back = (visitsByMember.get(o.member_id) ?? []).some((v) => v.visit_day > day && daysBetween(day, v.visit_day) <= 14);
    const pending = daysBetween(day, t) < 14 && !back;
    return { ...o, day, back, pending };
  });
  const decided = outreachWithResult.filter((o) => !o.pending);
  const backRate = decided.length ? Math.round((decided.filter((o) => o.back).length / decided.length) * 100) : null;
  const memberName = (id: string) => { const m = members.find((x) => x.id === id); return m ? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() : "Member"; };

  const sel = rows.find((r) => r.member.id === selected) ?? null;

  if (loading) return <AdminLayout><div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div></AdminLayout>;
  if (!allowed) return <AdminLayout><div className="p-8 text-muted-foreground">Retention is available to managers and admins only.</div></AdminLayout>;

  const isLoading = membersQ.isLoading || visitsQ.isLoading;

  return (
    <AdminLayout>
      <div className="flex gap-4 p-4 md:p-6">
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Retention</h1>
            <p className="text-sm text-muted-foreground">Who's coming in, who's slipping, and who needs a personal call. Visits include club check-ins, classes, PT, spa and recovery, counted once per day.</p>
          </div>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : visitsQ.error ? (
            <p className="text-sm text-destructive">Couldn't load visits: {(visitsQ.error as Error).message}</p>
          ) : (
          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list">At-risk list</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="cohorts">Join groups</TabsTrigger>
              <TabsTrigger value="outreach">Outreach results</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[["Members tracked", scored.length], ["Visited last 7 days", visited7], ["Visited last 30 days", visited30], ["Avg visits / member / week", avgWeekly.toFixed(1)]].map(([l, v]) => (
                  <Card key={l as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-semibold">{v}</div></CardContent></Card>
                ))}
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Member groups</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {counts.map(({ s, n }) => (
                    <button key={s} onClick={() => { setSegFilter(s); (document.querySelector('[value="list"]') as HTMLElement)?.click(); }}
                      className={`rounded-md px-3 py-2 text-sm ${SEG_TONE[s]}`}>
                      {SEGMENT_LABEL[s]} <span className="font-semibold">{n}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Visits per week (last 12 weeks)</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex h-40 items-end gap-1">
                    {trend.map((w) => (
                      <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1" title={`${w.visits} visits · ${w.uniqueMembers} members`}>
                        <span className="text-[10px] text-muted-foreground">{w.visits}</span>
                        <div className="w-full rounded-t bg-primary" style={{ height: `${(w.visits / maxTrend) * 120}px` }} />
                        <span className="text-[10px] text-muted-foreground">{w.weekStart}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="list" className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
                <Select value={segFilter} onValueChange={setSegFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk">Needs attention</SelectItem>
                    <SelectItem value="all">Everyone</SelectItem>
                    {SEG_ORDER.map((s) => <SelectItem key={s} value={s}>{SEGMENT_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tiers</SelectItem>
                    {tiers.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="self-center text-sm text-muted-foreground">{filtered.length} members</span>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr><th className="p-2">Member</th><th className="p-2">Group</th><th className="p-2">Why</th><th className="p-2">Last visit</th><th className="p-2">Usual / wk</th><th className="p-2">Last 14d</th><th className="p-2">Risk</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.member.id} onClick={() => setSelected(r.member.id)}
                        className={`cursor-pointer border-t hover:bg-muted/40 ${selected === r.member.id ? "bg-muted/60" : ""}`}>
                        <td className="p-2"><div className="font-medium">{r.member.first_name} {r.member.last_name}</div><div className="text-xs text-muted-foreground">{r.member.membership_type}</div></td>
                        <td className="p-2"><span className={`rounded px-2 py-0.5 text-xs ${SEG_TONE[r.segment]}`}>{SEGMENT_LABEL[r.segment]}</span></td>
                        <td className="p-2 text-muted-foreground">{r.reason}</td>
                        <td className="p-2">{r.lastVisit ? `${r.daysSinceLast}d ago` : "Never"}</td>
                        <td className="p-2">{r.baselinePerWeek.toFixed(1)}</td>
                        <td className="p-2">{r.visits14}</td>
                        <td className="p-2 font-semibold">{r.risk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="cohorts">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Still visiting after joining</CardTitle>
                  <p className="text-xs text-muted-foreground">Share of each join month with at least one visit in the 30 days leading up to day 30, 60 and 90. Blank means not enough time has passed.</p></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Joined</th><th className="p-2">Members</th><th className="p-2">Day 30</th><th className="p-2">Day 60</th><th className="p-2">Day 90</th></tr></thead>
                    <tbody>
                      {cohortRows.map((c) => (
                        <tr key={c.month} className="border-t">
                          <td className="p-2">{c.month}</td><td className="p-2">{c.joined}</td>
                          {[c.d30, c.d60, c.d90].map((p, i) => (
                            <td key={i} className="p-2">{p == null ? "—" : <span className={p >= 70 ? "text-primary font-medium" : p < 50 ? "text-destructive font-medium" : ""}>{p}%</span>}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="outreach" className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Outreach logged</div><div className="text-2xl font-semibold">{outreach.length}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Came back within 14 days</div><div className="text-2xl font-semibold">{backRate == null ? "—" : `${backRate}%`}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Still waiting to see</div><div className="text-2xl font-semibold">{outreachWithResult.filter((o) => o.pending).length}</div></CardContent></Card>
              </div>
              <div className="rounded-md border">
                {outreachWithResult.length === 0 && <p className="p-4 text-sm text-muted-foreground">No outreach logged yet. Open a member from the list to log a call, text or email.</p>}
                {outreachWithResult.map((o) => (
                  <button key={o.id} onClick={() => setSelected(o.member_id)} className="flex w-full items-center justify-between border-t p-3 text-left text-sm first:border-t-0 hover:bg-muted/40">
                    <span><span className="font-medium">{memberName(o.member_id)}</span> · {o.channel} · {outcomeLabel(o.outcome)}{o.note ? ` — ${o.note}` : ""}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">{o.day}
                      <Badge variant={o.back ? "default" : "outline"}>{o.back ? "Came back" : o.pending ? "Waiting" : "Not yet"}</Badge></span>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          )}
        </div>

        {sel && (
          <MemberPanel r={sel} visits={visitsByMember.get(sel.member.id) ?? []} outreach={outreachWithResult.filter((o) => o.member_id === sel.member.id)}
            onClose={() => setSelected(null)}
            onLogged={() => qc.invalidateQueries({ queryKey: ["retention-outreach"] })}
            toast={toast} />
        )}
      </div>
    </AdminLayout>
  );
}

function MemberPanel({ r, visits, outreach, onClose, onLogged, toast }: {
  r: MemberRetention; visits: Visit[]; outreach: any[]; onClose: () => void; onLogged: () => void; toast: any;
}) {
  const [channel, setChannel] = useState("call");
  const [outcome, setOutcome] = useState("reached");
  const [note, setNote] = useState("");
  const opener = suggestedOpener(r);
  const log = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("retention_outreach").insert({ member_id: r.member.id, channel, outcome, note: note.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { setNote(""); onLogged(); toast({ title: "Outreach logged" }); },
    onError: (e: Error) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });
  const kinds: Record<string, number> = {};
  visits.forEach((v) => { kinds[v.kind] = (kinds[v.kind] ?? 0) + 1; });
  const timeline = [...visits].sort((a, b) => b.visit_day.localeCompare(a.visit_day)).slice(0, 40);

  return (
    <aside className="sticky top-4 hidden max-h-[calc(100vh-2rem)] w-[380px] shrink-0 space-y-4 overflow-y-auto rounded-md border bg-card p-4 lg:block">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">{r.member.first_name} {r.member.last_name}</div>
          <div className="text-xs text-muted-foreground">{r.member.membership_type} · {r.member.status} · member {r.tenureDays} days</div>
          <div className="text-xs text-muted-foreground">{r.member.email}{r.member.phone ? ` · ${r.member.phone}` : ""}</div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs ${SEG_TONE[r.segment]}`}>{SEGMENT_LABEL[r.segment]}</span>
        <span className="text-sm text-muted-foreground">{r.reason}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded bg-muted p-2"><div className="text-lg font-semibold">{r.visits30}</div>last 30d</div>
        <div className="rounded bg-muted p-2"><div className="text-lg font-semibold">{r.baselinePerWeek.toFixed(1)}</div>usual / wk</div>
        <div className="rounded bg-muted p-2"><div className="text-lg font-semibold">{r.risk}</div>risk</div>
      </div>
      <div className="text-sm">
        <div className="font-medium">Habits</div>
        <div className="text-muted-foreground">
          {Object.keys(kinds).length ? Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`).join(" · ") : "No visits recorded"}
          {r.usualWeekday ? ` · usually ${r.usualWeekday}s` : ""}
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between"><span className="font-medium">Suggested opener</span>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(opener); toast({ title: "Copied" }); }}><Copy className="mr-1 h-3 w-3" />Copy</Button></div>
        <p className="rounded bg-muted p-2 text-muted-foreground">{opener}</p>
        <p className="text-xs text-muted-foreground">Send it from the admin messaging screens. Text and email consent rules still apply.</p>
      </div>
      <div className="space-y-2 rounded border p-3">
        <div className="text-sm font-medium">Log outreach</div>
        <div className="flex gap-2">
          <Select value={channel} onValueChange={setChannel}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["call", "text", "email", "in person"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={outcome} onValueChange={setOutcome}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{OUTCOMES.map((o) => <SelectItem key={o} value={o}>{outcomeLabel(o)}</SelectItem>)}</SelectContent></Select>
        </div>
        <Textarea placeholder="What did they say?" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <Button size="sm" onClick={() => log.mutate()} disabled={log.isPending}>Save</Button>
        {outreach.map((o) => (
          <div key={o.id} className="border-t pt-2 text-xs text-muted-foreground">{o.day} · {o.channel} · {outcomeLabel(o.outcome)}{o.note ? ` — ${o.note}` : ""} {o.back && <Badge className="ml-1">Came back</Badge>}</div>
        ))}
      </div>
      <div className="text-sm">
        <div className="mb-1 font-medium">Recent visits</div>
        {timeline.length === 0 ? <p className="text-muted-foreground">None</p> : timeline.map((v, i) => (
          <div key={i} className="flex justify-between border-t py-1 text-xs"><span>{v.visit_day}</span><span className="text-muted-foreground">{KIND_LABEL[v.kind] ?? v.kind}</span></div>
        ))}
      </div>
    </aside>
  );
}
