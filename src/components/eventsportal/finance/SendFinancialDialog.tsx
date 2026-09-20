import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Loader2, Send, CalendarClock, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDay, money } from "@/lib/eventFinancials";

export function SendFinancialDialog({
  financial,
  invoice,
  document,
  open,
  onOpenChange,
}: {
  financial: any;
  invoice?: any | null;
  document?: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const purpose = document ? (document.kind as string) : "invoice";
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState("admin@stormwellnessclub.com");
  const [scheduleFor, setScheduleFor] = useState("");
  const [busy, setBusy] = useState(false);

  const portalUrl = `${window.location.origin}/event-portal/${financial.portal_token}`;

  useEffect(() => {
    if (!open) return;
    setTo(financial.client_email ?? "");
    if (document) {
      setSubject(`${document.kind === "contract" ? "Your agreement" : "Your proposal"} — ${financial.title ?? "Storm Wellness Club"}`);
      setMessage(
        document.kind === "contract"
          ? `Your agreement for ${financial.title ?? "your event"} is ready to review and sign in your private event portal.`
          : `Your proposal for ${financial.title ?? "your event"} is ready to review in your private event portal.`,
      );
    } else if (invoice) {
      setSubject(`${invoice.label ?? "Invoice"} — ${financial.title ?? "Storm Wellness Club"}`);
      setMessage(
        `Your ${String(invoice.label ?? "invoice").toLowerCase()} of ${money(invoice.amount_cents)} is ready in your private event portal${
          invoice.due_date ? `, due ${formatDay(invoice.due_date)}` : ""
        }.`,
      );
    }
  }, [open, invoice?.id, document?.id]);

  const record = async (status: "draft" | "scheduled" | "sent" | "failed", error?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("event_financial_communications").insert({
      financial_id: financial.id,
      invoice_id: invoice?.id ?? null,
      document_id: document?.id ?? null,
      purpose,
      to_email: to,
      reply_to: replyTo,
      subject,
      message,
      portal_url: portalUrl,
      status,
      scheduled_for: status === "scheduled" && scheduleFor ? new Date(scheduleFor).toISOString() : null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      error_message: error ?? null,
      created_by: auth.user?.id ?? null,
    });
  };

  const blockedContract = !!document && document.kind === "contract" && !document.terms_approved;

  const send = async () => {
    if (blockedContract) {
      toast.error("This agreement still uses placeholder terms and cannot be sent to a client.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-event-financial-email", {
      body: {
        financial_id: financial.id,
        invoice_id: invoice?.id ?? null,
        document_id: document?.id ?? null,
        purpose,
        to,
        reply_to: replyTo,
        subject,
        message,
      },
    });
    setBusy(false);
    if (error || data?.error) {
      await record("failed", error?.message ?? data?.error);
      toast.error(data?.error ?? "Could not send");
      return;
    }
    toast.success("Sent");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Send {document ? document.kind : "invoice"} to {financial.client_name || "the client"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="compose">
          {blockedContract && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Attorney-approved template required. This agreement still contains placeholder terms, so it cannot be
              sent to a client and the event cannot be treated as legally contracted.
            </div>
          )}
          <TabsList>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>To</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div>
                <Label>Reply-to</Label>
                <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
              </div>
              <div>
                <Label>From name</Label>
                <Input value="Storm Wellness Club" readOnly />
              </div>
              <div>
                <Label>From email</Label>
                <Input value="events@stormwellnessclub.com" readOnly />
              </div>
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div>
              <Label>Schedule for later (optional)</Label>
              <Input type="datetime-local" value={scheduleFor} onChange={(e) => setScheduleFor(e.target.value)} />
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              Client portal link: <span className="break-all">{portalUrl}</span>
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <div className="rounded-md border bg-card p-6">
              <div className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Storm Wellness Club
              </div>
              <h3 className="mt-4 font-serif text-2xl text-primary">{subject}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{message}</p>
              {invoice && (
                <div className="mt-4 rounded-md border p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{invoice.label ?? "Amount due"}</span>
                    <span className="font-medium">
                      {invoice.amount_cents - invoice.amount_paid_cents > 0
                        ? money(invoice.amount_cents - invoice.amount_paid_cents)
                        : "Paid in full"}
                    </span>
                  </div>
                  {invoice.due_date && (
                    <div className="mt-1 text-xs text-muted-foreground">Due {formatDay(invoice.due_date)}</div>
                  )}
                </div>
              )}
              <div className="mt-5 text-center">
                <span className="inline-block rounded-md bg-primary px-5 py-2 text-sm text-primary-foreground">
                  {document ? (document.kind === "contract" ? "Review and sign" : "Review your proposal") : "View and pay"}
                </span>
              </div>
              <p className="mt-5 text-center text-xs text-muted-foreground">
                Storm Wellness Club · Livonia, Michigan · (248) 232-8487
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(portalUrl);
              toast.success("Secure link copied");
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy link
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await record("draft");
              toast.success("Draft saved");
              onOpenChange(false);
            }}
          >
            <Save className="mr-2 h-4 w-4" /> Save draft
          </Button>
          <Button
            variant="outline"
            disabled={!scheduleFor}
            onClick={async () => {
              await record("scheduled");
              toast.success("Scheduled");
              onOpenChange(false);
            }}
          >
            <CalendarClock className="mr-2 h-4 w-4" /> Schedule
          </Button>
          <Button onClick={send} disabled={busy || !to || blockedContract}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
