import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Download, Save, Send, Clock, Users } from "lucide-react";
import { usePersonActivity } from "@/hooks/usePersonActivity";
import { AudienceFilters, DEFAULT_FILTERS, isReachable, matchesFilters, PersonActivity } from "@/lib/audience";
import { estimateCost, segments } from "@/lib/smsCosts";
import { SmsMediaPicker } from "../SmsMediaPicker";

export const SMS_PRESETS = [
  { id: "confirm", name: "Text subscription confirmation", body: "Storm Wellness Club: You're subscribed to texts from us. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out." },
  { id: "save", name: "Save our number", body: "Storm Wellness Club: Hi {{first_name}}, save this number in your contacts as \"Storm Wellness Club\" so our texts show our name. This line is for updates only and can't read replies. It only understands STOP, START and HELP. For anything else, call us at (248) 232-8487 or message us in your portal." },
];

const ACTIVITY_LABELS: Record<string, string> = {
  any: "Anything (no activity filter)", classes: "Booked classes", massage: "Booked a massage", spa: "Any spa service",
  recovery: "Used recovery", cafe: "Ordered from the café", pt: "Personal training", body_roller: "Bought Body Roller",
};

function csv(rows: PersonActivity[]) {
  const head = "Name,Email,Phone,Type,Texts allowed,Classes,Last class,Massages,Recovery,Café orders,Café spend,PT";
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((p) => [`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), p.email, p.phone, p.audience,
    isReachable(p) ? "yes" : "no", p.class_count, p.last_class_date, p.massage_count, p.recovery_count, p.cafe_count,
    Number(p.cafe_spend).toFixed(2), p.pt_count].map(esc).join(","));
  const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "text-audience.csv"; a.click();
}

export function TargetedSmsTab() {
  const qc = useQueryClient();
  const { data: people = [], isLoading, error } = usePersonActivity();
  const [f, setF] = useState<AudienceFilters>(DEFAULT_FILTERS);
  const [segmentId, setSegmentId] = useState<string>("");
  const [segName, setSegName] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("Storm Wellness Club: Hi {{first_name}}, ");
  const [media, setMedia] = useState<string[]>([]);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState(false);
  const [q, setQ] = useState("");

  const { data: classTypes = [] } = useQuery({
    queryKey: ["class-types-min"],
    queryFn: async () => (await supabase.from("class_types").select("id, name").order("name")).data ?? [],
  });
  const { data: segs = [] } = useQuery({
    queryKey: ["audience-segments"],
    queryFn: async () => (await (supabase.from as any)("audience_segments").select("*").order("name")).data ?? [],
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["targeted-sms-campaigns"],
    queryFn: async () => (await (supabase.from("sms_campaigns") as any)
      .select("id, campaign_name, status, scheduled_at, sent_at, sent_count, failed_count, skipped_count, recipient_user_ids, created_at")
      .eq("campaign_type", "targeted").order("created_at", { ascending: false }).limit(30)).data ?? [],
    refetchInterval: 20_000,
  });

  // Cancelled members never get texts (their records stay).
  const { data: cancelledEmails } = useQuery({
    queryKey: ["cancelled-member-emails"],
    queryFn: async () => {
      const out = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("members").select("email").eq("status", "cancelled").range(from, from + 999);
        for (const r of data ?? []) if (r.email) out.add(String(r.email).trim().toLowerCase());
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
  const matched = useMemo(() => people.filter((p) => matchesFilters(p, f) && !(p.audience !== "member" && cancelledEmails?.has((p.email ?? "").toLowerCase()))), [people, f, cancelledEmails]);
  const reachable = useMemo(() => {
    const seen = new Set<string>();
    return matched.filter((p) => {
      if (!isReachable(p)) return false;
      const t = (p.phone ?? "").replace(/\D/g, "").slice(-10);
      if (seen.has(t)) return false; seen.add(t); return true;
    });
  }, [matched]);
  const listed = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? matched.filter((p) => `${p.first_name} ${p.last_name} ${p.email} ${p.phone}`.toLowerCase().includes(s)) : matched).slice(0, 300);
  }, [matched, q]);

  const cost = estimateCost({ recipients: reachable.length, body, hasMedia: media.length > 0 });
  const sample = body.replace(/\{\{\s*(first_name|name)\s*\}\}/g, reachable[0]?.first_name || "Jane");
  const set = <K extends keyof AudienceFilters>(k: K, v: AudienceFilters[K]) => setF((o) => ({ ...o, [k]: v }));

  const saveSegment = async () => {
    if (!segName.trim()) return toast.error("Name the audience first.");
    const { error } = await (supabase.from as any)("audience_segments").insert({ name: segName.trim(), filters: f });
    if (error) return toast.error(error.message);
    toast.success("Audience saved."); setSegName(""); qc.invalidateQueries({ queryKey: ["audience-segments"] });
  };

  const submit = async (schedule: boolean) => {
    if (!name.trim()) return toast.error("Give the campaign a name.");
    if (!reachable.length) return toast.error("No one in this audience can receive texts.");
    if (schedule && !when) return toast.error("Pick a date and time.");
    if (!confirm(`${schedule ? "Schedule" : "Send"} this text to ${reachable.length} people?`)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms-campaign", {
        body: {
          action: schedule ? "schedule" : "send", name, body, mediaUrls: media, filters: f,
          segmentId: segmentId || undefined,
          userIds: reachable.filter((p) => p.user_id).map((p) => p.user_id),
          contacts: reachable.filter((p) => !p.user_id).map((p) => ({ phone: p.phone, first_name: p.first_name, last_name: p.last_name })),
          sendAt: schedule ? new Date(when).toISOString() : undefined,
        },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Failed");
      toast.success(schedule ? "Scheduled." : (data as any).remaining
        ? `Sent ${(data as any).sent} so far. The other ${(data as any).remaining} are going out in the background. Check Recent targeted texts below.`
        : `Sent ${(data as any).sent}, failed ${(data as any).failed}.`);
      qc.invalidateQueries({ queryKey: ["targeted-sms-campaigns"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    const { data } = await supabase.functions.invoke("send-sms-campaign", { body: { action: "cancel", campaignId: id } });
    toast[(data as any)?.ok ? "success" : "error"]((data as any)?.ok ? "Cancelled." : "Couldn't cancel.");
    qc.invalidateQueries({ queryKey: ["targeted-sms-campaigns"] });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Who gets it</CardTitle>
          <CardDescription>Members, non-members and imported contacts together. Blocked people and cancelled memberships are handled automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={segmentId || "none"} onValueChange={(v) => {
              setSegmentId(v === "none" ? "" : v);
              const s = segs.find((x: any) => x.id === v); if (s) setF({ ...DEFAULT_FILTERS, ...s.filters });
            }}>
              <SelectTrigger><SelectValue placeholder="Saved audiences" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— New audience —</SelectItem>
                {segs.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">People</Label>
              <Select value={f.who} onValueChange={(v: any) => set("who", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Everyone</SelectItem><SelectItem value="member">Members</SelectItem><SelectItem value="non_member">Non-members</SelectItem></SelectContent>
              </Select></div>
            <div><Label className="text-xs">Membership tier</Label>
              <Select value={f.tier} onValueChange={(v) => set("tier", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["all", "Silver", "Gold", "Platinum", "Diamond", "Founding"].map((t) => <SelectItem key={t} value={t}>{t === "all" ? "Any tier" : t}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label className="text-xs">Activity</Label>
              <Select value={f.activity} onValueChange={(v: any) => set("activity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ACTIVITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select></div>
            {f.activity === "classes" && <div><Label className="text-xs">Class type</Label>
              <Select value={f.classTypeId} onValueChange={(v) => set("classTypeId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Any class</SelectItem>{classTypes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>}
            {f.activity !== "any" && <>
              <div><Label className="text-xs">When</Label>
                <Select value={f.timing} onValueChange={(v: any) => set("timing", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ever">Ever</SelectItem><SelectItem value="within">In the last…</SelectItem>
                    <SelectItem value="not_within">Not in the last… (win-back)</SelectItem><SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select></div>
              {(f.timing === "within" || f.timing === "not_within") && <div><Label className="text-xs">Days</Label>
                <Input type="number" min={1} value={f.days} onChange={(e) => set("days", Number(e.target.value) || 30)} /></div>}
              {f.timing !== "never" && <div><Label className="text-xs">At least (times)</Label>
                <Input type="number" min={1} value={f.minCount} onChange={(e) => set("minCount", Number(e.target.value) || 1)} /></div>}
            </>}
            <div><Label className="text-xs">Café spend at least ($)</Label>
              <Input type="number" min={0} value={f.minCafeSpend} onChange={(e) => set("minCafeSpend", Number(e.target.value) || 0)} /></div>
          </div>

          <div className="rounded-md border p-3 text-sm">
            {isLoading ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading everyone…</span>
              : error ? <span className="text-destructive">{(error as Error).message}</span>
              : <>
                <div className="text-lg font-semibold">{reachable.length} people will get this text</div>
                <div className="text-muted-foreground text-xs">{matched.length} match · {matched.length - reachable.length} skipped (haven't agreed to texts, no phone, or same phone)</div>
              </>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowList((s) => !s)}>{showList ? "Hide list" : "View list"}</Button>
            <Button size="sm" variant="outline" onClick={() => csv(matched)}><Download className="h-4 w-4 mr-1" />Download</Button>
            <Input className="h-8 w-48" placeholder="Save audience as…" value={segName} onChange={(e) => setSegName(e.target.value)} />
            <Button size="sm" variant="outline" onClick={saveSegment}><Save className="h-4 w-4 mr-1" />Save</Button>
          </div>
          {showList && <div className="space-y-2">
            <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-96 overflow-auto border rounded">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Classes</TableHead><TableHead>Spa</TableHead><TableHead>Café</TableHead><TableHead>Texts</TableHead></TableRow></TableHeader>
                <TableBody>{listed.map((p) => (
                  <TableRow key={p.person_key}>
                    <TableCell className="text-xs"><div>{p.first_name} {p.last_name}</div><div className="text-muted-foreground">{p.phone || p.email}</div></TableCell>
                    <TableCell className="text-xs">{p.audience === "member" ? p.membership_type || "Member" : p.audience === "contact" ? "Imported" : "Non-member"}</TableCell>
                    <TableCell className="text-xs">{p.class_count}</TableCell>
                    <TableCell className="text-xs">{p.spa_count}</TableCell>
                    <TableCell className="text-xs">{p.cafe_count}</TableCell>
                    <TableCell>{isReachable(p) ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                  </TableRow>))}</TableBody>
              </Table>
            </div>
            {matched.length > 300 && <p className="text-xs text-muted-foreground">Showing 300 of {matched.length}. Download for the full list.</p>}
          </div>}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Message</CardTitle>
            <CardDescription>Use {"{{first_name}}"} for each person's first name. "Reply STOP to opt out" is recommended for promotions.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center">Ready-made:</span>
              {SMS_PRESETS.map((p) => (
                <Button key={p.id} size="sm" variant="outline" onClick={() => { setName(p.name); setBody(p.body); setF(DEFAULT_FILTERS); setSegmentId(""); }}>{p.name}</Button>
              ))}
            </div>
            <div><Label className="text-xs">Campaign name (only staff see this)</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reformer win-back, October" /></div>
            <Textarea rows={5} maxLength={1600} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>{body.length} chars · {segments(body)} segment(s) · {cost.type}</span><span>≈ {cost.formatted} total</span>
            </div>
            <SmsMediaPicker value={media} onChange={setMedia} />
            <div className="rounded-2xl bg-muted p-3 max-w-xs">
              <div className="text-[10px] text-muted-foreground mb-1">Preview</div>
              <div className="rounded-2xl bg-background px-3 py-2 text-sm whitespace-pre-wrap">{sample}</div>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <Button onClick={() => submit(false)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Send now</Button>
              <div><Label className="text-xs">Or send later (Detroit time)</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
              <Button variant="outline" onClick={() => submit(true)} disabled={busy}><Clock className="h-4 w-4 mr-1" />Schedule</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent targeted texts</CardTitle></CardHeader>
          <CardContent>
            {!campaigns.length ? <p className="text-sm text-muted-foreground">None yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead>Failed</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{campaigns.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs"><div>{c.campaign_name}</div><div className="text-muted-foreground">
                      {c.status === "scheduled" && c.scheduled_at ? `For ${format(new Date(c.scheduled_at), "MMM d, h:mm a")} · ${c.recipient_user_ids?.length ?? 0} people`
                        : c.sent_at ? format(new Date(c.sent_at), "MMM d, h:mm a") : ""}</div></TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell className="text-xs">{c.sent_count ?? 0}</TableCell>
                    <TableCell className="text-xs">{c.failed_count ?? 0}</TableCell>
                    <TableCell>{c.status === "scheduled" && <Button size="sm" variant="ghost" onClick={() => cancel(c.id)}>Cancel</Button>}</TableCell>
                  </TableRow>))}</TableBody>
              </Table>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
