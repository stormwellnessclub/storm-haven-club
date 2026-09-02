import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Loader2, Mail, Send } from "lucide-react";

const FN = "send-closing-tonight-blast";

export function ClosingTonightBlastControls() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("stormfitnessllc@gmail.com");
  const [testSending, setTestSending] = useState(false);

  const [blasting, setBlasting] = useState(false);
  const [result, setResult] = useState<{ queued: number; skipped: number } | null>(null);

  const loadPreview = async () => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({ preview: true }),
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      setHtml(await res.text());
    } catch (e: any) {
      toast.error(e?.message || "Preview failed");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(FN, {
        body: { testEmail: testEmail.trim() },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Send failed");
      toast.success(`Test email sent to ${data.sentTo}`);
      setTestOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Test send failed");
    } finally {
      setTestSending(false);
    }
  };

  const sendBlast = async () => {
    setBlasting(true);
    try {
      const { data, error } = await supabase.functions.invoke(FN, { body: {} });
      if (error) throw error;
      setResult(data);
      toast.success(`Sent ${data.queued} emails (${data.skipped} skipped)`);
    } catch (e: any) {
      toast.error(e?.message || "Blast failed");
    } finally {
      setBlasting(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-card">
      <div>
        <h3 className="font-semibold text-base flex items-center gap-2">
          <Mail className="h-4 w-4" /> Tonight's Early Closing (9:00 PM) — Wed, Sept 2
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Urgent maintenance notice. Sends one email per active member (idempotent — re-running skips
          anyone already sent). Nothing goes out until you press Send.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={loadPreview} disabled={previewLoading}>
          {previewLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
          Preview email
        </Button>

        <Button size="sm" variant="outline" onClick={() => setTestOpen(true)}>
          <Send className="h-4 w-4 mr-2" /> Send test
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="default">
              <Mail className="h-4 w-4 mr-2" /> Send email blast
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send tonight's early closing email?</AlertDialogTitle>
              <AlertDialogDescription>
                Sends one email per active member (status = active, has email on file). Idempotent —
                re-running skips anyone already sent.
                {result && (
                  <div className="mt-3 rounded bg-muted p-2 text-xs">
                    Last run: queued {result.queued}, skipped {result.skipped}
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={blasting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={sendBlast} disabled={blasting}>
                {blasting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Send emails
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Email preview — Closing tonight at 9:00 PM</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted">
            {html ? (
              <iframe
                title="Email preview"
                srcDoc={html}
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                className="w-full h-full bg-white"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Loading preview…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Test send */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a test email</DialogTitle>
            <DialogDescription>
              Sends the real email to a single address so you can review it in an inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Recipient</Label>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)} disabled={testSending}>Cancel</Button>
            <Button onClick={sendTest} disabled={testSending || !testEmail.trim()}>
              {testSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
