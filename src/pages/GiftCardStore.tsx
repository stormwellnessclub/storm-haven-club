import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { StripeProvider } from "@/components/StripeProvider";
import { GiftCardPreview } from "@/components/gift-cards/GiftCardPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, CheckCircle2, Copy, Gift, Loader2 } from "lucide-react";

const AMOUNT_PRESETS = [50, 100, 150, 250];

const SERVICE_PRESETS = [
  { label: "60-Minute Massage", amount: 120, blurb: "A full hour of therapeutic bodywork" },
  { label: "90-Minute Massage", amount: 170, blurb: "Deep, unhurried restoration" },
  { label: "5-Class Pack", amount: 150, blurb: "Reformer, cycling or mat pilates" },
  { label: "Recovery Day Pass", amount: 60, blurb: "Sauna, salt room, cold plunge & red light" },
];

const DRAFT_KEY = "gift_card_draft_v1";

type Draft = {
  mode: "amount" | "service";
  amount: number;
  serviceLabel: string | null;
  recipientName: string;
  recipientEmail: string;
  customMessage: string;
  scheduleEnabled: boolean;
  scheduleDate?: string;
  scheduleTime: string;
};

export default function GiftCardStore() {
  const navigate = useNavigate();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [buyerName, setBuyerName] = useState("");

  const [mode, setMode] = useState<"amount" | "service">("amount");
  const [amount, setAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState("");
  const [serviceLabel, setServiceLabel] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("09:00");

  const [submitting, setSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<null | {
    code: string;
    amountCents: number;
    recipientName: string;
    scheduled: boolean;
    scheduledSendAt?: string | null;
  }>(null);

  // Restore a draft after sign-in
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      setIsAuthed(!!user);
      setCheckingAuth(false);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .maybeSingle();
        setBuyerName(
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || user.email || "",
        );
      }
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        try {
          const d = JSON.parse(raw) as Draft;
          setMode(d.mode);
          setAmount(d.amount);
          setServiceLabel(d.serviceLabel);
          setRecipientName(d.recipientName);
          setRecipientEmail(d.recipientEmail);
          setCustomMessage(d.customMessage);
          setScheduleEnabled(d.scheduleEnabled);
          setScheduleDate(d.scheduleDate ? new Date(d.scheduleDate) : undefined);
          setScheduleTime(d.scheduleTime);
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem(DRAFT_KEY);
      }
    })();
  }, []);

  const scheduledSendAt = useMemo(() => {
    if (!scheduleEnabled || !scheduleDate) return null;
    const [h, m] = scheduleTime.split(":").map((n) => parseInt(n, 10));
    const d = new Date(scheduleDate);
    d.setHours(h || 9, m || 0, 0, 0);
    return d;
  }, [scheduleEnabled, scheduleDate, scheduleTime]);

  const amountCents = Math.round(amount * 100);
  const validAmount = amount >= 25 && amount <= 1000;

  const saveDraft = () => {
    const draft: Draft = {
      mode,
      amount,
      serviceLabel,
      recipientName,
      recipientEmail,
      customMessage,
      scheduleEnabled,
      scheduleDate: scheduleDate?.toISOString(),
      scheduleTime,
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  };

  const startCheckout = async () => {
    if (!validAmount) return toast.error("Choose an amount between $25 and $1,000");
    if (!recipientName.trim()) return toast.error("Enter the recipient's name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      return toast.error("Enter a valid recipient email");
    }
    if (scheduleEnabled && (!scheduledSendAt || scheduledSendAt.getTime() <= Date.now())) {
      return toast.error("Pick a future send date and time");
    }
    if (!isAuthed) {
      saveDraft();
      toast.info("Sign in to complete your gift card purchase");
      navigate(`/auth?redirect=${encodeURIComponent("/gift-cards")}`);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-gift-card-checkout", {
        body: {
          amountCents,
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          customMessage: customMessage.trim() || undefined,
          serviceLabel: mode === "service" ? serviceLabel : undefined,
          purchaserName: buyerName || undefined,
          scheduledSendAt: scheduledSendAt ? scheduledSendAt.toISOString() : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Could not start checkout");
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
    } catch (e: any) {
      toast.error(e.message || "Could not start checkout");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setPurchased(null);
    setClientSecret(null);
    setPaymentIntentId(null);
    setRecipientName("");
    setRecipientEmail("");
    setCustomMessage("");
    setScheduleEnabled(false);
    setScheduleDate(undefined);
  };

  return (
    <Layout>
      <SEOHead
        title="Gift Cards | Storm Wellness Club"
        description="Send a Storm Wellness Club gift card by email — choose an amount or a signature service, add a personal message, and schedule the delivery date."
        path="/gift-cards"
      />

      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center md:py-20">
          <Gift className="mx-auto mb-4 h-8 w-8 text-primary" />
          <h1 className="font-serif text-4xl md:text-5xl">Give the gift of Storm</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Choose an amount or a signature service, add a personal note, and we&apos;ll email the gift card
            to them — now or on the day you choose.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10">
        {purchased ? (
          <Card className="mx-auto max-w-lg">
            <CardContent className="space-y-4 p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h2 className="text-2xl font-semibold">Gift card purchased</h2>
              <p className="text-sm text-muted-foreground">
                {purchased.scheduled
                  ? `We'll email it to ${purchased.recipientName} on ${
                      purchased.scheduledSendAt ? format(new Date(purchased.scheduledSendAt), "PPP") : "the scheduled date"
                    }.`
                  : `We just emailed it to ${purchased.recipientName}.`}
              </p>
              <div className="rounded-md border border-dashed p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gift code</div>
                <div className="mt-1 font-mono text-lg font-semibold tracking-[0.25em]">{purchased.code}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    navigator.clipboard.writeText(purchased.code);
                    toast.success("Code copied");
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy code
                </Button>
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={resetAll}>Buy another</Button>
                <Button onClick={() => navigate("/portal/gift-cards")}>Track my gift cards</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Builder */}
            <div className="space-y-6">
              {!clientSecret ? (
                <>
                  <div>
                    <div className="mb-3 flex gap-2">
                      <Button
                        variant={mode === "amount" ? "default" : "outline"}
                        size="sm"
                        onClick={() => { setMode("amount"); setServiceLabel(null); }}
                      >
                        Choose an amount
                      </Button>
                      <Button
                        variant={mode === "service" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMode("service")}
                      >
                        Gift a service
                      </Button>
                    </div>

                    {mode === "amount" ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {AMOUNT_PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => { setAmount(p); setCustomAmount(""); }}
                              className={cn(
                                "rounded-lg border p-4 text-center transition-colors",
                                amount === p && !customAmount ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                              )}
                            >
                              <div className="text-lg font-semibold">${p}</div>
                            </button>
                          ))}
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Custom amount ($25–$1,000)</Label>
                          <Input
                            type="number"
                            min={25}
                            max={1000}
                            placeholder="Enter amount"
                            value={customAmount}
                            onChange={(e) => {
                              setCustomAmount(e.target.value);
                              const n = Number(e.target.value);
                              if (Number.isFinite(n)) setAmount(n);
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {SERVICE_PRESETS.map((s) => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => { setServiceLabel(s.label); setAmount(s.amount); setCustomAmount(""); }}
                            className={cn(
                              "rounded-lg border p-4 text-left transition-colors",
                              serviceLabel === s.label ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                            )}
                          >
                            <div className="font-medium">{s.label}</div>
                            <div className="text-xs text-muted-foreground">{s.blurb}</div>
                            <div className="mt-2 text-lg font-semibold">${s.amount}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Who is it for?
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Recipient name</Label>
                        <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                      </div>
                      <div>
                        <Label>Recipient email</Label>
                        <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>Personal message (optional)</Label>
                      <Textarea
                        rows={3}
                        maxLength={500}
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Happy birthday — enjoy a day of rest on me."
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Schedule the delivery</div>
                        <div className="text-xs text-muted-foreground">
                          {scheduleEnabled ? "We'll email it on the date you pick" : "We'll email it right away"}
                        </div>
                      </div>
                      <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                    </div>
                    {scheduleEnabled && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Send date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={scheduleDate}
                                onSelect={setScheduleDate}
                                disabled={(d) => d.getTime() < Date.now() - 24 * 60 * 60 * 1000}
                                className="pointer-events-auto p-3"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Send time (ET)</Label>
                          <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={startCheckout}
                    disabled={submitting || checkingAuth}
                  >
                    {submitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…</>
                    ) : isAuthed ? (
                      `Continue to payment · $${validAmount ? amount.toFixed(2) : "0.00"}`
                    ) : (
                      "Sign in to continue"
                    )}
                  </Button>
                  {!isAuthed && !checkingAuth && (
                    <p className="text-center text-xs text-muted-foreground">
                      Your selections are saved while you sign in.
                    </p>
                  )}
                </>
              ) : (
                <StripeProvider key={clientSecret} clientSecret={clientSecret}>
                  <GiftCardPayment
                    paymentIntentId={paymentIntentId!}
                    totalCents={amountCents}
                    onBack={() => { setClientSecret(null); setPaymentIntentId(null); }}
                    onComplete={(card, scheduled) =>
                      setPurchased({
                        code: card.code,
                        amountCents: card.amount_cents,
                        recipientName: card.recipient_name,
                        scheduled,
                        scheduledSendAt: card.scheduled_send_at,
                      })
                    }
                  />
                </StripeProvider>
              )}
            </div>

            {/* Live preview */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preview
              </div>
              <GiftCardPreview
                amountCents={amountCents}
                recipientName={recipientName}
                senderName={buyerName || "You"}
                customMessage={customMessage}
                scheduledSendAt={scheduledSendAt ? scheduledSendAt.toISOString() : null}
              />
              {mode === "service" && serviceLabel && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Gifted as <strong>{serviceLabel}</strong> — the balance can be used toward anything at the club.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function GiftCardPayment({
  paymentIntentId,
  totalCents,
  onBack,
  onComplete,
}: {
  paymentIntentId: string;
  totalCents: number;
  onBack: () => void;
  onComplete: (card: any, scheduled: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/portal/gift-cards` },
        redirect: "if_required",
      });
      if (error) throw new Error(error.message || "Payment could not be completed");
      if (paymentIntent?.status !== "succeeded") throw new Error("Payment was not completed. Please try again.");

      const { data, error: confirmErr } = await supabase.functions.invoke("confirm-gift-card-purchase", {
        body: { payment_intent_id: paymentIntent.id || paymentIntentId },
      });
      if (confirmErr) throw confirmErr;
      if (!data?.success) throw new Error(data?.error || "Could not finalize the gift card");
      toast.success("Gift card purchased");
      onComplete(data.card, !!data.scheduled);
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <PaymentElement />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onBack} disabled={paying}>Back</Button>
        <Button onClick={pay} disabled={!stripe || !elements || paying}>
          {paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : `Pay $${(totalCents / 100).toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
