import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { GoogleReviewRequests } from "@/components/admin/GoogleReviewRequests";
import { EventPhotoBlockEditor } from "@/components/admin/EventPhotoBlockEditor";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowDown, ArrowUp, CalendarClock, Loader2, Mail, MessageSquare, Plus, Send, Sparkles, Trash2, AlertTriangle,
} from "lucide-react";

type Block = { type: string; [k: string]: any };
type Campaign = {
  id: string; name: string; event_tag: string; send_email: boolean; send_sms: boolean; status: string;
  subject: string; preheader: string; blocks: Block[]; sms_body: string; sms_image_url: string | null;
  audience_key: string; scheduled_at: string | null; sent_at: string | null; stats: any; last_error: string | null; updated_at: string;
};

const TZ = "America/Detroit";
const EVENT_TAGS: Record<string, string> = {
  general: "General", higher_self_society: "Higher Self Society", spa: "Spa", classes: "Classes",
  kids_care: "Kids Care", cafe: "Café", events: "Events", membership: "Membership",
};
const BLOCK_LABELS: Record<string, string> = {
  eyebrow: "Small label", heading: "Headline", text: "Paragraphs", image: "Photo", event_photo: "Event photo", cover: "Book or product cover",
  button: "Button", details: "Event details", divider: "Divider", signature: "Sign-off",
};
const newBlock = (type: string): Block => ({
  eyebrow: { type, text: "HIGHER SELF SOCIETY" }, heading: { type, text: "Headline" }, text: { type, text: "Dear {first_name},\n\nWrite your message here." },
  image: { type, url: "", alt: "" }, event_photo: { type, eventId: "", url: null, alt: "", size: "large", position: "center", source: "logo_only" }, cover: { type, url: "", title: "", author: "" }, button: { type, label: "Learn more", url: "https://stormwellnessclub.com" },
  details: { type, items: [{ label: "Date", value: "" }, { label: "Time", value: "" }] }, divider: { type }, signature: { type },
} as Record<string, Block>)[type];

const STARTER: Block[] = [newBlock("eyebrow"), newBlock("heading"), newBlock("text"), newBlock("button"), newBlock("signature")];
const statusTone: Record<string, string> = { draft: "secondary", scheduled: "default", sending: "default", sent: "outline", failed: "destructive" };

async function call(action: string, payload: any = {}) {
  const { data, error } = await supabase.functions.invoke("campaign-studio", { body: { action, ...payload } });
  if (error) throw new Error(error.message);
  if (data?.ok === false) throw new Error(data.error || "Something went wrong");
  return data;
}

function cronLabel(schedule: string) {
  const [m, h, d, mo] = schedule.split(" ").map(Number);
  if ([m, h, d, mo].some(Number.isNaN)) return schedule;
  const now = new Date(); const utc = new Date(Date.UTC(now.getUTCFullYear(), mo - 1, d, h, m));
  return formatInTimeZone(utc, TZ, "EEE MMM d, h:mm a");
}
const jobLabel = (n: string) => n.startsWith("hss-") ? `Higher Self Society: ${n.replace(/^hss-/, "").replace(/-\d{4}$/, "").replace(/-/g, " ")}` : n.replace(/-/g, " ");

