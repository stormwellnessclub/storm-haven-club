import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, Heart, Gift, Loader2, Check, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { StripeProvider } from "@/components/StripeProvider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// Sale ends Sunday May 11 2026 23:59:59 CT == 2026-05-12T05:00:00Z
const SALE_END_MS = Date.parse("2026-05-12T05:00:00Z");
const PROMO_BG = "#ece2d2";
const PROMO_GOLD = "#a17e3a";
const PROMO_TAN = "#c9a86a";
const PROMO_TEXT = "#6b5a3b";

type Mode = "self" | "gift";

function PayForm({
  amountCents,
  onSuccess,
  onBack,
}: {
  amountCents: number;
  onSuccess: (intentId: string) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { error: subErr } = await elements.submit();
      if (subErr) {
        setError(subErr.message || "Please complete the payment form");
        setSubmitting(false);
        return;
      }
      const { error: payErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });
      if (payErr) {
        // Surface the exact Stripe message and always re-enable the button so a different card can be entered.
        const msg =
          payErr.message ||
          (payErr.code === "card_declined"
            ? "Your card was declined by the issuer. Please try a different card."
            : "Payment could not be completed. Please try again.");
        setError(msg);
        setSubmitting(false);
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        onSuccess(paymentIntent.id);
      } else {
        setError(
          `Payment did not complete (status: ${paymentIntent?.status ?? "unknown"}). Please try again or use a different card.`
        );
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err?.message || "Payment failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button type="submit" size="lg" disabled={submitting || !stripe} style={{ background: PROMO_GOLD }}>
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Pay ${(amountCents / 100).toFixed(2)}
        </Button>
      </div>
    </form>
  );
}

