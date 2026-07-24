import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2, Gift, CheckCircle2, Copy, Eye, CalendarClock } from "lucide-react";
import { GiftCardPreview } from "@/components/gift-cards/GiftCardPreview";

type PaymentMethod = "card_on_file" | "cash" | "clover" | "external";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    user_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    stripe_customer_id?: string | null;
  };
  onSuccess?: () => void;
}

const PRESETS = [25, 50, 75, 100, 150, 200];

export function SellGiftCardDialog({ open, onOpenChange, member, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const memberName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();

  const [amount, setAmount] = useState<number>(50);
  const [isGift, setIsGift] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card_on_file");
  const [paymentReference, setPaymentReference] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(addMonths(new Date(), 12));
  const [notes, setNotes] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [showPreview, setShowPreview] = useState(false);

  const scheduledSendAt = (() => {
    if (!scheduleEnabled || !scheduleDate) return undefined;
    const [h, m] = scheduleTime.split(":").map((n) => parseInt(n, 10));
    const d = new Date(scheduleDate);
    d.setHours(h || 9, m || 0, 0, 0);
    return d;
  })();

  const [issued, setIssued] = useState<{ code: string; amount: number } | null>(null);

  const effectiveRecipientName = isGift ? recipientName.trim() : memberName;
  const effectiveRecipientEmail = isGift ? recipientEmail.trim() : (member.email || "");

  const sellMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveRecipientName) throw new Error("Recipient name required");
      if (!effectiveRecipientEmail) throw new Error("Recipient email required");
      const amountCents = Math.round(amount * 100);
      if (amountCents < 500) throw new Error("Amount must be at least $5");

      let ref = paymentReference.trim() || undefined;

      // 1) Charge the card on file via the existing stripe-payment path.
      if (paymentMethod === "card_on_file") {
        if (!member.id) throw new Error("Member required for card on file charge");
        const chargeBody: any = {
          action: "charge_saved_card_with_3ds",
          amount: amountCents,
          description: `Gift card for ${effectiveRecipientName}`,
          chargeType: "gift_card",
          payment_type: "gift_card",
          note: `Gift card $${amount.toFixed(2)} to ${effectiveRecipientName} <${effectiveRecipientEmail}>`,
          memberId: member.id,
          recipientEmail: member.email || undefined,
          recipientName: memberName || undefined,
        };
        const { data: charge, error: chargeErr } = await supabase.functions.invoke("stripe-payment", {
          body: chargeBody,
        });
        if (chargeErr) throw chargeErr;
        if (!charge?.success) throw new Error(charge?.error || "Card charge failed");
        ref = charge?.payment_intent_id || charge?.charge_id || ref;
      }

      // 2) Create the gift card row + send delivery email.
      const { data, error } = await supabase.functions.invoke("create-gift-card", {
        body: {
          purchaserMemberId: member.id,
          purchaserUserId: member.user_id || undefined,
          purchaserName: memberName || undefined,
          purchaserEmail: member.email || undefined,
          recipientName: effectiveRecipientName,
          recipientEmail: effectiveRecipientEmail,
          customMessage: customMessage.trim() || undefined,
          amountCents,
          paymentMethod,
          paymentReference: ref,
          expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
          scheduledSendAt: scheduledSendAt ? scheduledSendAt.toISOString() : undefined,
          notes: notes.trim() || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create gift card");

      return { code: data.code as string, amount };
    },
    onSuccess: (result) => {
      setIssued(result);
      const msg = scheduledSendAt
        ? `Gift card ${result.code} scheduled for ${format(scheduledSendAt, "PPP 'at' p")}`
        : `Gift card ${result.code} sent to ${effectiveRecipientEmail}`;
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail"] });
      queryClient.invalidateQueries({ queryKey: ["member-gift-cards"] });
      queryClient.invalidateQueries({ queryKey: ["portal-gift-cards"] });
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reset = () => {
    setAmount(50);
    setIsGift(true);
    setRecipientName("");
    setRecipientEmail("");
    setCustomMessage("");
    setPaymentMethod("card_on_file");
    setPaymentReference("");
    setExpiresAt(addMonths(new Date(), 12));
    setNotes("");
    setIssued(null);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Sell Gift Card
          </DialogTitle>
          <DialogDescription>
            Charge {memberName || "this member"} and email a gift card to the recipient.
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Gift card issued</div>
              <div className="mt-1 text-3xl font-bold">${issued.amount.toFixed(2)}</div>
            </div>
            <div className="mx-auto inline-flex items-center gap-2 rounded-md border bg-muted px-4 py-3">
              <code className="text-lg font-semibold tracking-widest">{issued.code}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(issued.code);
                  toast.success("Code copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Delivery email sent to <strong>{effectiveRecipientEmail}</strong>.
            </p>
            <DialogFooter>
              <Button onClick={close} className="w-full">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Amount</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={amount === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAmount(p)}
                    >
                      ${p}
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={5}
                  step={5}
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="h-12 text-lg font-semibold"
                />
              </div>

              {/* Recipient */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">This is a gift for someone else</div>
                  <div className="text-xs text-muted-foreground">
                    {isGift ? "Enter their name & email" : `Will be sent to ${member.email || "the member"}`}
                  </div>
                </div>
                <Switch checked={isGift} onCheckedChange={setIsGift} />
              </div>

              {isGift && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Recipient Name *</Label>
                    <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Recipient Email *</Label>
                    <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="name@example.com" />
                  </div>
                </>
              )}

              {/* Custom Message */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Custom Message (optional)</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Happy birthday! Enjoy some pampering on me."
                  rows={3}
                  maxLength={500}
                />
                <div className="text-right text-xs text-muted-foreground">{customMessage.length}/500</div>
              </div>

              {/* Payment method */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card_on_file" disabled={!member.stripe_customer_id}>
                      Charge card on file{!member.stripe_customer_id ? " (no card)" : ""}
                    </SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="clover">Clover</SelectItem>
                    <SelectItem value="external">External / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod !== "card_on_file" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Reference (optional)</Label>
                  <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Clover txn ID, cash drawer #, etc." />
                </div>
              )}

              {/* Expiration */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Expiration (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expiresAt ? format(expiresAt, "PPP") : "No expiration"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiresAt}
                      onSelect={setExpiresAt}
                      className={cn("p-3 pointer-events-auto")}
                    />
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpiresAt(undefined)}>
                        Clear expiration
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Internal Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Staff-only notes" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={sellMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => sellMutation.mutate()}
                disabled={
                  sellMutation.isPending
                  || !amount
                  || (isGift && (!recipientName.trim() || !recipientEmail.trim()))
                }
              >
                {sellMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Processing…</>
                ) : (
                  <><Gift className="h-4 w-4 mr-1" /> Sell ${amount.toFixed(2)} Gift Card</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