export default function CampaignStudio() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id");
  const tagFilter = params.get("event") ?? "all";

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["marketing-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_campaigns").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
  });
  const { data: otherSends = [] } = useQuery({
    queryKey: ["legacy-scheduled-sends"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_scheduled_sends" as any);
      if (error) throw error;
      return (data ?? []) as { jobid: number; jobname: string; schedule: string }[];
    },
  });
  const { data: audiences } = useQuery({
    queryKey: ["campaign-audiences"], staleTime: 5 * 60_000,
    queryFn: async () => (await call("audiences")).audiences as { key: string; label: string; count: number; withPhone: number }[],
  });

  const list = campaigns.filter((c) => tagFilter === "all" || c.event_tag === tagFilter);
  const selected = campaigns.find((c) => c.id === selectedId) ?? null;
  const select = (id: string | null) => { const p = new URLSearchParams(params); id ? p.set("id", id) : p.delete("id"); setParams(p, { replace: true }); };

  const create = async () => {
    const { data, error } = await supabase.from("marketing_campaigns").insert({
      name: "New campaign", event_tag: tagFilter === "all" ? "general" : tagFilter, blocks: STARTER as any,
    } as any).select("id").single();
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    select(data.id);
  };

  const cancelLegacy = async (jobid: number) => {
    if (!confirm("Stop this scheduled send? It won't go out.")) return;
    const { error } = await supabase.rpc("admin_cancel_scheduled_send" as any, { _jobid: jobid });
    if (error) return toast.error(error.message);
    toast.success("Scheduled send stopped");
    qc.invalidateQueries({ queryKey: ["legacy-scheduled-sends"] });
  };

  const upcoming = [
    ...campaigns.filter((c) => c.status === "scheduled" && c.scheduled_at).map((c) => ({ key: c.id, at: new Date(c.scheduled_at!).getTime(), label: formatInTimeZone(c.scheduled_at!, TZ, "EEE MMM d, h:mm a"), name: c.name, id: c.id as string | null, jobid: null as number | null })),
    ...otherSends.map((j) => ({ key: `j${j.jobid}`, at: 0, label: cronLabel(j.schedule), name: jobLabel(j.jobname), id: null, jobid: j.jobid })),
  ].sort((a, b) => a.at - b.at);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl">Campaign Studio</h1>
            <p className="text-sm text-muted-foreground">Every marketing email and text, in one place.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={tagFilter} onValueChange={(v) => { const p = new URLSearchParams(params); v === "all" ? p.delete("event") : p.set("event", v); setParams(p, { replace: true }); }}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {Object.entries(EVENT_TAGS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={create} className="gap-1.5"><Plus className="h-4 w-4" />New campaign</Button>
          </div>
        </div>

        <Tabs defaultValue={params.get('tab') === 'reviews' ? 'reviews' : 'campaigns'}>
        <TabsList><TabsTrigger value="campaigns">Campaigns</TabsTrigger><TabsTrigger value="reviews">Google reviews</TabsTrigger></TabsList>
        <TabsContent value="reviews"><GoogleReviewRequests /></TabsContent>
        <TabsContent value="campaigns"><div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-lg border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium"><CalendarClock className="h-4 w-4" />Scheduled</h2>
              {upcoming.length === 0 ? <p className="text-xs text-muted-foreground">Nothing scheduled.</p> : (
                <ul className="space-y-2">
                  {upcoming.map((u) => (
                    <li key={u.key} className="flex items-start justify-between gap-2 text-sm">
                      <button className="text-left" onClick={() => u.id && select(u.id)}>
                        <div className="font-medium capitalize">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.label} (Michigan time)</div>
                      </button>
                      {u.jobid != null && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => cancelLegacy(u.jobid!)}>Stop</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-lg border bg-card">
              <div className="border-b p-3 text-sm font-medium">Campaigns</div>
              {isLoading ? <div className="p-4"><Loader2 className="h-4 w-4 animate-spin" /></div> : list.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No campaigns yet.</p>
              ) : (
                <ul className="max-h-[60vh] divide-y overflow-y-auto">
                  {list.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => select(c.id)} className={`w-full p-3 text-left hover:bg-muted/50 ${c.id === selectedId ? "bg-muted" : ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{c.name}</span>
                          <Badge variant={statusTone[c.status] as any} className="capitalize">{c.status}</Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {c.send_email && <Mail className="h-3 w-3" />}{c.send_sms && <MessageSquare className="h-3 w-3" />}
                          <span>{EVENT_TAGS[c.event_tag] ?? c.event_tag}</span>
                          <span>· {c.sent_at ? `Sent ${format(new Date(c.sent_at), "MMM d")}` : `Edited ${format(new Date(c.updated_at), "MMM d")}`}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>

          <main>
            {selected ? <Editor key={selected.id} campaign={selected} audiences={audiences ?? []} onClose={() => select(null)} /> : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-sm text-muted-foreground">
                Pick a campaign on the left, or start a new one.
                <Button variant="outline" onClick={create} className="gap-1.5"><Plus className="h-4 w-4" />New campaign</Button>
              </div>
            )}
          </main>
        </div></TabsContent></Tabs>
      </div>
    </AdminLayout>
  );
}

function Editor({ campaign, audiences, onClose }: { campaign: Campaign; audiences: { key: string; label: string; count: number; withPhone: number }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [c, setC] = useState<Campaign>(campaign);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<{ html: string; issues: string[] }>({ html: "", issues: [] });
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [busy, setBusy] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [when, setWhen] = useState(c.scheduled_at ? formatInTimeZone(c.scheduled_at, TZ, "yyyy-MM-dd'T'HH:mm") : "");
  const locked = c.status === "sent" || c.status === "sending";
  const timer = useRef<number>();

  const set = (patch: Partial<Campaign>) => { setC((p) => ({ ...p, ...patch })); setDirty(true); };
  const setBlock = (i: number, patch: any) => set({ blocks: c.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const move = (i: number, d: number) => { const b = [...c.blocks]; const [x] = b.splice(i, 1); b.splice(Math.max(0, Math.min(b.length, i + d)), 0, x); set({ blocks: b }); };

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      call("preview", { blocks: c.blocks, subject: c.subject, preheader: c.preheader, sms: c.send_sms ? c.sms_body : "" })
        .then((d) => setPreview({ html: d.html, issues: d.issues ?? [] })).catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer.current);
  }, [c.blocks, c.subject, c.preheader, c.sms_body, c.send_sms]);

  const save = async (silent = false) => {
    const { error } = await supabase.from("marketing_campaigns").update({
      name: c.name, event_tag: c.event_tag, send_email: c.send_email, send_sms: c.send_sms, subject: c.subject, preheader: c.preheader,
      blocks: c.blocks as any, sms_body: c.sms_body, sms_image_url: c.sms_image_url || null, audience_key: c.audience_key,
    } as any).eq("id", c.id);
    if (error) { toast.error(error.message); return false; }
    setDirty(false);
    qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    if (!silent) toast.success("Saved");
    return true;
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const aiWrite = () => run("ai", async () => {
    const d = (await call("ai_draft", { goal, current: c.blocks.map((b) => b.text ?? "").join("\n") })).draft;
    setSubjectOptions(d.subject_options ?? []);
    const cover = c.blocks.find((b) => b.type === "cover" || b.type === "image");
    const details = c.blocks.find((b) => b.type === "details");
    const url = c.blocks.find((b) => b.type === "button")?.url ?? "https://stormwellnessclub.com";
    set({
      name: c.name === "New campaign" ? d.name : c.name, subject: d.subject_options?.[0] ?? c.subject, preheader: d.preheader, sms_body: d.sms,
      blocks: [{ type: "eyebrow", text: d.eyebrow }, { type: "heading", text: d.heading }, ...(cover ? [cover] : []), { type: "text", text: d.body },
        ...(details ? [details] : []), { type: "button", label: d.button_label, url }, { type: "signature" }],
    });
    toast.success("Draft written. Review it before sending.");
  });

  const uploadImage = async (i: number, file: File) => run("upload", async () => {
    const path = `campaign-studio/${c.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("email-images").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = await supabase.storage.from("email-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (!data?.signedUrl) throw new Error("Upload failed");
    if (i < 0) set({ sms_image_url: data.signedUrl }); else setBlock(i, { url: data.signedUrl, source: "event_email" });
  });

  const schedule = () => run("schedule", async () => {
    if (!when) throw new Error("Pick a date and time");
    if (!(await save(true))) return;
    const at = fromZonedTime(when, TZ);
    const { error } = await supabase.rpc("arm_marketing_campaign" as any, { _id: c.id, _send_at: at.toISOString() });
    if (error) throw error;
    setC((p) => ({ ...p, status: "scheduled", scheduled_at: at.toISOString() }));
    qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    toast.success(`Scheduled for ${formatInTimeZone(at, TZ, "EEE MMM d, h:mm a")}`);
  });
  const unschedule = () => run("unschedule", async () => {
    const { error } = await supabase.rpc("disarm_marketing_campaign" as any, { _id: c.id });
    if (error) throw error;
    setC((p) => ({ ...p, status: "draft" }));
    qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    toast.success("Moved back to draft");
  });
  const sendNow = () => run("send", async () => {
    const aud = audiences.find((a) => a.key === c.audience_key);
    if (!confirm(`Send now to ${aud?.label ?? "this audience"} (${aud?.count ?? "?"} people)? Unsubscribed people and people who haven't agreed to texts are skipped automatically.`)) return;
    if (!(await save(true))) return;
    const s = (await call("send", { id: c.id })).stats;
    toast.success(`Sent: ${s.email.sent} emails, ${s.sms.sent} texts`);
    qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    setC((p) => ({ ...p, status: "sent", stats: s }));
  });
  const remove = async () => {
    if (!confirm("Delete this campaign?")) return;
    if (c.status === "scheduled") await supabase.rpc("disarm_marketing_campaign" as any, { _id: c.id });
    await supabase.from("marketing_campaigns").delete().eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    onClose();
  };

  const aud = useMemo(() => audiences.find((a) => a.key === c.audience_key), [audiences, c.audience_key]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Input value={c.name} onChange={(e) => set({ name: e.target.value })} disabled={locked} className="max-w-xs font-medium" />
        <Select value={c.event_tag} onValueChange={(v) => set({ event_tag: v })} disabled={locked}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(EVENT_TAGS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Badge variant={statusTone[c.status] as any} className="capitalize">{c.status}</Badge>
        <div className="ml-auto flex gap-2">
          {!locked && <Button variant="outline" onClick={() => save()} disabled={!dirty}>Save</Button>}
          <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete campaign"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {c.status === "sent" && c.stats?.email && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          Sent {c.sent_at && formatInTimeZone(c.sent_at, TZ, "MMM d, h:mm a")} to {c.stats.audience} people.
          Emails: {c.stats.email.sent} delivered to the mail service, {c.stats.email.skipped} skipped (unsubscribed or already sent), {c.stats.email.failed} failed.
          {c.send_sms && <> Texts: {c.stats.sms.sent} sent, {c.stats.sms.skipped} skipped (no consent or no phone), {c.stats.sms.failed} failed.</>}
        </div>
      )}
      {c.last_error && <div className="rounded-lg border border-destructive/50 p-3 text-sm text-destructive">{c.last_error}</div>}

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Tabs defaultValue="design" className="min-w-0">
          <TabsList>
            <TabsTrigger value="design">Email</TabsTrigger>
            <TabsTrigger value="sms">Text</TabsTrigger>
            <TabsTrigger value="send">Audience &amp; send</TabsTrigger>
          </TabsList>

          <TabsContent value="design" className="space-y-4">
            {!locked && (
              <div className="rounded-lg border bg-card p-3">
                <Label className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" />Write with AI</Label>
                <p className="mb-2 text-xs text-muted-foreground">Describe the goal in a sentence. It writes the email and the text in the Storm Wellness Club voice. Photos and covers you added are kept.</p>
                <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="e.g. Remind Higher Self Society members to RSVP for Dec 3, 7–9 PM, The 48 Laws of Power" />
                <Button className="mt-2 gap-1.5" onClick={aiWrite} disabled={!goal.trim() || busy === "ai"}>
                  {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Write draft
                </Button>
              </div>
            )}
            <div className="space-y-2 rounded-lg border bg-card p-3">
              <Label>Subject</Label>
              <Input value={c.subject} onChange={(e) => set({ subject: e.target.value })} disabled={locked} />
              {subjectOptions.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {subjectOptions.map((s) => <Button key={s} size="sm" variant={s === c.subject ? "default" : "outline"} className="h-auto whitespace-normal py-1 text-left text-xs" onClick={() => set({ subject: s })}>{s}</Button>)}
                </div>
              )}
              <Label>Preview line (shown after the subject in the inbox)</Label>
              <Input value={c.preheader} onChange={(e) => set({ preheader: e.target.value })} disabled={locked} />
            </div>

            <div className="space-y-2">
              {c.blocks.map((b, i) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{BLOCK_LABELS[b.type] ?? b.type}</span>
                    {!locked && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set({ blocks: c.blocks.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </div>
                  <fieldset disabled={locked} className="space-y-2">
                    {(b.type === "eyebrow" || b.type === "heading") && <Input value={b.text} onChange={(e) => setBlock(i, { text: e.target.value })} />}
                    {b.type === "text" && <><Textarea rows={6} value={b.text} onChange={(e) => setBlock(i, { text: e.target.value })} /><p className="text-xs text-muted-foreground">Leave a blank line between paragraphs. {"{first_name}"} becomes each person's first name.</p></>}
                    {(b.type === "image" || b.type === "cover") && (
                      <>
                        <Input type="file" accept="image/jpeg,image/png" onChange={(e) => e.target.files?.[0] && uploadImage(i, e.target.files[0])} />
                        <Input placeholder="or paste an image link (https://…)" value={b.url} onChange={(e) => setBlock(i, { url: e.target.value })} />
                        {b.type === "image" && <Input placeholder="Describe the photo (for screen readers)" value={b.alt ?? ""} onChange={(e) => setBlock(i, { alt: e.target.value })} />}
                        {b.type === "cover" && <div className="grid grid-cols-2 gap-2"><Input placeholder="Title" value={b.title ?? ""} onChange={(e) => setBlock(i, { title: e.target.value })} /><Input placeholder="Author" value={b.author ?? ""} onChange={(e) => setBlock(i, { author: e.target.value })} /></div>}
                      </>
                    )}
                    {b.type === "event_photo" && (
                      <EventPhotoBlockEditor block={b} onChange={(patch) => setBlock(i, patch)} onUpload={(f) => uploadImage(i, f)} />
                    )}
                    {b.type === "button" && <div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Button words" value={b.label} onChange={(e) => setBlock(i, { label: e.target.value })} /><Input placeholder="https://…" value={b.url} onChange={(e) => setBlock(i, { url: e.target.value })} /></div>}
                    {b.type === "details" && (
                      <div className="space-y-1.5">
                        {(b.items ?? []).map((it: any, k: number) => (
                          <div key={k} className="grid grid-cols-[120px_1fr_auto] gap-2">
                            <Input value={it.label} onChange={(e) => setBlock(i, { items: b.items.map((x: any, j: number) => j === k ? { ...x, label: e.target.value } : x) })} />
                            <Input value={it.value} onChange={(e) => setBlock(i, { items: b.items.map((x: any, j: number) => j === k ? { ...x, value: e.target.value } : x) })} />
                            <Button size="icon" variant="ghost" onClick={() => setBlock(i, { items: b.items.filter((_: any, j: number) => j !== k) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => setBlock(i, { items: [...(b.items ?? []), { label: "", value: "" }] })}>Add line</Button>
                      </div>
                    )}
                  </fieldset>
                </div>
              ))}
              {!locked && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(BLOCK_LABELS).map(([t, l]) => <Button key={t} size="sm" variant="outline" onClick={() => set({ blocks: [...c.blocks, newBlock(t)] })}><Plus className="mr-1 h-3 w-3" />{l}</Button>)}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sms" className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
              <Switch checked={c.send_sms} onCheckedChange={(v) => set({ send_sms: v })} disabled={locked} id="sms-on" />
              <Label htmlFor="sms-on">Also send a text</Label>
              <Switch className="ml-6" checked={c.send_email} onCheckedChange={(v) => set({ send_email: v })} disabled={locked} id="em-on" />
              <Label htmlFor="em-on">Send the email</Label>
            </div>
            <fieldset disabled={locked || !c.send_sms} className="space-y-2 rounded-lg border bg-card p-3">
              <Label>Text message</Label>
              <Textarea rows={5} value={c.sms_body} onChange={(e) => set({ sms_body: e.target.value })} />
              <p className="text-xs text-muted-foreground">{c.sms_body.length} characters. "Storm Wellness Club:" and "Reply STOP to opt out." are added automatically. Only people who agreed to texts receive it.</p>
              <Label>Picture with the text (optional)</Label>
              <Input type="file" accept="image/jpeg,image/png" onChange={(e) => e.target.files?.[0] && uploadImage(-1, e.target.files[0])} />
              <Input placeholder="or paste an image link (https://…)" value={c.sms_image_url ?? ""} onChange={(e) => set({ sms_image_url: e.target.value })} />
            </fieldset>
          </TabsContent>

          <TabsContent value="send" className="space-y-3">
            <div className="space-y-2 rounded-lg border bg-card p-3">
              <Label>Who gets it</Label>
              <Select value={c.audience_key} onValueChange={(v) => set({ audience_key: v })} disabled={locked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{audiences.map((a) => <SelectItem key={a.key} value={a.key}>{a.label} ({a.count})</SelectItem>)}</SelectContent>
              </Select>
              {aud && <p className="text-xs text-muted-foreground">{aud.count} people, {aud.withPhone} with a phone number. Cancelled members are never included. Unsubscribed people and anyone who hasn't agreed to texts are skipped automatically.</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border bg-card p-3">
                <Label>Send yourself a test email</Label>
                <Input type="email" placeholder="you@stormwellnessclub.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                <Button size="sm" variant="outline" disabled={!testEmail || busy === "te"} onClick={() => run("te", async () => { await call("test_email", { email: testEmail, subject: c.subject, preheader: c.preheader, blocks: c.blocks }); toast.success("Test email sent"); })}>
                  {busy === "te" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test email"}
                </Button>
              </div>
              <div className="space-y-2 rounded-lg border bg-card p-3">
                <Label>Send yourself a test text</Label>
                <Input type="tel" placeholder="10-digit phone" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                <Button size="sm" variant="outline" disabled={!testPhone || !c.sms_body || busy === "ts"} onClick={() => run("ts", async () => { await call("test_sms", { phone: testPhone, sms: c.sms_body, image: c.sms_image_url }); toast.success("Test text sent"); })}>
                  {busy === "ts" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test text"}
                </Button>
              </div>
            </div>
            {!locked && (
              <div className="space-y-2 rounded-lg border bg-card p-3">
                <Label>Schedule (Michigan time)</Label>
                <div className="flex flex-wrap gap-2">
                  <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-56" disabled={c.status === "scheduled"} />
                  {c.status === "scheduled" ? (
                    <Button variant="outline" onClick={unschedule} disabled={busy === "unschedule"}>Unschedule</Button>
                  ) : (
                    <Button onClick={schedule} disabled={busy === "schedule" || !when} className="gap-1.5"><CalendarClock className="h-4 w-4" />Schedule</Button>
                  )}
                  <Button variant="secondary" onClick={sendNow} disabled={busy === "send" || c.status === "scheduled"} className="gap-1.5">
                    {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send now
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Preview</span>
            <div className="flex gap-1">
              <Button size="sm" variant={device === "phone" ? "default" : "outline"} onClick={() => setDevice("phone")}>Phone</Button>
              <Button size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")}>Laptop</Button>
            </div>
          </div>
          {preview.issues.length > 0 && (
            <div className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">
              <div className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" />Brand check</div>
              {preview.issues.map((i) => <div key={i}>{i}</div>)}
            </div>
          )}
          <div className="rounded-lg border bg-muted/40 p-2">
            <div className="mb-2 rounded bg-background p-2 text-xs"><div className="font-medium">{c.subject || "No subject yet"}</div><div className="text-muted-foreground">{c.preheader}</div></div>
            <iframe title="Email preview" srcDoc={preview.html} className="mx-auto block rounded bg-background" style={{ width: device === "phone" ? 375 : "100%", height: 640, border: 0 }} />
          </div>
          {c.send_sms && c.sms_body && (
            <div className="rounded-lg border bg-card p-3 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">Text preview</div>
              {c.sms_image_url && <img src={c.sms_image_url} alt="" className="mb-2 max-h-40 rounded" />}
              <p>Storm Wellness Club: {c.sms_body.replace(/^storm wellness club:\s*/i, "")}{/reply stop/i.test(c.sms_body) ? "" : " Reply STOP to opt out."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
