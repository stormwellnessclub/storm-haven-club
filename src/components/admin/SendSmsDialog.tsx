import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, AlertTriangle } from "lucide-react";
import { SmsMediaPicker } from "./SmsMediaPicker";
import { estimateCost, segments } from "@/lib/smsCosts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipient: {
    userId?: string | null;
    name: string;
    phone: string | null | undefined;
    smsOptIn?: boolean | null;
  };
}

const QUICK_TEMPLATES: { label: string; value: string }[] = [
  { label: "Custom message", value: "" },
  {
    label: "Test message",
    value: "Storm Wellness Club: this is a test message. Reply STOP to opt out.",
  },
  {
    label: "Card update needed",
    value:
      "Storm: We need an updated payment method on file. Please log in at stormwellnessclub.com/member to update.",
  },
  {
    label: "Reach out — please call",
    value:
      "Storm Wellness Club: Hi! Please give us a call at the front desk when you have a moment. Thanks!",
  },
];

export function SendSmsDialog({ open, onOpenChange, recipient }: Props) {
  const [body, setBody] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const segs = segments(body);
  const cost = useMemo(
    () => estimateCost({ recipients: 1, body, hasMedia: mediaUrls.length > 0 }),
    [body, mediaUrls.length],
  );
  const hasPhone = !!recipient.phone?.trim();
  const optedIn = recipient.smsOptIn === true;

  const handleSend = async () => {
    if (!body.trim() && mediaUrls.length === 0) {
      toast.error("Add a message or an image.");
      return;
    }
    if (!hasPhone) {
      toast.error("Recipient has no phone number on file.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: { userId: recipient.userId || undefined, phone: recipient.phone },
          templateKey: "admin-custom",
          variables: { customBody: body || " " },
          idempotencyKey: `admin-${recipient.userId ?? recipient.phone}-${Date.now()}`,
          metadata: { source: "admin_send_dialog" },
          bypassConsent: true,
          mediaUrls,
        },
      });
      if (error) throw error;
      if ((data as any)?.success === false) {
        throw new Error((data as any)?.error || "Send failed");
      }
      toast.success(`${cost.type} sent.`, {
        description: (data as any)?.twilio_sid
          ? `Twilio SID: ${(data as any).twilio_sid}`
          : undefined,
      });
      setBody("");
      setMediaUrls([]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send {cost.type} to {recipient.name}
          </DialogTitle>
          <DialogDescription>
            {hasPhone ? (
              <span>
                To: <span className="font-mono">{recipient.phone}</span>
              </span>
            ) : (
              <span className="text-destructive">No phone number on file.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!optedIn && hasPhone && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This recipient has <strong>not opted in</strong>. Only send transactional service
              messages required for their account. Marketing requires opt-in (TCPA / 10DLC).
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Quick templates</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {QUICK_TEMPLATES.map((t) => (
                <Button
                  key={t.label}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setBody(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="sms-body">Message</Label>
            <Textarea
              id="sms-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={1600}
              placeholder="Type your message…"
            />
            <div className="text-xs text-muted-foreground mt-1 flex justify-between">
              <span>
                {body.length} chars · {segs} segment{segs !== 1 ? "s" : ""} · {cost.type}
              </span>
              <span>≈ {cost.perRecipientFormatted}</span>
            </div>
          </div>

          <SmsMediaPicker value={mediaUrls} onChange={setMediaUrls} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !hasPhone || (!body.trim() && mediaUrls.length === 0)}
          >
            {sending ? "Sending…" : `Send ${cost.type}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
