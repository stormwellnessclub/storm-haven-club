import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const FN = "send-harvest-moon-reminder";

export function HarvestMoonReminderControls() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("stormfitnessllc@gmail.com");
  const [testSending, setTestSending] = useState(false);

  const [sending, setSending] = useState(false);
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
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setHtml(await res.text());
    } catch (e: any) {
      toast.error(e?.message || "Preview could not load");
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
      toast.success(`Test reminder sent to ${data.sentTo}`);
      setTestOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Test send failed");
    } finally {
      setTestSending(false);
    }
  };

  const sendAll = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(FN, { body: {} });
      if (error) throw error;
      setResult(data);
      toast.success(`Reminder sent to ${data.queued} members (${data.skipped} skipped)`);
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">Reminder email — this Sunday</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          A shorter note reminding members the circle gathers this Sunday at six, whether or not
          they have already reserved. Tracked separately from the invitation.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={loadPreview} disabled={previewLoading}>
            {previewLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Preview the reminder
          </Button>

          <Button size="sm" variant="outline" onClick={() => setTestOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Send a test to me
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm">
                <Mail className="h-4 w-4 mr-2" /> Send to members
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send the reminder to members?</AlertDialogTitle>
                <AlertDialogDescription>
                  One email per current member with an address on file. Cancelled members are never
                  included, and anyone already sent this reminder is skipped if it is run again.
                  {result && (
                    <span className="mt-3 block rounded bg-muted p-2 text-xs">
                      Last run: sent {result.queued}, skipped {result.skipped}
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={sending}>Not yet</AlertDialogCancel>
                <AlertDialogAction onClick={sendAll} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Send the reminder
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-4 border-b">
              <DialogTitle>Under the Harvest Moon — reminder preview</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden bg-muted">
              {html ? (
                <iframe
                  title="Reminder preview"
                  srcDoc={html}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  className="w-full h-full bg-white"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  One moment…
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={testOpen} onOpenChange={setTestOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send a test</DialogTitle>
              <DialogDescription>
                Sends the real reminder to one address so you can see it in an inbox.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Send it to</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestOpen(false)} disabled={testSending}>
                Cancel
              </Button>
              <Button onClick={sendTest} disabled={testSending || !testEmail.trim()}>
                {testSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Send the test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
