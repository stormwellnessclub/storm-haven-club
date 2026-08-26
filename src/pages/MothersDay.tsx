import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Check, Heart, Sparkles, Copy, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSpaServices } from "@/hooks/useSpaManagement";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import aellaLogo from "@/assets/aella-logo-mark.png";
import cardImage from "@/assets/mothers-day-card.jpeg";
import { StripeProvider } from "@/components/StripeProvider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { calculateProcessingFee } from "@/lib/processingFee";

type Gender = "female" | "male" | "prefer_not_to_say";

function PayForm({
  onSuccess,
  onBack,
  amountCents,
}: {
  onSuccess: (paymentIntentId: string) => void;
  onBack: () => void;
  amountCents: number;
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
      const { error: submitErr } = await elements.submit();
      if (submitErr) {
        setError(submitErr.message || "Please complete the payment form");
        setSubmitting(false);
        return;
      }
      const { error: payErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.href,
        },
      });
      if (payErr) {
        setError(payErr.message || "Payment failed");
        setSubmitting(false);
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        onSuccess(paymentIntent.id);
      } else {
        setError("Payment did not complete. Please try again.");
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message || "Payment failed");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button type="submit" size="lg" disabled={submitting || !stripe} style={{ background: "#a17e3a" }}>
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Pay ${(amountCents / 100).toFixed(2)}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Secure payment processed in-app. You'll receive your voucher by email immediately.
      </p>
    </form>
  );
}

