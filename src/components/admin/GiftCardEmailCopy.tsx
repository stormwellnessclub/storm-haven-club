import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gift, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

const TZ = "America/Detroit";

export type GiftCardEmailRow = {
  id: string;
  code: string;
  amount_cents: number;
  balance_cents?: number;
  status?: string;
  service_label: string | null;
  hide_amount?: boolean | null;
  tip_cents?: number | null;
  purchaser_name: string | null;
  purchaser_email?: string | null;
  recipient_name: string;
  recipient_email: string;
  custom_message: string | null;
  expires_at: string | null;
  email_sent_at?: string | null;
  created_at?: string;
};

const emailData = (r: GiftCardEmailRow) => ({
  name: r.recipient_name,
  recipientName: r.recipient_name,
  senderName: r.purchaser_name || "A Storm Wellness Club member",
  customMessage: r.custom_message || "",
  code: r.code,
  amount: (r.amount_cents / 100).toFixed(2),
  serviceLabel: r.service_label || "",
  hideAmount: r.hide_amount === true,
  tipCents: r.tip_cents || 0,
  expiresAt: r.expires_at,
});

export async function resendGiftCardEmail(r: GiftCardEmailRow) {
  const { error } = await supabase.functions.invoke("send-email", {
    body: { type: "gift_card_delivery", to: r.recipient_email, data: emailData(r) },
  });
  if (error) throw error;
  await supabase.from("gift_cards").update({ email_sent_at: new Date().toISOString() }).eq("id", r.id);
}

/** Shows the exact e-gift card email and lets staff resend it. */
export function GiftCardEmailDialog({
  row, open, onOpenChange,
}: { row: GiftCardEmailRow | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setLoading(true); setHtml(null);
    supabase.functions.invoke("send-email", {
      body: { preview: true, type: "gift_card_delivery", to: row.recipient_email, data: emailData(row) },
    }).then(({ data, error }) => {
      if (error) toast.error("Couldn't load email copy");
      setHtml(data?.html ?? null); setSubject(data?.subject ?? "");
    }).finally(() => setLoading(false));
  }, [open, row]);

  const resend = async () => {
    if (!row) return;
    setSending(true);
    try { await resendGiftCardEmail(row); toast.success(`Gift card email resent to ${row.recipient_email}`); }
    catch (e: any) { toast.error(e.message || "Resend failed"); }
    finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> E-gift card email</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">To:</span> {row.recipient_email}</div>
            {subject && <div><span className="text-muted-foreground">Subject:</span> {subject}</div>}
          </div>
        )}
        <div className="flex-1 min-h-[420px] rounded-md border overflow-hidden bg-muted/30">
          {loading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : html ? (
            <iframe title="Gift card email" srcDoc={html} className="h-[60vh] w-full bg-background" />
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={resend} disabled={sending || !row}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Resend email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Gift cards bought by a person (by account or email), for account pages. */
export function PurchasedGiftCardsList({ userId, email }: { userId?: string | null; email?: string | null }) {
  const [viewing, setViewing] = useState<GiftCardEmailRow | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["purchased-gift-cards", userId, email],
    enabled: !!(userId || email),
    queryFn: async () => {
      const ors = [userId ? `purchaser_user_id.eq.${userId}` : null, email ? `purchaser_email.ilike.${email}` : null]
        .filter(Boolean).join(",");
      const { data, error } = await supabase.from("gift_cards")
        .select("id, code, amount_cents, balance_cents, status, service_label, hide_amount, tip_cents, purchaser_name, purchaser_email, recipient_name, recipient_email, custom_message, expires_at, email_sent_at, created_at")
        .or(ors).neq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GiftCardEmailRow[];
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading gift cards…</div>;
  if (!data.length) return <div className="text-sm text-muted-foreground">No gift cards purchased yet.</div>;

  return (
    <div className="space-y-2">
      {data.map((g) => (
        <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 font-medium">
              <Gift className="h-4 w-4 text-primary" />
              {g.service_label || `$${(g.amount_cents / 100).toFixed(2)} gift card`}
              <Badge variant="outline">{g.status}</Badge>
            </div>
            <div className="text-muted-foreground">
              For {g.recipient_name} · sent to {g.recipient_email}
            </div>
            <div className="text-xs text-muted-foreground">
              Code <span className="font-mono">{g.code}</span>
              {g.created_at && ` · Bought ${formatInTimeZone(new Date(g.created_at), TZ, "PPP")}`}
              {g.expires_at && ` · Expires ${formatInTimeZone(new Date(g.expires_at), TZ, "PPP")}`}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setViewing(g)}>
            <Mail className="mr-1 h-3.5 w-3.5" /> View / resend email
          </Button>
        </div>
      ))}
      <GiftCardEmailDialog row={viewing} open={!!viewing} onOpenChange={(v) => !v && setViewing(null)} />
    </div>
  );
}
