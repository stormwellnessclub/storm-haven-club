import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Loader2, Check } from "lucide-react";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Chapter, EdImage, Reveal } from "@/components/editorial/Editorial";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BLACK_FRIDAY_PROMO, formatUsd, saleEndLabel, saleHasEnded } from "@/lib/blackFriday";
import trainingPhoto from "@/assets/gym-area-2.jpg";

type Pack = { id: string; name: string; sessions: number; price_cents: number; promo_audience: string; sale_ends_at: string | null; expiration_days: number };
type Plan = { id: string; pack_id: string; installment_count: number; amount_due_at_sale_cents: number; installment_cents: number; final_installment_cents: number; plan_total_cents: number; session_release: number[] };
type PlanRow = { number: number; dueDate: string; amountCents: number; feeCents: number; sessions: number };
type Quote = { totalCents: number; feeCents?: number; brand: string; last4: string | null; plan?: boolean; rows?: PlanRow[] };
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function invokeCheckout(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("pt-promo-checkout", { body });
  if (error) {
    const text = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    try { return JSON.parse(text); } catch { return { success: false, error: text }; }
  }
  return data;
}

export default function BlackFriday() {
  const { user } = useAuth();
  const { data: packs = [], isLoading } = useQuery({
    queryKey: ["pt-promo-packs", BLACK_FRIDAY_PROMO],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("pt_promo_packs", { p_promo: BLACK_FRIDAY_PROMO });
      if (error) throw error;
      return (data ?? []) as Pack[];
    },
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["pt-promo-plans", BLACK_FRIDAY_PROMO],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("pt_promo_plans", { p_promo: BLACK_FRIDAY_PROMO });
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });
  const planFor = (packId: string) => plans.find((pl) => pl.pack_id === packId);
  const { data: audience } = useQuery({
    queryKey: ["pt-promo-audience", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("pt_promo_my_audience");
      return (data ?? null) as "member" | "non_member" | null;
    },
  });

  const rows = useMemo(() => {
    const by = new Map<number, { member?: Pack; non_member?: Pack }>();
    for (const p of packs) {
      const r = by.get(p.sessions) ?? {};
      (r as any)[p.promo_audience] = p;
      by.set(p.sessions, r);
    }
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [packs]);
  const portal = audience === "member" ? "/member" : "/portal";
  const endsAt = packs[0]?.sale_ends_at ?? null;
  const ended = saleHasEnded(endsAt);

  const [picked, setPicked] = useState<Pack | null>(null);
  const [pickedPlan, setPickedPlan] = useState<Plan | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ sessions: number; chargedCents: number; plan?: boolean } | null>(null);
  const keyRef = useRef<string | null>(null);

  async function choose(p: Pack, plan: Plan | null = null) {
    setPicked(p); setPickedPlan(plan); setQuote(null); setErr(null); setDone(null);
    keyRef.current = crypto.randomUUID();
    setBusy(true);
    const r = await invokeCheckout({ packId: p.id, planId: plan?.id ?? null, idempotencyKey: keyRef.current, checkOnly: true });
    setBusy(false);
    if (r?.success) setQuote(r); else setErr(r?.error ?? "Something went wrong.");
  }

  async function buy() {
    if (!picked || busy) return;
    setBusy(true); setErr(null);
    const r = await invokeCheckout({ packId: picked.id, planId: pickedPlan?.id ?? null, idempotencyKey: keyRef.current });
    setBusy(false);
    if (r?.success) setDone({ ...r, plan: !!pickedPlan }); else setErr(r?.error ?? "Something went wrong.");
  }

  const priceCell = (p: Pack | undefined, mine: boolean) => {
    const plan = p ? planFor(p.id) : undefined;
    return (
      <div className={`min-w-0 ${mine ? "" : "text-muted-foreground"}`}>
        <p className="font-serif text-2xl">{p ? formatUsd(p.price_cents) : "—"}</p>
        {plan && (
          <p className="text-xs mt-1">or {plan.installment_count} monthly payments of {formatUsd(plan.installment_cents)}</p>
        )}
        {p && user && mine && !ended && (
          <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-start">
            <Button size="sm" className="px-2 sm:px-3" onClick={() => choose(p)}>{plan ? "Pay in full" : "Buy"}</Button>
            {plan && <Button size="sm" variant="outline" className="px-2 sm:px-3 whitespace-normal h-auto min-h-9 py-2" onClick={() => choose(p, plan)}>Payment plan</Button>}
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <SEOHead
        title="Black Friday at Storm Wellness Club"
        description="Black Friday semi-private personal training packages at Storm Wellness Club in Livonia, through Cyber Monday."
        path="/black-friday"
      />
      <section className="relative">
        <EdImage src={trainingPhoto} alt="The training floor at Storm Wellness Club" className="h-[55vh] min-h-[360px]" eager />
        <div className="absolute inset-0 bg-foreground/45" />
        <div className="absolute inset-x-0 bottom-0 container pb-12 text-primary-foreground">
          <Chapter n="01" label="Black Friday" light />
          <h1 className="font-serif text-4xl md:text-6xl mt-4 max-w-3xl">Personal Training</h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-foreground/90">A commitment to yourself, with an opportunity to go further.</p>
          {endsAt && <p className="mt-4 text-primary-foreground/80">{saleEndLabel(endsAt)}</p>}
        </div>
      </section>

      <section className="container py-16 md:py-24 max-w-4xl">
        <Reveal>
          <Chapter n="02" label="Semi-Private Personal Training" />
          <h2 className="font-serif text-3xl md:text-4xl mt-4">Semi-private training packages</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            For a limited time, enjoy exclusive Black Friday pricing on personal training packages designed around
            your goals, your progress, and your long-term results.
          </p>
          <p className="mt-3 font-medium">Limited packages available.</p>
        </Reveal>

        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 || ended ? (
          <p className="mt-12 font-serif text-2xl">This offer has ended.</p>
        ) : (
          <>
            <div className="mt-12 border-t border-border">
              <div className="grid grid-cols-3 gap-4 py-4 ed-caption text-muted-foreground border-b border-border">
                <span>Package</span>
                <span>Member</span>
                <span>Non-member</span>
              </div>
              {rows.map(([sessions, r]) => (
                <div key={sessions} className="grid grid-cols-3 gap-4 py-6 border-b border-border items-start">
                  <div>
                    <p className="font-serif text-2xl">{sessions} sessions</p>
                    {r.member && <p className="text-xs text-muted-foreground mt-1">Use within {r.member.expiration_days} days</p>}
                  </div>
                  {priceCell(r.member, !user || audience === "member")}
                  {priceCell(r.non_member, !user || audience === "non_member")}
                </div>
              ))}
            </div>
            <div className="mt-8 text-sm text-muted-foreground space-y-2">
              {!user ? (
                <p>
                  <Link to="/auth?redirect=/black-friday" className="underline underline-offset-4 text-foreground">Sign in</Link>{" "}
                  to buy. We'll show the price for your account, and members get the member price.
                </p>
              ) : (
                <p>You're seeing the {audience === "member" ? "member" : "non-member"} price for your account. Your saved card is charged, plus a card processing fee. Packages from 30 sessions up can also be paid monthly.</p>
              )}
            </div>
          </>
        )}
      </section>

      <Sheet open={!!picked} onOpenChange={(o) => { if (!o && !busy) setPicked(null); }}>
        <SheetContent side="bottom" className="max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl">{done ? "You're all set" : pickedPlan ? "Confirm your payment plan" : "Confirm your package"}</SheetTitle>
            <SheetDescription>
              {picked && `Semi-Private Personal Training · ${picked.sessions} sessions`}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 px-6 pb-6">
            {done ? (
              <>
                <p className="flex items-center gap-2"><Check className="h-5 w-5 text-accent" />{done.sessions} sessions were added to your account.</p>
                <p className="text-sm text-muted-foreground">
                  Charged {formatUsd(done.chargedCents)}.{done.plan ? " The rest of your sessions are added as each monthly payment goes through." : ""} Request your first session from Personal Training in your portal.
                </p>
                <Button asChild className="w-full"><Link to={`${portal}/personal-training`}>Go to Personal Training</Link></Button>
              </>
            ) : busy && !quote ? (
              <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : quote?.plan && quote.rows && picked ? (
              <>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Package total</span><span>{formatUsd(quote.totalCents)}</span></div>
                  <div className="flex justify-between font-medium"><span>Due today</span><span>{formatUsd(quote.rows[0].amountCents + quote.rows[0].feeCents)}</span></div>
                  <p className="text-xs text-muted-foreground">Includes a {formatUsd(quote.rows[0].feeCents)} card processing fee, the same as paying in full.</p>
                </div>
                <div className="text-sm border-t border-border pt-3">
                  <p className="ed-caption text-muted-foreground mb-2">Payment schedule</p>
                  {quote.rows.map((r) => (
                    <div key={r.number} className="flex justify-between py-1">
                      <span>{r.number === 1 ? "Today" : shortDate(r.dueDate)} · {r.sessions} sessions</span>
                      <span>{formatUsd(r.amountCents)} <span className="text-muted-foreground">+ {formatUsd(r.feeCents)} fee</span></span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Remaining payments are charged automatically to your {quote.brand} ending in {quote.last4} each month until the plan is complete.
                  Sessions are added as each payment goes through. No interest. The plan ends after the final payment.
                  Your sessions must be used within {picked.expiration_days} days of today.
                </p>
                {err && <p className="text-sm text-destructive">{err}</p>}
                <Button className="w-full" onClick={buy} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Start plan · pay ${formatUsd(quote.rows[0].amountCents + quote.rows[0].feeCents)} today`}
                </Button>
              </>
            ) : quote && picked ? (
              <>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Package</span><span>{formatUsd(picked.price_cents)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Card processing fee</span><span>{formatUsd(quote.feeCents ?? 0)}</span></div>
                  <div className="flex justify-between font-medium pt-2 border-t border-border"><span>Total</span><span>{formatUsd(quote.totalCents)}</span></div>
                </div>
                <p className="text-sm text-muted-foreground">Charged to your {quote.brand} ending in {quote.last4}.</p>
                {err && <p className="text-sm text-destructive">{err}</p>}
                <Button className="w-full" onClick={buy} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${formatUsd(quote.totalCents)}`}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-destructive">{err}</p>
                {/card/i.test(err ?? "") && (
                  <Button asChild variant="outline" className="w-full"><Link to={`${portal}/payment-methods`}>Add a card</Link></Button>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