export function MothersDayClassPackSection() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const queryClient = useQueryClient();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const live = now < SALE_END_MS;

  const [mode, setMode] = useState<Mode | null>(null);
  const [open, setOpen] = useState(false);

  const [buyerFirst, setBuyerFirst] = useState("");
  const [buyerLast, setBuyerLast] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [recipFirst, setRecipFirst] = useState("");
  const [recipLast, setRecipLast] = useState("");
  const [recipEmail, setRecipEmail] = useState("");

  const [creating, setCreating] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [resolvedTier, setResolvedTier] = useState<"member" | "nonMember" | null>(null);
  const [resolvedTotalCents, setResolvedTotalCents] = useState(0);
  const [recipientIsMember, setRecipientIsMember] = useState<boolean | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<{ isGift: boolean; tier: string; expiresAt: string } | null>(null);

  // Pre-fill buyer info from profile
  useEffect(() => {
    if (user?.email && !buyerEmail) setBuyerEmail(user.email);
    if (profile?.first_name && !buyerFirst) setBuyerFirst(profile.first_name);
    if (profile?.last_name && !buyerLast) setBuyerLast(profile.last_name);
    if ((profile as any)?.phone && !buyerPhone) setBuyerPhone((profile as any).phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const openDialog = (m: Mode) => {
    setMode(m);
    setClientSecret(null);
    setPaymentIntentId(null);
    setConfirmed(null);
    setResolvedTier(null);
    setRecipientIsMember(null);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setTimeout(() => {
      setMode(null);
      setClientSecret(null);
      setPaymentIntentId(null);
      setConfirmed(null);
    }, 200);
  };

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleStart = async () => {
    if (!buyerFirst.trim() || !buyerLast.trim()) return toast.error("Please enter your name.");
    if (!isEmail(buyerEmail)) return toast.error("Please enter a valid email.");
    if (mode === "gift") {
      if (!recipFirst.trim() || !recipLast.trim()) return toast.error("Please enter the recipient's name.");
      if (!isEmail(recipEmail)) return toast.error("Please enter a valid recipient email.");
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("mothers-day-pack-create-intent", {
        body: {
          is_gift: mode === "gift",
          buyer_first_name: buyerFirst,
          buyer_last_name: buyerLast,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone || undefined,
          recipient_first_name: mode === "gift" ? recipFirst : undefined,
          recipient_last_name: mode === "gift" ? recipLast : undefined,
          recipient_email: mode === "gift" ? recipEmail : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Could not start checkout");
      setClientSecret(data.client_secret);
      setPaymentIntentId(data.payment_intent_id);
      setResolvedTier(data.tier);
      setResolvedTotalCents(data.total_cents);
      setRecipientIsMember(data.recipient_is_member);
    } catch (e: any) {
      toast.error(e.message || "Could not start checkout");
    } finally {
      setCreating(false);
    }
  };

  const handlePaid = async (intentId: string) => {
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke("mothers-day-pack-confirm", {
        body: { payment_intent_id: intentId },
      });
      if (error) throw error;
      if (data?.success) {
        setConfirmed({
          isGift: !!data.is_gift,
          tier: data.tier || resolvedTier || "nonMember",
          expiresAt: data.expires_at || "",
        });
        queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      } else {
        toast.error(data?.error || "Could not confirm payment");
      }
    } catch (e: any) {
      toast.error(e.message || "Could not confirm payment");
    } finally {
      setConfirming(false);
    }
  };

  const memberPrice = 150;
  const nonMemberPrice = 265;

  if (!live) return null;

  return (
    <section className="py-16 overflow-hidden" style={{ background: PROMO_BG }}>
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <p className="text-xs tracking-[0.4em] mb-3" style={{ color: PROMO_GOLD }}>
            LIMITED TIME
          </p>
          <h2 className="font-serif text-4xl md:text-5xl mb-4" style={{ color: PROMO_GOLD }}>
            Mother's Day Class Pack
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: PROMO_TEXT }}>
            10 studio classes — Reformer Pilates, Cycling &amp; more.
            <br />
            Treat yourself or gift it. Valid for 2 months.
          </p>
          <p className="text-sm mt-3 italic" style={{ color: PROMO_TEXT }}>
            Special ends Sunday, May 11.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="p-6 sm:p-8 text-center min-w-0" style={{ background: "#fff", borderColor: PROMO_TAN, borderWidth: 2 }}>
            <Heart className="w-8 h-8 mx-auto mb-3" style={{ color: PROMO_GOLD }} />
            <p className="text-xs tracking-[0.3em] mb-2" style={{ color: PROMO_GOLD }}>MEMBER</p>
            <div className="font-serif text-5xl mb-1" style={{ color: PROMO_GOLD }}>${memberPrice}</div>
            <p className="text-sm mb-6" style={{ color: PROMO_TEXT }}>10-Class Pack — for active Storm Wellness Club members</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => openDialog("self")} style={{ background: PROMO_GOLD }}>
                Buy for myself
              </Button>
              <Button
                variant="outline"
                onClick={() => openDialog("gift")}
                className="whitespace-normal h-auto py-2 leading-tight text-sm"
                style={{ borderColor: PROMO_TAN, color: PROMO_GOLD }}
              >
                <Gift className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="sm:hidden">Gift to a member</span>
                <span className="hidden sm:inline">Buy as a gift for a Storm Wellness Club member</span>
              </Button>
            </div>
          </Card>
          <Card className="p-6 sm:p-8 text-center min-w-0" style={{ background: "#fff", borderColor: PROMO_TAN, borderWidth: 2 }}>
            <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: PROMO_GOLD }} />
            <p className="text-xs tracking-[0.3em] mb-2" style={{ color: PROMO_GOLD }}>NON-MEMBER</p>
            <div className="font-serif text-5xl mb-1" style={{ color: PROMO_GOLD }}>${nonMemberPrice}</div>
            <p className="text-sm mb-6" style={{ color: PROMO_TEXT }}>10-Class Pack — open to everyone</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => openDialog("self")} style={{ background: PROMO_GOLD }}>
                Buy for myself
              </Button>
              <Button
                variant="outline"
                onClick={() => openDialog("gift")}
                className="whitespace-normal h-auto py-2 leading-tight text-sm"
                style={{ borderColor: PROMO_TAN, color: PROMO_GOLD }}
              >
                <Gift className="w-4 h-4 mr-2 flex-shrink-0" /> Buy as a gift
              </Button>
            </div>
          </Card>
        </div>

        <p className="text-xs text-center mt-6 max-w-xl mx-auto" style={{ color: PROMO_TEXT }}>
          Member pricing is automatically applied if the buyer or gift recipient has an active Storm Wellness Club membership — verified at checkout.
        </p>
      </div>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg">
          {confirmed ? (
            <div className="text-center py-4">
              <Check className="w-10 h-10 mx-auto mb-3" style={{ color: PROMO_GOLD }} />
              <DialogTitle className="font-serif text-2xl mb-2" style={{ color: PROMO_GOLD }}>
                You're all set!
              </DialogTitle>
              <p className="text-sm mb-4" style={{ color: PROMO_TEXT }}>
                {confirmed.isGift
                  ? `We've emailed ${recipFirst} their gift and sent your receipt.`
                  : "Your 10-class pack is active. Check your email for the receipt."}
              </p>
              {confirmed.expiresAt && (
                <p className="text-xs mb-6" style={{ color: PROMO_TEXT }}>
                  Valid through {new Date(confirmed.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              )}
              <Button onClick={closeDialog} style={{ background: PROMO_GOLD }}>Done</Button>
            </div>
          ) : confirming ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: PROMO_GOLD }} />
              <p style={{ color: PROMO_TEXT }}>Confirming your purchase…</p>
            </div>
          ) : clientSecret ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl" style={{ color: PROMO_GOLD }}>
                  Mother's Day Class Pack
                </DialogTitle>
                <DialogDescription>
                  {resolvedTier === "member" ? "Member" : "Non-Member"} pricing &middot; ${(resolvedTotalCents / 100).toFixed(2)} total (incl. processing)
                  {mode === "gift" && recipientIsMember === false && (
                    <span className="block mt-1 text-xs">Recipient is not an active member — non-member pricing applied.</span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <StripeProvider clientSecret={clientSecret}>
                <PayForm
                  amountCents={resolvedTotalCents}
                  onSuccess={handlePaid}
                  onBack={() => {
                    setClientSecret(null);
                    setPaymentIntentId(null);
                  }}
                />
              </StripeProvider>
            </div>
          ) : (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl" style={{ color: PROMO_GOLD }}>
                  {mode === "gift" ? "Send a Mother's Day Gift" : "Mother's Day Class Pack"}
                </DialogTitle>
                <DialogDescription>
                  10 studio classes &middot; Valid 2 months from purchase
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wider" style={{ color: PROMO_GOLD }}>Your info</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">First name</Label>
                    <Input value={buyerFirst} onChange={(e) => setBuyerFirst(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Last name</Label>
                    <Input value={buyerLast} onChange={(e) => setBuyerLast(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Email (for receipt)</Label>
                  <Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
                </div>

                {mode === "gift" && (
                  <>
                    <div className="text-xs uppercase tracking-wider pt-2" style={{ color: PROMO_GOLD }}>Recipient</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">First name</Label>
                        <Input value={recipFirst} onChange={(e) => setRecipFirst(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Last name</Label>
                        <Input value={recipLast} onChange={(e) => setRecipLast(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input type="email" value={recipEmail} onChange={(e) => setRecipEmail(e.target.value)} autoComplete="off" />
                      <p className="text-[11px] mt-1" style={{ color: PROMO_TEXT }}>
                        We'll email them their pass. If this email matches an active Storm Wellness Club member, you'll get member pricing automatically.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <Button onClick={handleStart} disabled={creating} className="w-full" size="lg" style={{ background: PROMO_GOLD }}>
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Continue to payment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
