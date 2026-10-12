import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { PRESALE_OPTIONS, NON_MEMBER_OPTIONS, presaleTotals, usd } from "@/lib/bodyRollerPresale";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import hero from "@/assets/body-roller/Image_9.jpeg.asset.json";
import legs from "@/assets/body-roller/Image_16.jpeg.asset.json";
import machine from "@/assets/body-roller/Image_57.jpeg.asset.json";

let stripeInstancePromise: ReturnType<typeof loadStripe> | null = null;
function getStripeInstance() {
  if (!stripeInstancePromise) {
    stripeInstancePromise = supabase.functions.invoke("stripe-config").then(({ data }) => loadStripe(data?.publishableKey || ""));
  }
  return stripeInstancePromise;
}

export default function BodyRollerPresale() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{ secret: string; label: string } | null>(null);
  const [confirmed, setConfirmed] = useState<{ label: string; expires_at: string } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["body-roller-presale-settings"],
    queryFn: async () => (await supabase.from("body_roller_presale_settings").select("ends_at").eq("id", 1).maybeSingle()).data,
  });
  const ended = settings ? new Date(settings.ends_at).getTime() < Date.now() : false;
  const endsLabel = settings
    ? new Date(settings.ends_at).toLocaleDateString("en-US", { timeZone: "America/Detroit", month: "long", day: "numeric" })
    : "";

  useEffect(() => {
    document.title = "Lymphatic Body Roller Presale | Storm Wellness Club";
    const sid = params.get("session_id");
    if (params.get("success") && sid && user) {
      supabase.functions.invoke("body-roller-presale-confirm", { body: { session_id: sid } }).then(({ data }) => {
        if (data?.status === "paid") setConfirmed({ label: data.label, expires_at: data.expires_at });
        setParams({}, { replace: true });
      });
    }
    if (params.get("cancelled")) { toast.message("Checkout cancelled."); setParams({}, { replace: true }); }
  }, [user]);

  const reserve = async (key: string) => {
    if (!user) { window.location.href = `/auth?redirect=/body-roller-presale`; return; }
    setBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("body-roller-presale-checkout", { body: { option: key } });
      if (error || !data?.clientSecret) {
        let msg = data?.error;
        try { msg = msg || (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
        throw new Error(msg || "Could not start checkout");
      }
      setCheckout({ secret: data.clientSecret, label: data.label });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const column = (duration: 30 | 60) => (
    <div className="border border-border/60 bg-card p-8">
      <p className="text-xs tracking-[0.3em] text-accent mb-1">{duration} MINUTES</p>
      <h3 className="font-serif text-2xl mb-6">{duration === 30 ? "The Reset" : "The Full Ritual"}</h3>
      <div className="divide-y divide-border/60">
        {PRESALE_OPTIONS.filter((o) => o.duration === duration).map((o) => (
          <div key={o.key} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium">{o.short}</p>
              <p className="text-xs text-muted-foreground">
                {o.sessions > 1 ? `${usd(o.cents / o.sessions)} per session · ` : ""}
                <span className="line-through">{usd(o.regular_cents)}</span> regular
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-serif text-xl">{usd(o.cents)}</span>
              <Button size="sm" disabled={ended || !!busy} onClick={() => reserve(o.key)}>
                {busy === o.key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reserve"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Layout>
      <Dialog open={!!checkout} onOpenChange={(o) => !o && setCheckout(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Reserve — {checkout?.label}</DialogTitle></DialogHeader>
          {checkout && (
            <EmbeddedCheckoutProvider key={checkout.secret} stripe={getStripeInstance()} options={{ clientSecret: checkout.secret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </DialogContent>
      </Dialog>
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        <img src={hero.url} alt="The Lymphatic Body Roller at Storm Wellness Club" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="relative container mx-auto px-6 pb-16 max-w-4xl">
          <p className="text-xs tracking-[0.35em] text-accent mb-4">MEMBER PRESALE</p>
          <h1 className="font-serif text-4xl md:text-6xl leading-tight mb-4">The Lymphatic Body Roller</h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Warm, rhythmic compression across sculpted wooden rollers to encourage circulation, ease tension and leave the body lighter.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-6 py-16 max-w-5xl">
        {confirmed && (
          <div className="mb-10 border border-accent/40 bg-accent/5 p-6 flex gap-4 items-start">
            <CheckCircle2 className="h-6 w-6 text-accent shrink-0" />
            <div>
              <p className="font-serif text-xl">Reserved: {confirmed.label}</p>
              <p className="text-sm text-muted-foreground">
                Your sessions are in your account and can be booked once the machine arrives. They expire{" "}
                {new Date(confirmed.expires_at).toLocaleDateString("en-US", { timeZone: "America/Detroit", month: "long", day: "numeric", year: "numeric" })}.{" "}
                <Link to="/member/credits" className="underline">View my credits</Link>
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-10 mb-16 text-center">
          {[["Circulation", "Rhythmic compression supports natural lymphatic flow."], ["Release", "Warm wooden rollers ease tight, tired muscles."], ["Renewal", "Leave feeling lighter, smoother and restored."]].map(([t, d]) => (
            <div key={t}><h2 className="font-serif text-2xl mb-2">{t}</h2><p className="text-sm text-muted-foreground">{d}</p></div>
          ))}
        </div>

        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl mb-2">Member presale pricing</h2>
          <p className="text-sm text-muted-foreground">
            {ended ? "The presale has ended." : `Presale pricing ends ${endsLabel}.`} Sessions and packs expire 6 months after purchase.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">{column(30)}{column(60)}</div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          For active members. Card processing fee added at checkout
          (e.g. a {usd(3500)} session totals {usd(presaleTotals(3500).total)}).
        </p>
        <div id="non-members" className="mt-16 border border-border/60 bg-card p-8 max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-accent mb-1">NON-MEMBERS</p>
          <h3 className="font-serif text-2xl mb-2">Reserve early</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Not a member? Reserve a session now at the regular price and it will be waiting for you when the machine arrives.
            Sessions expire 6 months after purchase. Sign in or create an account to reserve.
          </p>
          <div className="divide-y divide-border/60">
            {NON_MEMBER_OPTIONS.map((o) => (
              <div key={o.key} className="flex items-center justify-between gap-4 py-4">
                <p className="font-medium">{o.short}</p>
                <div className="flex items-center gap-4">
                  <span className="font-serif text-xl">{usd(o.cents)}</span>
                  <Button size="sm" variant="outline" disabled={ended || !!busy} onClick={() => reserve(o.key)}>
                    {busy === o.key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reserve"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center text-sm italic text-muted-foreground">Estimated arrival early November. Arrival date subject to change.</p>

        <div className="grid grid-cols-2 gap-4 mt-16">
          <img src={legs.url} alt="A Body Roller session" className="w-full h-80 object-cover" loading="lazy" />
          <img src={machine.url} alt="The Lymphatic Body Roller machine" className="w-full h-80 object-cover" loading="lazy" />
        </div>
      </section>
    </Layout>
  );
}