export default function MothersDay() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { data: services } = useSpaServices();

  const cancelled = params.get("cancelled") === "1";

  // Form state
  const [duration, setDuration] = useState<60 | 90>(60);
  const [serviceName, setServiceName] = useState<string>("");
  const [isGift, setIsGift] = useState(false);
  const [buyerFirst, setBuyerFirst] = useState("");
  const [buyerLast, setBuyerLast] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerGender, setBuyerGender] = useState<Gender | "">("");
  const [recipFirst, setRecipFirst] = useState("");
  const [recipLast, setRecipLast] = useState("");
  const [recipEmail, setRecipEmail] = useState("");
  const [recipPhone, setRecipPhone] = useState("");
  const [recipGender, setRecipGender] = useState<Gender | "">("");
  const [giftMessage, setGiftMessage] = useState("");

  // Checkout state
  const [creating, setCreating] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [confirmedVoucher, setConfirmedVoucher] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (user && profile) {
      if (!buyerFirst) setBuyerFirst(profile.first_name || "");
      if (!buyerLast) setBuyerLast(profile.last_name || "");
      if (!buyerEmail) setBuyerEmail(user.email || "");
      if (!buyerPhone && (profile as any).phone) setBuyerPhone((profile as any).phone || "");
    } else if (user?.email && !buyerEmail) {
      setBuyerEmail(user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const massageOptions = useMemo(
    () =>
      (services || [])
        .filter((s) => s.category === "Massage" && s.is_active && s.duration_minutes === duration)
        .sort((a, b) => Number(a.price) - Number(b.price)),
    [services, duration]
  );

  useEffect(() => {
    if (massageOptions.length && !massageOptions.find((m) => m.name === serviceName)) {
      setServiceName(massageOptions[0].name);
    }
  }, [duration, massageOptions, serviceName]);

  const selected = massageOptions.find((m) => m.name === serviceName);
  const baseCents = selected ? Math.round(Number(selected.price) * 100) : 0;
  const feeCents = calculateProcessingFee(baseCents);
  const totalCents = baseCents + feeCents;

  const handleStartCheckout = async () => {
    if (!buyerFirst.trim() || !buyerLast.trim()) return toast.error("Please enter your first and last name.");
    if (!buyerEmail.trim()) return toast.error("Please enter your email.");
    if (!buyerPhone.trim()) return toast.error("Please enter your phone number.");
    if (!buyerGender) return toast.error("Please select your gender.");
    if (!selected) return toast.error("Please choose a massage.");
    if (isGift) {
      if (!recipFirst.trim() || !recipLast.trim()) return toast.error("Please enter recipient first and last name.");
      if (!recipEmail.trim()) return toast.error("Please enter recipient email.");
      if (!recipGender) return toast.error("Please select recipient gender.");
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("mothers-day-create-intent", {
        body: {
          buyer_first_name: buyerFirst,
          buyer_last_name: buyerLast,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          buyer_gender: buyerGender,
          is_gift: isGift,
          recipient_first_name: isGift ? recipFirst : null,
          recipient_last_name: isGift ? recipLast : null,
          recipient_email: isGift ? recipEmail : null,
          recipient_phone: isGift ? recipPhone : null,
          recipient_gender: isGift ? recipGender : null,
          gift_message: isGift ? giftMessage : null,
          massage_choice: selected.name,
          massage_duration: duration,
          amount_cents: baseCents,
        },
      });
      if (error) throw error;
      if (!data?.client_secret) throw new Error("Could not start checkout");
      setClientSecret(data.client_secret);
      setPaymentIntentId(data.payment_intent_id);
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setCreating(false);
    }
  };

  const handlePaid = async (intentId: string) => {
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke("mothers-day-confirm", {
        body: { payment_intent_id: intentId },
      });
      if (error) throw error;
      if (data?.success) setConfirmedVoucher(data.voucher);
      else toast.error("Could not confirm payment");
    } catch (e: any) {
      toast.error(e.message || "Could not confirm payment");
    } finally {
      setConfirming(false);
    }
  };

  // ---------- Confirmation view ----------
  if (confirmedVoucher) {
    return (
      <Layout>
        <SEOHead title="Mother's Day Voucher" description="Your Mother's Day Special voucher" path="/mothers-day" />
        <div className="min-h-[80vh] flex items-center justify-center py-20" style={{ background: "#ece2d2" }}>
          <Card className="max-w-xl w-full p-10 text-center" style={{ background: "#ece2d2", borderColor: "#c9a86a" }}>
            <Check className="w-12 h-12 mx-auto mb-4" style={{ color: "#a17e3a" }} />
            <h1 className="font-serif text-4xl mb-2" style={{ color: "#a17e3a" }}>Thank You!</h1>
            <p className="mb-6" style={{ color: "#6b5a3b" }}>
              {confirmedVoucher.recipient_name
                ? `Your gift is on its way to ${confirmedVoucher.recipient_name}.`
                : "Your voucher has been emailed to you."}
            </p>
            <div className="my-6 p-6 bg-white border-2 border-dashed rounded" style={{ borderColor: "#c9a86a" }}>
              <div className="text-xs tracking-[0.3em] mb-2" style={{ color: "#a17e3a" }}>VOUCHER CODE</div>
              <div className="font-mono text-3xl tracking-widest mb-3">{confirmedVoucher.code}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(confirmedVoucher.code);
                  toast.success("Copied!");
                }}
              >
                <Copy className="w-4 h-4 mr-2" /> Copy code
              </Button>
            </div>
            <p className="text-sm" style={{ color: "#6b5a3b" }}>
              {confirmedVoucher.massage_choice} ({confirmedVoucher.massage_duration} min) + Wet Spa Access
            </p>
            <p className="text-sm mt-2" style={{ color: "#6b5a3b" }}>
              Redeemable through{" "}
              {new Date(confirmedVoucher.expires_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <div className="mt-8 flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate("/spa?category=Massage")}>Book Massage</Button>
              <Button onClick={() => navigate("/")} style={{ background: "#a17e3a" }}>Done</Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  if (confirming) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#a17e3a" }} />
            <p style={{ color: "#6b5a3b" }}>Confirming your purchase…</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ---------- Main page ----------
  return (
    <Layout>
      <SEOHead
        title="Mother's Day Spa Package"
        description="Treat mom to a custom massage plus wet spa access (sauna, steam, Himalayan salt room) at Storm Wellness Club in Livonia, MI. Redeemable for 6 months."
        path="/mothers-day"
      />

      {/* Hero */}
      <section className="relative pt-24 pb-16" style={{ background: "#ece2d2" }}>
        <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left">
            <img src={aellaLogo} alt="Aella" className="h-16 w-auto mx-auto md:mx-0 mb-2" style={{ filter: "sepia(0.3)" }} />
            <p className="text-xs tracking-[0.4em] mb-6" style={{ color: "#a17e3a" }}>STORM WELLNESS CLUB</p>
            <h1 className="font-serif text-5xl md:text-6xl mb-6" style={{ color: "#a17e3a" }}>
              Mother's Day Special
            </h1>
            <p className="text-2xl mb-2 font-serif" style={{ color: "#a17e3a" }}>Custom Massage</p>
            <p className="text-xl mb-2" style={{ color: "#a17e3a" }}>+</p>
            <p className="text-2xl mb-4 font-serif" style={{ color: "#a17e3a" }}>Exclusive Wet Spa Access</p>
            <ul className="space-y-1 text-lg mb-8" style={{ color: "#8a6d3b" }}>
              <li>• Sauna</li>
              <li>• Steam Room</li>
              <li>• Himalayan Salt Room</li>
            </ul>
            <p className="text-sm italic" style={{ color: "#6b5a3b" }}>Redeemable for 6 months</p>
          </div>
          <div>
            <img src={cardImage} alt="Mother's Day Special" className="w-full rounded-lg shadow-2xl" />
          </div>
        </div>
      </section>

      {/* Form / Payment */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-2xl">
          <h2 className="font-serif text-3xl mb-2 text-center">Give the Gift of Renewal</h2>
          <p className="text-muted-foreground text-center mb-8">
            Choose a massage from our menu — your special includes exclusive wet spa access on the day of service.
          </p>

          {cancelled && (
            <div className="mb-6 p-4 rounded border bg-muted/30 text-sm">
              Checkout was cancelled. No worries — try again whenever you're ready.
            </div>
          )}

          {/* PAYMENT STEP */}
          {clientSecret ? (
            <Card className="p-6 space-y-6">
              <div>
                <div className="text-sm text-muted-foreground">You're paying for</div>
                <div className="font-serif text-xl">
                  {selected?.name} ({duration} min) + Wet Spa Access
                </div>
                {isGift && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Gift for {recipFirst} {recipLast}
                  </div>
                )}
              </div>
              <StripeProvider clientSecret={clientSecret}>
                <PayForm
                  amountCents={totalCents}
                  onSuccess={handlePaid}
                  onBack={() => {
                    setClientSecret(null);
                    setPaymentIntentId(null);
                  }}
                />
              </StripeProvider>
            </Card>
          ) : (
            // FORM STEP
            <Card className="p-6 space-y-6">
              {/* Duration */}
              <div>
                <Label className="mb-3 block">Massage length</Label>
                <RadioGroup
                  value={String(duration)}
                  onValueChange={(v) => setDuration(Number(v) as 60 | 90)}
                  className="grid grid-cols-2 gap-3"
                >
                  {[60, 90].map((d) => (
                    <label
                      key={d}
                      className={`border rounded-lg p-4 cursor-pointer text-center transition ${
                        duration === d ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40"
                      }`}
                    >
                      <RadioGroupItem value={String(d)} className="sr-only" />
                      <div className="font-serif text-2xl">{d} min</div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {/* Massage choice */}
              <div>
                <Label className="mb-3 block">Choose your massage</Label>
                <div className="space-y-2">
                  {massageOptions.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between border rounded-lg p-3 cursor-pointer transition ${
                        serviceName === m.name ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={serviceName === m.name}
                          onChange={() => setServiceName(m.name)}
                          className="accent-primary"
                        />
                        <span className="font-medium">{m.name.replace(/\s—\s\d+$/, "")}</span>
                      </div>
                      <span className="font-semibold text-gold">${Number(m.price).toFixed(0)}</span>
                    </label>
                  ))}
                  {massageOptions.length === 0 && (
                    <p className="text-sm text-muted-foreground">Loading menu…</p>
                  )}
                </div>
              </div>

              {/* Buyer */}
              <div className="pt-2 border-t space-y-4">
                <div className="font-medium text-sm uppercase tracking-wider text-muted-foreground">Your information</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>First name *</Label>
                    <Input value={buyerFirst} onChange={(e) => setBuyerFirst(e.target.value)} />
                  </div>
                  <div>
                    <Label>Last name *</Label>
                    <Input value={buyerLast} onChange={(e) => setBuyerLast(e.target.value)} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>Phone *</Label>
                    <Input type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="(555) 123-4567" />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Gender *</Label>
                  <RadioGroup
                    value={buyerGender}
                    onValueChange={(v) => setBuyerGender(v as Gender)}
                    className="grid grid-cols-3 gap-2"
                  >
                    {[
                      { v: "female", l: "Female" },
                      { v: "male", l: "Male" },
                      { v: "prefer_not_to_say", l: "Prefer not to say" },
                    ].map((o) => (
                      <label
                        key={o.v}
                        className={`border rounded-lg p-2 cursor-pointer text-center text-sm transition ${
                          buyerGender === o.v ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40"
                        }`}
                      >
                        <RadioGroupItem value={o.v} className="sr-only" />
                        {o.l}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>

              {/* Gift toggle */}
              <div className="flex items-center gap-3 pt-2 border-t">
                <input
                  type="checkbox"
                  id="isgift"
                  checked={isGift}
                  onChange={(e) => setIsGift(e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                <Label htmlFor="isgift" className="cursor-pointer flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-400" /> This is a gift — send the voucher to someone else
                </Label>
              </div>

              {isGift && (
                <div className="space-y-4 pl-7 border-l-2" style={{ borderColor: "#c9a86a" }}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Recipient first name *</Label>
                      <Input value={recipFirst} onChange={(e) => setRecipFirst(e.target.value)} />
                    </div>
                    <div>
                      <Label>Recipient last name *</Label>
                      <Input value={recipLast} onChange={(e) => setRecipLast(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Recipient email *</Label>
                      <Input type="email" value={recipEmail} onChange={(e) => setRecipEmail(e.target.value)} />
                    </div>
                    <div>
                      <Label>Recipient phone</Label>
                      <Input type="tel" value={recipPhone} onChange={(e) => setRecipPhone(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Recipient gender *</Label>
                    <RadioGroup
                      value={recipGender}
                      onValueChange={(v) => setRecipGender(v as Gender)}
                      className="grid grid-cols-3 gap-2"
                    >
                      {[
                        { v: "female", l: "Female" },
                        { v: "male", l: "Male" },
                        { v: "prefer_not_to_say", l: "Prefer not to say" },
                      ].map((o) => (
                        <label
                          key={o.v}
                          className={`border rounded-lg p-2 cursor-pointer text-center text-sm transition ${
                            recipGender === o.v ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40"
                          }`}
                        >
                          <RadioGroupItem value={o.v} className="sr-only" />
                          {o.l}
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <Label>Personal message (optional)</Label>
                    <Textarea
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      placeholder="Happy Mother's Day, mom!"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Total + Continue */}
              <div className="pt-4 border-t space-y-3">
                {selected && (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Massage</span>
                      <span>${(baseCents / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing fee</span>
                      <span>${(feeCents / 100).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div className="font-serif text-3xl text-gold">${(totalCents / 100).toFixed(2)}</div>
                  </div>
                  <Button size="lg" onClick={handleStartCheckout} disabled={creating || !selected} style={{ background: "#a17e3a" }}>
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Continue to payment
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Payment happens right here in the app — your voucher emails instantly with a unique code, redeemable at the spa within 6 months.
              </p>
            </Card>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have a voucher? <Link to="/spa?category=Massage" className="underline">Book your appointment →</Link>
          </p>
        </div>
      </section>
    </Layout>
  );
}
