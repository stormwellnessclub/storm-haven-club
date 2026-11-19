import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Chapter, EdImage, Reveal } from "@/components/editorial/Editorial";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { formatUsd } from "@/lib/blackFriday";
import { MOVEMENT_COPY, processingFeeCents, type MovementOfferKey } from "@/lib/movementEdit";
import reformer from "@/assets/movement/reformer-class.jpg.asset.json";
import aerobics from "@/assets/movement/aerobics-studio.jpg.asset.json";
import cycling from "@/assets/movement/cycling-studio.jpg.asset.json";
import weights from "@/assets/movement/strength-weights.jpg.asset.json";
import lockers from "@/assets/movement/locker-room.jpg.asset.json";
import gymFloor from "@/assets/movement/gym-floor.jpg.asset.json";

type Offer = { key: MovementOfferKey; name: string; price_cents: number; classes: number; is_active: boolean; starts_at: string | null; ends_at: string | null; display_order: number };

const PHOTOS: Record<MovementOfferKey, { src: string; alt: string }[]> = {
  discovery_pass: [{ src: reformer.url, alt: "A Reformer Pilates class at Storm Wellness Club" }],
  movement_edit: [{ src: cycling.url, alt: "The cycling studio" }, { src: weights.url, alt: "Storm dumbbells on the rack" }],
  club_experience: [{ src: gymFloor.url, alt: "The main gym floor" }, { src: lockers.url, alt: "The locker room" }],
};

const isLive = (o: Offer) => o.is_active && (!o.starts_at || new Date(o.starts_at) <= new Date()) && (!o.ends_at || new Date(o.ends_at) > new Date());

