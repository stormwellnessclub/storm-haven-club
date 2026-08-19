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
import { CalendarIcon, Loader2, Gift, CheckCircle2, Copy, Eye, CalendarClock, Mail } from "lucide-react";
import { GiftCardPreview } from "@/components/gift-cards/GiftCardPreview";

type PaymentMethod = "cash" | "clover" | "external" | "check" | "venmo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function IssueGiftCardDialog({ open, onOpenChange, onSuccess }: Props) {
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<number>(0);
  const [hideAmount, setHideAmount] = useState(true);
  const [serviceLabel, setServiceLabel] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("external");
  const [paymentReference, setPaymentReference] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(addMonths(new Date(), 12));
  const [notes, setNotes] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [showPreview, setShowPreview] = useState(false);
  const [emailHtml, setEmailHtml] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [issued, setIssued] = useState<{ code: string } | null>(null);

  const scheduledSendAt = (() => {
    if (!scheduleEnabled || !scheduleDate) return undefined;
    const [h, m] = scheduleTime.split(":").map((n) => parseInt(n, 10));
    const d = new Date(scheduleDate);
    d.setHours(h || 9, m || 0, 0, 0);
    return d;
  })();

  const loadEmailPreview = async () => {
    setLoadingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          preview: true,
          type: "gift_card_delivery",
          to: recipientEmail.trim() || "preview@example.com",
          data: {
            code: "PREVIEW-CODE",
            amount: amount.toFixed(2),
            serviceLabel: serviceLabel.trim(),
            hideAmount,
            recipientName: recipientName.trim() || "Recipient",
            senderName: buyerName.trim() || "A friend",
            customMessage: customMessage.trim(),
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
          },
        },
      });
      if (error) throw error;
      if (!data?.html) throw new Error("Preview unavailable");
      setEmailHtml(data.html);
      setEmailSubject(data.subject || "");
    } catch (e: any) {
      toast.error(e.message || "Could not load email preview");
    } finally {
      setLoadingEmail(false);
    }
  };

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!recipientName.trim()) throw new Error("Recipient name required");
      if (!recipientEmail.trim()) throw new Error("Recipient email required");
      if (hideAmount && !serviceLabel.trim()) throw new Error("Service description required");
      const amountCents = Math.round(amount * 100);
      if (amountCents < 100) throw new Error("Enter the value paid (at least $1) for internal tracking");

      const { data, error } = await supabase.functions.invoke("create-gift-card", {
        body: {
          purchaserName: buyerName.trim() || undefined,
          purchaserEmail: buyerEmail.trim() || undefined,
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          customMessage: customMessage.trim() || undefined,
          amountCents,
          serviceLabel: serviceLabel.trim() || undefined,
          hideAmount,
          purchaseSource: "admin",
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
          scheduledSendAt: scheduledSendAt ? scheduledSendAt.toISOString() : undefined,
          notes: notes.trim() || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create gift card");
      return { code: data.code as string };
    },
    onSuccess: (result) => {
      setIssued(result);
      toast.success(
        scheduledSendAt
          ? `Gift card ${result.code} scheduled for ${format(scheduledSendAt, "PPP 'at' p")}`
          : `Gift card ${result.code} sent to ${recipientEmail.trim()}`
      );
      queryClient.invalidateQueries({ queryKey: ["admin-gift-cards"] });
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reset = () => {
    setAmount(0);
    setHideAmount(true);
    setServiceLabel("");
    setBuyerName("");
    setBuyerEmail("");
    setRecipientName("");
    setRecipientEmail("");
    setCustomMessage("");
    setPaymentMethod("external");
    setPaymentReference("");
    setExpiresAt(addMonths(new Date(), 12));
    setNotes("");
    setScheduleEnabled(false);
    setScheduleDate(undefined);
    setEmailHtml(null);
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
            <Gift className="h-5 w-5" /> Issue Gift Card
          </DialogTitle>
          <DialogDescription>
            For gifts paid for outside the app — including buyers who aren't members.
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Gift card issued</div>
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
              {scheduledSendAt ? "Scheduled for delivery to " : "Delivery email sent to "}
              <strong>{recipientEmail.trim()}</strong>.
            </p>
            <DialogFooter>
              <Button onClick={close} className="w-full">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              {/* Gift type */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Hide dollar value from recipient</div>
                  <div className="text-xs text-muted-foreground">
                    {hideAmount ? "Email shows the service instead of a price" : "Email shows the dollar amount"}
                  </div>
                </div>
                <Switch checked={hideAmount} onCheckedChange={setHideAmount} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Service / gift description {hideAmount ? "*" : "(optional)"}
                </Label>
                <Input
                  value={serviceLabel}
                  onChange={(e) => setServiceLabel(e.target.value)}
                  placeholder="3 Ozone Sauna Sessions"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Value paid (internal tracking) *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={5}
                  value={amount || ""}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="h-11 text-base font-semibold"
                />
                <p className="text-xs text-muted-foreground">
                  Used for balance and liability tracking{hideAmount ? " — not shown in the email." : "."}
                </p>
              </div>

              {/* Buyer */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Buyer name</Label>
                  <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Who it's from" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Buyer email (optional)</Label>
                  <Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="buyer@example.com" />
                </div>
              </div>

              {/* Recipient */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Recipient name *</Label>
                  <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Recipient email *</Label>
                  <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="name@example.com" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Custom message</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Happy birthday! Enjoy some pampering on me."
                  rows={4}
                  maxLength={500}
                />
                <div className="text-right text-xs text-muted-foreground">{customMessage.length}/500</div>
              </div>

              {/* Payment record */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Payment method</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="clover">Clover</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="venmo">Venmo / Zelle</SelectItem>
                      <SelectItem value="external">External / Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Reference (optional)</Label>
                  <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Txn ID, check #, etc." />
                </div>
              </div>

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
                    <Calendar mode="single" selected={expiresAt} onSelect={setExpiresAt} className="p-3 pointer-events-auto" />
                    <div className="border-t p-2">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpiresAt(undefined)}>
                        Clear expiration
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Internal notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Staff-only notes" />
              </div>

              {/* Schedule */}
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Schedule delivery for later</div>
                    <div className="text-xs text-muted-foreground">
                      {scheduleEnabled ? "Recipient gets it on the chosen date" : "Send email immediately"}
                    </div>
                  </div>
                  <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                </div>
                {scheduleEnabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start text-left font-normal">
                          <CalendarClock className="mr-2 h-4 w-4" />
                          {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduleDate}
                          onSelect={setScheduleDate}
                          disabled={(d) => d.getTime() < Date.now() - 24 * 60 * 60 * 1000}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => setShowPreview(true)}>
                  <Eye className="mr-1 h-4 w-4" /> Preview card
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setEmailHtml(null); loadEmailPreview(); }}
                  disabled={loadingEmail}
                >
                  {loadingEmail
                    ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Loading…</>
                    : <><Mail className="mr-1 h-4 w-4" /> Preview email</>}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={issueMutation.isPending}>Cancel</Button>
              <Button
                onClick={() => issueMutation.mutate()}
                disabled={
                  issueMutation.isPending
                  || !amount
                  || !recipientName.trim()
                  || !recipientEmail.trim()
                  || (hideAmount && !serviceLabel.trim())
                  || (scheduleEnabled && (!scheduleDate || (scheduledSendAt?.getTime() ?? 0) <= Date.now()))
                }
              >
                {issueMutation.isPending
                  ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Processing…</>
                  : scheduleEnabled
                    ? <><CalendarClock className="mr-1 h-4 w-4" /> Schedule Gift Card</>
                    : <><Gift className="mr-1 h-4 w-4" /> Issue & Send</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      {/* Card preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gift Card Preview</DialogTitle>
            <DialogDescription>What the recipient will see.</DialogDescription>
          </DialogHeader>
          <GiftCardPreview
            amountCents={Math.round(amount * 100)}
            serviceLabel={serviceLabel}
            hideAmount={hideAmount}
            recipientName={recipientName || "Recipient"}
            senderName={buyerName || "A friend"}
            customMessage={customMessage}
            scheduledSendAt={scheduledSendAt?.toISOString()}
            expiresAt={expiresAt?.toISOString()}
          />
        </DialogContent>
      </Dialog>

      {/* Email preview */}
      <Dialog open={!!emailHtml} onOpenChange={(v) => !v && setEmailHtml(null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>Subject: {emailSubject}</DialogDescription>
          </DialogHeader>
          <iframe
            title="Gift card email preview"
            srcDoc={emailHtml || ""}
            className="h-[65vh] w-full rounded-md border bg-white"
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
