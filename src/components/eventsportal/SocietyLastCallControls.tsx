import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, MessageSquare, RefreshCw } from "lucide-react";

const FN = "send-society-last-call";
type R = { email: string; name: string; phone: string | null; status: string; email_suppressed: boolean; email_sent: boolean; sms_sent: boolean };

const DEFAULT_HERO = "https://stormwellnessclub.com/__l5e/assets-v1/762dc417-e0d1-4d2a-ba3e-813f57319098/hss-shelf.jpg";

export function SocietyLastCallControls({ audience }: { audience?: "book_vote" } = {}) {
  const vote = audience === "book_vote";
  const [roster, setRoster] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [smsText, setSmsText] = useState("");
  const [testEmail, setTestEmail] = useState("stormfitnessllc@gmail.com");
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "email" | "sms">(null);
  const [showPreview, setShowPreview] = useState(false);
  const [heroPath, setHeroPath] = useState<string | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const uploadPhoto = async (f?: File) => {
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) { toast.error("Please pick a JPG or PNG photo"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }
    setBusy("photo");
    const path = `society-last-call/${Date.now()}.${f.type === "image/png" ? "png" : "jpg"}`;
    const { error } = await supabase.storage.from("email-images").upload(path, f, { contentType: f.type });
    setBusy(null);
    if (error) { toast.error("Photo upload didn't go through"); return; }
    setHeroPath(path); setHeroPreview(URL.createObjectURL(f)); toast.success("Photo updated");
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke(FN, { body: { list: true, audience } });
    if (data?.ok) setRoster(data.roster); else toast.error("Could not load the list");
    setLoading(false);
  };
  useEffect(() => {
    load();
    supabase.functions.invoke(FN, { body: { defaults: true, audience } }).then(({ data }) => {
      if (data?.ok) { setSubject(data.subject); setMessage(data.message); setSmsText(data.smsText); }
    });
  }, []);

  const included = roster.filter((r) => !removed.has(r.email));
  const emailCount = included.filter((r) => !r.email_sent && !r.email_suppressed).length;
  const smsCount = included.filter((r) => r.phone && !r.sms_sent).length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? roster.filter((r) => r.name.toLowerCase().includes(q) || r.email.includes(q)) : roster;
  }, [roster, search]);
  const content = { subject, message, smsText, heroPath: heroPath ?? undefined };

  const call = async (label: string, body: Record<string, unknown>) => {
    setBusy(label);
    const { data, error } = await supabase.functions.invoke(FN, { body: { ...content, audience, ...body } });
    setBusy(null);
    if (error || !data?.ok) { toast.error(data?.error || "That didn't go through"); return null; }
    return data;
  };

  const doSend = async () => {
    const kind = confirm; setConfirm(null);
    const d = await call(kind!, { [kind === "email" ? "sendEmail" : "sendSms"]: true, excludeEmails: [...removed] });
    if (!d) return;
    toast.success(kind === "email"
      ? `Emails sent: ${d.queued}. Skipped: ${d.skipped}. Failed: ${d.failed}.`
      : `Texts sent: ${d.sent}. Skipped (no consent or already sent): ${d.skipped}. Failed: ${d.failed}.`);
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{vote ? "Book vote announcement (email and text)" : "Last call (email and text)"}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {vote ? "Goes to everyone on the book club list, including approved guests. Voting closes Friday, Oct. 23 at 11:59 PM." : "Goes to active and frozen members who haven't signed up yet. Sign-ups close on their own Sunday, Oct. 18 at 11:59 PM."}
          Unsubscribed people and anyone who hasn't agreed to texts are skipped. Each person gets each message once.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email photo</label>
          <img src={heroPreview ?? DEFAULT_HERO} alt="Email photo" className="w-full max-w-sm rounded border" />
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" disabled={!!busy} asChild>
              <label className="cursor-pointer">
                {busy === "photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change photo"}
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </Button>
            {heroPath && <button type="button" className="text-sm underline text-muted-foreground" onClick={() => { setHeroPath(null); setHeroPreview(null); }}>Use original photo</button>}
          </div>
          <label className="text-sm font-medium">Email subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          <label className="text-sm font-medium">Email message</label>
          <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button size="sm" variant="ghost" onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Hide" : "Show"} email preview</Button>
          {showPreview && (
            <div className="rounded border p-4 bg-muted text-sm space-y-2">
              <p className="font-semibold">{subject}</p><p>Dear Jane,</p>
              {message.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
              <p className="text-primary">[{vote ? "Cast your vote" : "Save your seat"}]</p>
            </div>
          )}
          <div className="flex gap-2">
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="Test email" />
            <Button variant="outline" disabled={!!busy} onClick={async () => { const d = await call("te", { testEmail }); if (d) toast.success(`Test sent to ${d.sentTo}`); }}>
              {busy === "te" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Text message ({smsText.length} characters)</label>
          <Textarea rows={4} value={smsText} onChange={(e) => setSmsText(e.target.value)} />
          <div className="flex gap-2">
            <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Your phone for a test" inputMode="tel" />
            <Button variant="outline" disabled={!!busy || !testPhone} onClick={async () => { const d = await call("ts", { testSms: testPhone }); if (d) toast.success("Test text sent"); }}>
              {busy === "ts" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Recipients: {included.length} of {roster.length}</p>
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-72 overflow-auto border rounded divide-y">
            {loading ? <p className="p-3 text-sm text-muted-foreground">Loading…</p> : filtered.map((r) => (
              <label key={r.email} className="flex items-center gap-3 p-2 text-sm cursor-pointer">
                <Checkbox checked={!removed.has(r.email)} onCheckedChange={() => setRemoved((p) => { const n = new Set(p); n.has(r.email) ? n.delete(r.email) : n.add(r.email); return n; })} />
                <span className="flex-1 min-w-0 truncate">{r.name} <span className="text-muted-foreground">· {r.email}</span></span>
                {r.email_sent && <Badge variant="secondary">Emailed</Badge>}
                {r.email_suppressed && <Badge variant="outline">Unsubscribed</Badge>}
                {r.sms_sent && <Badge variant="secondary">Texted</Badge>}
                {!r.phone && <Badge variant="outline">No phone</Badge>}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button disabled={!!busy || !emailCount} onClick={() => setConfirm("email")}>
            {busy === "email" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}Send email ({emailCount})
          </Button>
          <Button disabled={!!busy || !smsCount} onClick={() => setConfirm("sms")}>
            {busy === "sms" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}Send text (up to {smsCount})
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send the {vote ? "book vote" : "last-call"} {confirm === "email" ? "email" : "text"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "email" ? `${emailCount} people will get the email.` : `Up to ${smsCount} people will get the text. Anyone who hasn't agreed to texts is skipped.`} This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doSend}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
