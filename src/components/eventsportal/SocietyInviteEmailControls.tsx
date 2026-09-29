import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Loader2, Mail, Send, RefreshCw } from "lucide-react";

const FN = "send-higher-self-society-invite";

type Recipient = { email: string; name: string; tier: string | null; status: string; already_sent: boolean };

export function SocietyInviteEmailControls() {
  const [roster, setRoster] = useState<Recipient[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("stormfitnessllc@gmail.com");
  const [testSending, setTestSending] = useState(false);
  const [confirm, setConfirm] = useState<null | "new" | "all">(null);
  const [sending, setSending] = useState(false);

  const loadRoster = async () => {
    setLoadingRoster(true);
    const { data, error } = await supabase.functions.invoke(FN, { body: { list: true } });
    if (error || !data?.ok) toast.error("Could not load the email list");
    else setRoster(data.roster);
    setLoadingRoster(false);
  };
  useEffect(() => { loadRoster(); }, []);

  const toggle = (email: string) =>
    setRemoved((prev) => {
      const n = new Set(prev);
      n.has(email) ? n.delete(email) : n.add(email);
      return n;
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? roster.filter((r) => r.name.toLowerCase().includes(q) || r.email.includes(q)) : roster;
  }, [roster, search]);

  const included = roster.filter((r) => !removed.has(r.email));
  const newCount = included.filter((r) => !r.already_sent).length;

  const loadPreview = async () => {
    setPreviewOpen(true);
    setHtml(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${s.session?.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({ preview: true }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setHtml(await res.text());
    } catch (e: any) {
      toast.error(e?.message || "Preview could not load");
      setPreviewOpen(false);
    }
  };

  const sendTest = async () => {
    setTestSending(true);
    const { data, error } = await supabase.functions.invoke(FN, { body: { testEmail: testEmail.trim() } });
    setTestSending(false);
    if (error || !data?.ok) return toast.error(data?.error || "Test send failed");
    toast.success(`Test sent to ${data.sentTo}`);
    setTestOpen(false);
  };

  const send = async (resend: boolean) => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke(FN, {
      body: { send: true, resend, excludeEmails: [...removed] },
    });
    setSending(false);
    setConfirm(null);
    if (error || !data?.ok) return toast.error(data?.error || "Send failed");
    toast.success(`Sent to ${data.queued} members${data.failed ? ` · ${data.failed} failed` : ""}`);
    loadRoster();
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="font-serif">The invitation email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Preview it, send yourself a test, then uncheck anyone you don't want to email. Only current members are
          listed — cancelled members are never included. Nothing goes out until you press send.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={loadPreview}><Eye className="h-4 w-4 mr-2" />Preview the email</Button>
          <Button size="sm" variant="outline" onClick={() => setTestOpen(true)}><Send className="h-4 w-4 mr-2" />Send a test to me</Button>
          <Button size="sm" onClick={() => setConfirm("new")} disabled={!newCount || sending}>
            <Mail className="h-4 w-4 mr-2" />Send to {newCount} member{newCount === 1 ? "" : "s"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirm("all")} disabled={!included.length || sending}>
            Send again to all {included.length} checked
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Input className="max-w-xs h-8" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-muted-foreground">
            {roster.length} members · <b>{included.length} checked</b> · {removed.size} removed
          </span>
          <Button size="sm" variant="ghost" onClick={() => setRemoved(new Set())} disabled={!removed.size}>Check everyone</Button>
          <Button size="sm" variant="ghost" onClick={loadRoster}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="max-h-96 overflow-y-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left sticky top-0">
              <tr><th className="p-2 w-10">Send</th><th className="p-2">Member</th><th className="p-2">Tier</th><th className="p-2">Status</th></tr>
            </thead>
            <tbody>
              {loadingRoster && <tr><td colSpan={4} className="p-3">Loading…</td></tr>}
              {filtered.map((r) => (
                <tr key={r.email} className={`border-t ${removed.has(r.email) ? "opacity-50" : ""}`}>
                  <td className="p-2"><Checkbox checked={!removed.has(r.email)} onCheckedChange={() => toggle(r.email)} aria-label={`Include ${r.name}`} /></td>
                  <td className="p-2"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.email}</div></td>
                  <td className="p-2">{r.tier ?? "—"}</td>
                  <td className="p-2 space-x-1">
                    {r.status === "frozen" && <Badge variant="outline">Frozen</Badge>}
                    {r.already_sent && <Badge variant="secondary">Already emailed</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm === "all" ? `Send to all ${included.length} checked members?` : `Send to ${newCount} members?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirm === "all"
                  ? "This includes people who already received it."
                  : "People who already received it are skipped."}{" "}
                {removed.size > 0 && `${removed.size} removed ${removed.size === 1 ? "person" : "people"} will not be emailed.`} This takes about a minute or two.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={sending}>Not yet</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); send(confirm === "all"); }} disabled={sending}>
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-4 border-b"><DialogTitle>Higher Self Society — email preview</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-hidden bg-muted">
              {html ? (
                <iframe title="Email preview" srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="w-full h-full bg-background" />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">One moment…</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={testOpen} onOpenChange={setTestOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send a test</DialogTitle>
              <DialogDescription>Sends the real email to one address so you can see it in an inbox.</DialogDescription>
            </DialogHeader>
            <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestOpen(false)}>Cancel</Button>
              <Button onClick={sendTest} disabled={testSending || !testEmail.trim()}>
                {testSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send the test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