export function MovementEditSection() {
  const { user } = useAuth();
  const { roles } = useUserRoles();
  const isStaff = roles.some((r) => ["super_admin", "admin", "manager"].includes(r));
  const [params, setParams] = useSearchParams();

  const { data: offers = [] } = useQuery({
    queryKey: ["seasonal-class-offers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("seasonal_class_offers").select("*").order("display_order");
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
  });
  const { data: blocks = {} } = useQuery({
    queryKey: ["seasonal-class-eligibility", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("my_seasonal_class_offer_eligibility");
      return Object.fromEntries(((data ?? []) as { key: string; reason: string | null }[]).map((r) => [r.key, r.reason]));
    },
  });

  const [picked, setPicked] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ classes: number; expires: string } | null>(null);
  const [checking, setChecking] = useState(false);

  // Returning from Stripe: confirm the payment and show the result.
  useEffect(() => {
    const sid = params.get("session_id");
    if (params.get("movement") !== "done" || !sid) return;
    setChecking(true);
    supabase.functions.invoke("class-pass-confirm", { body: { session_id: sid } }).then(({ data }) => {
      setChecking(false);
      if (data?.pass) setDone({ classes: data.pass.classes_total, expires: new Date(data.pass.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) });
      else if (data?.paid) setDone({ classes: 0, expires: "" });
      else setErr("We couldn't confirm your payment. If you were charged, your classes will appear in your account shortly.");
      const next = new URLSearchParams(params); next.delete("movement"); next.delete("session_id"); setParams(next, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = offers.filter((o) => MOVEMENT_COPY[o.key] && (isLive(o) || isStaff));
  if (visible.length === 0 && !done && !checking) return null;
  const anyLive = offers.some(isLive);

  async function checkout() {
    if (!picked || busy) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.functions.invoke("seasonal-class-checkout", { body: { offerKey: picked.key } });
    if (data?.success && data.url) { window.location.href = data.url; return; }
    setBusy(false);
    setErr(data?.error ?? error?.message ?? "We couldn't start checkout. Please try again.");
  }

  return (
    <div id="movement-edit" className="scroll-mt-24">
      <section className="container pt-8 pb-14 md:pt-16 md:pb-20">
        <Reveal>
          <Chapter n="03" label="The Movement Edit" />
          {!anyLive && isStaff && (
            <p className="mt-4 ed-caption text-muted-foreground">Staff preview — not visible to clients until turned on in Admin → Class Pass Pricing → The Seasonal Edit.</p>
          )}
          <h2 className="font-serif text-4xl leading-[1.05] md:text-6xl mt-6 max-w-4xl">More ways to move. More to experience.</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-12 text-lg leading-relaxed text-muted-foreground">
            <div className="md:col-span-7 space-y-5">
              <p>From Reformer Pilates and cycling to strength, yoga, and everything in between, discover a different approach to group fitness.</p>
              <p>Thoughtfully designed classes, experienced instructors, and intimate group settings that allow for a more personal experience.</p>
              <p className="text-foreground">For The Seasonal Edit, we've curated three ways to begin or continue your movement journey at Storm Wellness Club.</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section><EdImage src={aerobics.url} alt="The movement studio at Storm Wellness Club" className="h-[40vh] min-h-[260px] md:h-[60vh]" /></section>

      {visible.map((o, i) => {
        const c = MOVEMENT_COPY[o.key];
        const reason = user ? blocks[o.key] : null;
        const photos = PHOTOS[o.key];
        return (
          <section key={o.key} className="container py-16 md:py-24 border-b border-border last:border-b-0">
            <div className={`grid gap-10 md:grid-cols-12 md:items-start ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <div className="md:col-span-5 grid gap-3">
                {photos.map((p) => <EdImage key={p.src} src={p.src} alt={p.alt} className={photos.length > 1 ? "aspect-[4/3]" : "aspect-[4/5]"} />)}
              </div>
              <Reveal className="md:col-span-6 md:col-start-7">
                <p className="ed-caption text-muted-foreground">Offer {c.n}</p>
                <h3 className="font-serif text-3xl md:text-5xl mt-3">{c.title}</h3>
                <p className="mt-3 text-sm tracking-wide">{c.headline}</p>
                <p className="mt-6 font-serif text-xl italic">{c.tagline}</p>
                <div className="mt-4 space-y-4 text-muted-foreground leading-relaxed">{c.body.map((b) => <p key={b}>{b}</p>)}</div>
                <p className="mt-8 ed-caption text-muted-foreground">Package details</p>
                <ul className="mt-3 border-t border-border">
                  {c.details.map((d) => <li key={d} className="py-2.5 border-b border-border text-sm">{d}</li>)}
                </ul>
                <div className="mt-8">
                  {!user ? (
                    <p className="text-sm text-muted-foreground">
                      <Link to="/auth?redirect=/black-friday%23movement-edit" className="underline underline-offset-4 text-foreground">Sign in</Link> or{" "}
                      <Link to="/auth?mode=signup&redirect=/black-friday%23movement-edit" className="underline underline-offset-4 text-foreground">make an account</Link> to buy.
                    </p>
                  ) : reason && isLive(o) ? (
                    <p className="text-sm text-muted-foreground">{reason}</p>
                  ) : (
                    <Button onClick={() => { setPicked(o); setErr(null); }} disabled={!isLive(o)}>{c.button}</Button>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
        );
      })}

      <Sheet open={!!picked} onOpenChange={(v) => { if (!v && !busy) setPicked(null); }}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto px-6 pb-8">
          {picked && (() => {
            const c = MOVEMENT_COPY[picked.key]; const fee = processingFeeCents(picked.price_cents);
            return (
              <>
                <SheetHeader><SheetTitle className="font-serif text-2xl">{c.title}</SheetTitle><SheetDescription>Please review before continuing to payment.</SheetDescription></SheetHeader>
                <ul className="mt-4 text-sm border-t border-border">{c.details.map((d) => <li key={d} className="py-2 border-b border-border">{d}</li>)}</ul>
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span>{c.title}</span><span>{formatUsd(picked.price_cents)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Payment processing fee</span><span>{formatUsd(fee)}</span></div>
                  <div className="flex justify-between font-medium pt-2 border-t border-border"><span>Total</span><span>{formatUsd(picked.price_cents + fee)}</span></div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Your classes appear in your account right after payment and book through the regular class schedule.</p>
                {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
                <Button className="mt-5 w-full" onClick={checkout} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue to payment"}</Button>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Sheet open={checking || !!done} onOpenChange={(v) => { if (!v) setDone(null); }}>
        <SheetContent side="bottom" className="px-6">
          {checking ? (
            <p className="py-8 flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Confirming your payment…</p>
          ) : done && (
            <div className="py-4 space-y-4">
              <p className="flex items-start gap-2 font-serif text-2xl"><CheckCircle2 className="h-6 w-6 shrink-0 text-primary mt-1" /> Payment received</p>
              <p className="text-muted-foreground">{done.classes ? `${done.classes} classes are in your account, to use by ${done.expires}.` : "Your classes will appear in your account in a moment."}</p>
              <Button asChild className="w-full"><Link to="/schedule">Book a class</Link></Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
