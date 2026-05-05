import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Check, Heart, Sparkles, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSpaServices } from "@/hooks/useSpaManagement";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import aellaLogo from "@/assets/aella-logo.png";
import cardImage from "@/assets/mothers-day-card.jpeg";

export default function MothersDay() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { data: services } = useSpaServices();

  const success = params.get("success") === "1";
  const sessionId = params.get("session_id");
  const cancelled = params.get("cancelled") === "1";

  const [duration, setDuration] = useState<60 | 90>(60);
  const [serviceName, setServiceName] = useState<string>("");
  const [isGift, setIsGift] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Confirmation state
  const [confirmedVoucher, setConfirmedVoucher] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (user && profile) {
      setBuyerName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim());
      setBuyerEmail(user.email || "");
    } else if (user?.email) {
      setBuyerEmail(user.email);
    }
  }, [user, profile]);

  // Confirm session (post-checkout)
  useEffect(() => {
    if (!sessionId) return;
    setConfirming(true);
    supabase.functions
      .invoke("mothers-day-confirm", { body: { session_id: sessionId } })
      .then(({ data, error }) => {
        if (error) toast.error("Could not confirm payment");
        else if (data?.success) setConfirmedVoucher(data.voucher);
      })
      .finally(() => setConfirming(false));
  }, [sessionId]);

  const massageOptions = (services || [])
    .filter((s) => s.category === "Massage" && s.is_active && s.duration_minutes === duration)
    .sort((a, b) => Number(a.price) - Number(b.price));

  // Default selection when duration changes
  useEffect(() => {
    if (massageOptions.length && !massageOptions.find((m) => m.name === serviceName)) {
      setServiceName(massageOptions[0].name);
    }
  }, [duration, massageOptions.length]);

  const selected = massageOptions.find((m) => m.name === serviceName);
  const amountCents = selected ? Math.round(Number(selected.price) * 100) : 0;

  const handleCheckout = async () => {
    if (!buyerName.trim() || !buyerEmail.trim()) {
      toast.error("Please enter your name and email.");
      return;
    }
    if (!selected) {
      toast.error("Please choose a massage.");
      return;
    }
    if (isGift && (!recipientName.trim() || !recipientEmail.trim())) {
      toast.error("Please enter recipient name and email.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("mothers-day-checkout", {
        body: {
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          recipient_name: isGift ? recipientName : null,
          recipient_email: isGift ? recipientEmail : null,
          gift_message: isGift ? giftMessage : null,
          massage_choice: selected.name,
          massage_duration: duration,
          amount_cents: amountCents,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Success view ----------
  if (sessionId) {
    return (
      <Layout>
        <SEOHead title="Mother's Day Voucher" description="Your Mother's Day Special voucher" path="/mothers-day/success" />
        <div className="min-h-[80vh] flex items-center justify-center py-20" style={{ background: "#ece2d2" }}>
          <Card className="max-w-xl w-full p-10 text-center" style={{ background: "#ece2d2", borderColor: "#c9a86a" }}>
            {confirming ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#a17e3a" }} />
                <p style={{ color: "#6b5a3b" }}>Confirming your purchase…</p>
              </div>
            ) : confirmedVoucher ? (
              <>
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
                  Redeemable through {new Date(confirmedVoucher.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
                <div className="mt-8 flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => navigate("/spa?category=Massage")}>Book Massage</Button>
                  <Button onClick={() => navigate("/")} style={{ background: "#a17e3a" }}>Done</Button>
                </div>
              </>
            ) : (
              <>
                <h1 className="font-serif text-3xl mb-4" style={{ color: "#a17e3a" }}>Almost there…</h1>
                <p style={{ color: "#6b5a3b" }}>Your payment is processing. Check your email shortly.</p>
              </>
            )}
          </Card>
        </div>
      </Layout>
    );
  }

  // ---------- Main page ----------
  return (
    <Layout>
      <SEOHead
        title="Mother's Day Special — Custom Massage + Wet Spa Access"
        description="Treat mom to a Custom Massage plus exclusive Wet Spa Access — sauna, steam, and Himalayan salt room — at Storm Wellness Club. Redeemable for 6 months."
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

      {/* Checkout form */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-2xl">
          <h2 className="font-serif text-3xl mb-2 text-center">Give the Gift of Renewal</h2>
          <p className="text-muted-foreground text-center mb-8">
            Choose a massage from our menu — your special includes exclusive wet spa access on the day of service.
          </p>

          {cancelled && (
            <div className="mb-6 p-4 rounded border bg-muted/30 text-sm">Checkout was cancelled. No worries — try again whenever you're ready.</div>
          )}

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
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Your name</Label>
                <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
              </div>
              <div>
                <Label>Your email</Label>
                <Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
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
              <div className="space-y-4 pl-7">
                <div className="grid sm:grid-cols-2 gap-4">
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
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Happy Mother's Day, mom!"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Total + Checkout */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="font-serif text-3xl text-gold">${(amountCents / 100).toFixed(2)}</div>
              </div>
              <Button size="lg" onClick={handleCheckout} disabled={submitting || !selected}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Continue to checkout
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Your voucher will be emailed instantly with a unique code. Redeem at the spa within 6 months.
            </p>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have a voucher? <Link to="/spa?category=Massage" className="underline">Book your appointment →</Link>
          </p>
        </div>
      </section>
    </Layout>
  );
}
