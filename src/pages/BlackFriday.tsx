import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Chapter, EdImage, Reveal } from "@/components/editorial/Editorial";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BLACK_FRIDAY_PROMO, formatUsd, saleEndLabel, saleHasEnded } from "@/lib/blackFriday";
import { MovementEditSection } from "@/components/seasonal/MovementEditSection";
import trainingPhoto from "@/assets/gym-area-2.jpg";

type Pack = { id: string; name: string; sessions: number; price_cents: number; promo_audience: string; sale_ends_at: string | null; expiration_days: number };
type Plan = { id: string; pack_id: string; installment_count: number; amount_due_at_sale_cents: number; installment_cents: number; final_installment_cents: number; plan_total_cents: number };
type PlanRow = { number: number; dueDate: string; amountCents: number; feeCents: number };
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

/** Use-by shown in months (days / 30, rounded); package dates themselves are unchanged. */
function monthsLabel(days: number) {
  const m = Math.max(1, Math.round(days / 30));
  return `${m} ${m === 1 ? "month" : "months"}`;
}

type View = "member" | "non_member";
const VIEW_LABEL: Record<View, string> = { member: "Members", non_member: "Non-members" };

export default function BlackFriday() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
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
  // Which pricing the visitor is looking at: their pick (?for=), else their own account type.
  const forParam = params.get("for");
  const view: View | null = forParam === "member" || forParam === "non_member" ? forParam : audience ?? null;
  const contentRef = useRef<HTMLDivElement>(null);
  const pickView = (v: View) => {
    const next = new URLSearchParams(params); next.set("for", v); setParams(next, { replace: true });
    requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const authLink = (mode: "signin" | "signup", hash = "") => {
    const back = `/black-friday${view ? `?for=${view}` : ""}${hash}`;
    return `/auth?${mode === "signup" ? "mode=signup&" : ""}redirect=${encodeURIComponent(back)}`;
  };
  const endsAt = packs[0]?.sale_ends_at ?? null;
  const ended = saleHasEnded(endsAt);

  const [picked, setPicked] = useState<Pack | null>(null);
  const [pickedPlan, setPickedPlan] = useState<Plan | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ sessions: number; chargedCents: number; plan?: boolean; brand?: string; last4?: string | null } | null>(null);
  // Review → "Are you sure?" → charge → success or failure screen.
  const [step, setStep] = useState<"review" | "confirm">("review");
  const [failed, setFailed] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  async function choose(p: Pack, plan: Plan | null = null) {
    setPicked(p); setPickedPlan(plan); setQuote(null); setErr(null); setDone(null); setFailed(null); setStep("review");
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
    if (r?.success) setDone({ ...r, plan: !!pickedPlan });
    else {
      setFailed(r?.error ?? "Your payment did not go through. Your card was not charged.");
      keyRef.current = crypto.randomUUID(); // a retry is a new attempt
    }
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
      {/* The Seasonal Edit: its own quiet opening, kept off the photo */}
      <section className="container pt-28 pb-10 md:pt-44 md:pb-16">
        <Reveal>
          <Chapter n="01" label="The Seasonal Edit" />
          <h1 className="font-serif text-4xl leading-[1.05] md:text-7xl mt-6 max-w-4xl">An invitation to invest in what lasts.</h1>
          <div className="mt-6 grid gap-6 md:mt-12 md:grid-cols-12 md:items-end">
            <p className="text-lg leading-relaxed text-muted-foreground md:col-span-7">
              For a limited time, a considered selection of personal training and wellness experiences at preferred pricing.
            </p>
            <div className="border-t border-foreground/20 pt-4 md:col-span-4 md:col-start-9">
              <p className="ed-caption text-foreground">Available in limited quantities</p>
              {endsAt && <p className="mt-2 text-sm text-muted-foreground">{saleEndLabel(endsAt)}</p>}
            </div>
          </div>
        </Reveal>

        {/* Members and non-members each see only their own offers */}
        <div className="mt-10 md:mt-14 border border-border p-5 md:p-8">
          <p className="ed-caption text-muted-foreground">See your offers</p>
          <div className="mt-4 grid grid-cols-2 gap-3" role="tablist" aria-label="Choose member or non-member offers">
            {(["member", "non_member"] as View[]).map((v) => (
              <Button key={v} role="tab" aria-selected={view === v} variant={view === v ? "default" : "outline"}
                className="h-12 text-base" onClick={() => pickView(v)}>
                {VIEW_LABEL[v]}
              </Button>
            ))}
          </div>
          {view && (
            <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Jump to an offer">
              <a href="#pt-edit" className="underline underline-offset-4">Personal Training</a>
              <a href="#movement-edit" className="underline underline-offset-4">Classes</a>
            </nav>
          )}
        </div>
      </section>

      <div ref={contentRef} className="scroll-mt-20" />
      {view && (
        <>
          <section>
            <EdImage src={trainingPhoto} alt="The training floor at Storm Wellness Club" className="h-[28vh] min-h-[200px] md:h-[55vh]" eager />
          </section>

          <section id="pt-edit" className="container py-14 md:py-24 max-w-4xl scroll-mt-20">
            <Reveal>
              <Chapter n="02" label="Semi-Private Personal Training" />
              <h2 className="font-serif text-3xl md:text-4xl mt-4">Semi-private training packages</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl">
                For a limited time, enjoy exclusive Black Friday pricing on personal training packages designed around
                your goals, your progress, and your long-term results.
              </p>
              <p className="mt-3 font-medium">Limited packages available.</p>
              <p className="mt-6 ed-caption text-muted-foreground">{VIEW_LABEL[view]} pricing</p>
            </Reveal>

            {isLoading ? (
              <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 || ended ? (
              <p className="mt-12 font-serif text-2xl">This offer has ended.</p>
            ) : (
              <>
                <div className="mt-4 border-t border-border">
                  {rows.filter(([, r]) => r[view]).map(([sessions, r]) => (
                    <div key={sessions} className="grid grid-cols-2 gap-4 py-6 border-b border-border items-start">
                      <div>
                        <p className="font-serif text-2xl">{sessions} sessions</p>
                        <p className="text-xs text-muted-foreground mt-1">Use within {monthsLabel(r[view]!.expiration_days)}</p>
                      </div>
                      {priceCell(r[view], !user || audience === view)}
                    </div>
                  ))}
                </div>
                <div className="mt-8 text-sm text-muted-foreground space-y-2">
                  {!user ? (
                    <p>
                      <Link to={authLink("signin", "#pt-edit")} className="underline underline-offset-4 text-foreground">Sign in</Link> or{" "}
                      <Link to={authLink("signup", "#pt-edit")} className="underline underline-offset-4 text-foreground">make an account</Link>{" "}
                      to buy.
                    </p>
                  ) : audience && audience !== view ? (
                    <p>
                      Your account is set up for {VIEW_LABEL[audience].toLowerCase()} offers.{" "}
                      <button type="button" className="underline underline-offset-4 text-foreground" onClick={() => pickView(audience)}>See {VIEW_LABEL[audience].toLowerCase()} offers</button>
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </>
      )}

      <MovementEditSection audience={view} authLink={authLink} />

      <Sheet open={!!picked} onOpenChange={(o) => { if (!o && !busy) setPicked(null); }}>
        <SheetContent side="bottom" className="max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl">
              {done ? "Payment successful" : failed ? "Payment didn't go through" : step === "confirm" ? "Please confirm" : pickedPlan ? "Your payment plan" : "Your package"}
            </SheetTitle>
            <SheetDescription>
              {picked && `Semi-Private Personal Training · ${picked.sessions} sessions`}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 px-6 pb-6">
            {done && picked ? (
              <>
                <p className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 shrink-0 text-accent" /><span>Your payment went through and your {picked.sessions}-session package is on your account.</span></p>
                <div className="text-sm space-y-1 border-t border-border pt-3">
                  <div className="flex justify-between"><span>Paid today</span><span>{formatUsd(done.chargedCents)}</span></div>
                  {done.last4 && <div className="flex justify-between text-muted-foreground"><span>Card</span><span>{done.brand} ending in {done.last4}</span></div>}
                </div>
                {done.plan && quote?.rows && quote.rows.length > 1 && (
                  <div className="text-sm border-t border-border pt-3">
                    <p className="ed-caption text-muted-foreground mb-2">Upcoming payments</p>
                    {quote.rows.slice(1).map((r) => (
                      <div key={r.number} className="flex justify-between py-1"><span>{shortDate(r.dueDate)}</span><span>{formatUsd(r.amountCents + r.feeCents)}</span></div>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">Request your first session from Personal Training in your portal.</p>
                <Button asChild className="w-full"><Link to={`${portal}/personal-training`}>Go to Personal Training</Link></Button>
              </>
            ) : failed ? (
              <>
                <p className="flex items-start gap-2"><XCircle className="h-5 w-5 shrink-0 text-destructive" /><span>{failed}</span></p>
                <div className="flex flex-col gap-2">
                  <Button className="w-full" onClick={() => { setFailed(null); setStep("review"); }}>Try again</Button>
                  <Button asChild variant="outline" className="w-full"><Link to={`${portal}/payment-methods`}>Use a different card</Link></Button>
                </div>
              </>
            ) : busy && quote ? (
              <div className="py-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                Processing your payment. Please don't close this page.
              </div>
            ) : busy && !quote ? (
              <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : quote && picked && step === "confirm" ? (
              <>
                <p className="text-sm">
                  Your {quote.brand} ending in {quote.last4} will be charged{" "}
                  <span className="font-medium">{formatUsd(quote.plan && quote.rows ? quote.rows[0].amountCents + quote.rows[0].feeCents : quote.totalCents)}</span> today
                  {quote.plan && quote.rows && quote.rows.length > 1
                    ? `, then ${quote.rows.length - 1} more monthly payments on the dates shown.`
                    : "."}
                </p>
                <div className="flex flex-col gap-2">
                  <Button className="w-full" onClick={buy}>Confirm and pay</Button>
                  <Button variant="outline" className="w-full" onClick={() => setStep("review")}>Go back</Button>
                </div>
              </>
            ) : quote?.plan && quote.rows && picked ? (
              <>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Package</span><span>{formatUsd(quote.totalCents)}</span></div>
                  <div className="flex justify-between"><span>Payment processing fee</span><span>{formatUsd(quote.rows.reduce((t, r) => t + r.feeCents, 0))}</span></div>
                  <div className="flex justify-between font-medium pt-2 border-t border-border"><span>Total</span><span>{formatUsd(quote.rows.reduce((t, r) => t + r.amountCents + r.feeCents, 0))}</span></div>
                </div>
                <div className="text-sm border-t border-border pt-3">
                  <p className="ed-caption text-muted-foreground mb-2">Payment schedule</p>
                  {quote.rows.map((r) => (
                    <div key={r.number} className="flex justify-between py-1">
                      <span>Payment {r.number} · {r.number === 1 ? "Due today" : `Due ${shortDate(r.dueDate)}`}</span>
                      <span>{formatUsd(r.amountCents + r.feeCents)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Remaining payments are charged automatically to your {quote.brand} ending in {quote.last4} on each due date until the plan is complete.
                  No interest. The plan ends after the final payment. Your sessions must be used within {monthsLabel(picked.expiration_days)} of today.
                </p>
                {err && <p className="text-sm text-destructive">{err}</p>}
                <Button className="w-full" onClick={() => setStep("confirm")}>Continue</Button>
              </>
            ) : quote && picked ? (
              <>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span>Package</span><span>{formatUsd(picked.price_cents)}</span></div>
                  <div className="flex justify-between"><span>Payment processing fee</span><span>{formatUsd(quote.feeCents ?? 0)}</span></div>
                  <div className="flex justify-between font-medium pt-2 border-t border-border"><span>Total</span><span>{formatUsd(quote.totalCents)}</span></div>
                </div>
                <p className="text-sm text-muted-foreground">Charged to your {quote.brand} ending in {quote.last4}. Your sessions must be used within {monthsLabel(picked.expiration_days)} of today.</p>
                {err && <p className="text-sm text-destructive">{err}</p>}
                <Button className="w-full" onClick={() => setStep("confirm")}>Continue</Button>
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
