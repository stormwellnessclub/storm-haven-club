import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Calendar, Sparkles, Leaf, Heart, Loader2, ArrowRight } from "lucide-react";
import { useUpcomingGutResetSessions, type GutResetSession } from "@/hooks/useGutResetSessions";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import gutResetHero from "@/assets/gut-reset-hero.jpg";

const PRICES = {
  "3day": 26500,
  "5day": 37500,
} as const;

const drinks = [
  { name: "Booster", tag: "Morning Vitality Elixir", desc: "The perfect way to kickstart your day. A harmonious blend designed to replace your morning coffee with sustained vitality and mental clarity — no caffeine crash." },
  { name: "Awaken Storm", tag: "Metabolism Igniter", desc: "Your secret weapon for igniting your metabolism. A synergy of metabolism-boosting elements revs up your internal engine so you burn calories more efficiently." },
  { name: "Storm Biotic", tag: "Gut's Best Friend", desc: "A prebiotic boost formulated to nourish the friendly bacteria in your gut and create a thriving environment for digestion and immunity." },
  { name: "Storm Digest", tag: "Biofilm Breakdown", desc: "Designed to break down stubborn biofilm and aid in efficient nutrient digestion. Enhance your body's ability to absorb essential nourishment." },
  { name: "Green Storm", tag: "Gut Revival", desc: "A probiotic-based juice packed with a diverse array of beneficial probiotics. Balances your microbiome and supports overall gut health." },
  { name: "Bloody Storm", tag: "Liver & Blood Cleanser", desc: "The ultimate liver detoxifier and blood cleanser. A rejuvenating blend that helps your body eliminate toxins and impurities." },
];

const waters = [
  { name: "Rose Hibiscus Elixir", desc: "Soothing infusion designed to show your liver some love and reduce inflammation. Opens lymph pathways for detoxification and revitalization." },
  { name: "Lemon Charcoal Cleanse", desc: "Purifying formula that clears wind and dampness while providing essential kidney support. Activated charcoal binds toxins." },
  { name: "Chlorophyll Chia Water", desc: "Digestive oasis that oxygenates cells, reduces bloat, and bolsters your immune system. Chia seeds add a satisfying crunch." },
  { name: "Oxygen Water", desc: "Flushes toxins, fights bacteria, and energizes your body. Proprietary blend of gut-healing herbs supports overall well-being." },
  { name: "Pineapple Paradise", desc: "Tropical refresher rich in bromelain, aiding digestion and reducing bloating. Sip your way to a more vibrant you." },
  { name: "Ginger Spice Revive", desc: "Warming ginger with a touch of spice enhances circulation, boosts metabolism, and supports your gut reset." },
];

const saladsAndShots = [
  { name: "Digestive Reset Salad", tag: "A Symphony of Freshness", desc: "Arugula, mint, lemon, mango, bee pollen, and hemp seeds with our special house-made dressing. Every bite supports digestion." },
  { name: "Gut Protective Salad", tag: "Nourishing Greens", desc: "Spinach, avocado, cucumber, and blueberries with dry toppers that maximize the effectiveness of every ingredient." },
  { name: "Gut Food Salad", tag: "Gut-Loving Greens", desc: "Mixed greens, parsley, mint, ginger, and apple skin — a powerhouse of gut-loving ingredients with house-made dressing." },
  { name: "Morning Gut Balancer Shot", tag: "All-In-One Daily Essential", desc: "Taken each morning to balance gut pH, support insulin regulation, bind toxins, and aid digestion." },
  { name: "Oxygen Revive Shot", tag: "Gut Lining Reset", desc: "Potent elixir that flushes toxins, rejuvenates your gut, and promotes overall digestive wellness." },
  { name: "Post-Biotic Revival Shot", tag: "Microbiome Boost", desc: "Harmonious infusion of post-biotics designed to nourish and empower your gut bacteria for a thriving microbiome." },
];

const snacks = [
  { name: "Gut Seal Chia Pudding", desc: "Proprietary creation bursting with flavor and packed with ingredients to heal and seal your gut lining." },
  { name: "Gut Rejuvenation Trail Mix", desc: 'Not your basic trail mix. Our in-house blend works wonders on your gut — a delicious path to gut revival.' },
  { name: "Veggie Crunch Pack", desc: "Fresh, crunchy vegetables — carrots, celery, cucumber — paired with a savory hummus dip for a satisfying detox-friendly snack." },
];

const benefits = [
  { icon: Leaf, title: "Nourish Your Gut", desc: "Promotes a healthy microbiome, improves nutrient absorption, reduces bloating, and enhances digestion." },
  { icon: Sparkles, title: "Weight Loss Support", desc: "Optimizing your gut health aids natural weight loss and helps you achieve sustainable goals." },
  { icon: Heart, title: "Anti-Inflammatory", desc: "Targets the root causes of inflammation and promotes a balanced inflammatory response." },
  { icon: Calendar, title: "Organic & Pure", desc: "Meticulously crafted using only the finest organic ingredients you can trust." },
];

const faqs = [
  { q: "What's the difference between the 3-Day and 5-Day reset?", a: "The 3-Day reset is a quick recalibration — ideal if you're new to cleansing or want a focused boost. The 5-Day reset goes deeper, giving your gut more time to rebalance and your body more time to release built-up toxins." },
  { q: "Do I have to pick everything up daily?", a: "Yes — for maximum freshness and potency, your drinks, salads, shots, and snacks are prepared fresh and picked up each day of the program." },
  { q: "Is everything organic?", a: "Yes. Every drink, salad, shot, and snack is crafted with organic, whole-food ingredients." },
  { q: "Will I be hungry?", a: "No. Each day is designed to keep you nourished, energized, and satisfied with curated salads, snacks, and powerful elixirs." },
  { q: "Can I do the reset if I'm not a member?", a: "Yes — the gut reset is open to everyone. Members and non-members pay the same price." },
  { q: "What if I have allergies or dietary restrictions?", a: "Reach out to us when you reserve your spot. We can accommodate most dietary needs with advance notice." },
];

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface ReserveDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session: GutResetSession | null;
  option: "3day" | "5day" | null;
}

function ReserveDialog({ open, onOpenChange, session, option }: ReserveDialogProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Prefill from profile
  useMemo(() => {
    if (profile) {
      setName(((profile.first_name || "") + " " + (profile.last_name || "")).trim());
      setEmail(profile.email || user?.email || "");
      setPhone(profile.phone || "");
    } else if (user?.email) {
      setEmail(user.email);
    }
  }, [profile, user?.email]);

  const handleCheckout = async () => {
    if (!session || !option) return;
    if (!name.trim() || !email.trim()) {
      toast.error("Please enter your name and email");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gut-reset-create-checkout", {
        body: {
          session_id: session.id,
          option,
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim() || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Could not start checkout");
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
      setLoading(false);
    }
  };

  const amount = option ? PRICES[option] / 100 : 0;
  const label = option === "3day" ? "3-Day Gut Reset" : option === "5day" ? "5-Day Gut Reset" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reserve your {label}</DialogTitle>
          <DialogDescription>
            {session && (
              <>Starting <strong>{formatDate(session.start_date)}</strong> — ${amount.toFixed(0)}</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="gr-name">Full name</Label>
            <Input id="gr-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="gr-email">Email</Label>
            <Input id="gr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="gr-phone">Phone (optional)</Label>
            <Input id="gr-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button className="w-full" size="lg" onClick={handleCheckout} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue to secure checkout
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You'll be redirected to Stripe to complete payment. Your spot is held once payment is confirmed.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GutReset() {
  const { data: sessions, isLoading } = useUpcomingGutResetSessions();
  const [reserveOpen, setReserveOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<GutResetSession | null>(null);
  const [activeOption, setActiveOption] = useState<"3day" | "5day" | null>(null);

  const openReserve = (s: GutResetSession, opt: "3day" | "5day") => {
    setActiveSession(s);
    setActiveOption(opt);
    setReserveOpen(true);
  };

  const scrollToSessions = () => {
    document.getElementById("upcoming")?.scrollIntoView({ behavior: "smooth" });
  };

  const upcoming = sessions ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Gut Reset Cleanse Program",
    provider: { "@type": "Organization", name: "Storm Wellness Club" },
    description:
      "Holistic gut reset cleanse with proprietary drinks, infused waters, curated salads, and invigorating shots. Available as a 3-day or 5-day program.",
    offers: [
      { "@type": "Offer", name: "3-Day Gut Reset", price: 265, priceCurrency: "USD" },
      { "@type": "Offer", name: "5-Day Gut Reset", price: 375, priceCurrency: "USD" },
    ],
  };

  return (
    <Layout>
      <SEOHead
        title="Gut Reset Cleanse Program | Storm Wellness Club"
        description="Reset your gut health with our organic 3-day ($265) or 5-day ($375) cleanse program — proprietary drinks, infused waters, curated salads, and invigorating shots."
        path="/gut-reset"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative h-[70vh] min-h-[520px] flex items-center justify-center overflow-hidden">
        <img
          src={gutResetHero}
          alt="Detox drinks, infused waters, and fresh ingredients"
          className="absolute inset-0 w-full h-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />
        <div className="relative z-10 text-center text-white max-w-3xl px-6">
          <Badge variant="secondary" className="mb-6 bg-white/15 text-white border-white/20 backdrop-blur-sm">
            Limited Cohorts • Organic
          </Badge>
          <h1 className="font-serif text-4xl md:text-6xl font-light mb-6 leading-tight">
            Gut Reset Cleanse Program
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-8 font-light">
            Revitalize your well-being from within. A holistic, organic reset designed to restore your gut,
            release inflammation, and reset your body's natural balance.
          </p>
          <Button size="lg" onClick={scrollToSessions} className="bg-white text-foreground hover:bg-white/90">
            See upcoming dates <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Upcoming sessions */}
      <section id="upcoming" className="py-20 bg-background">
        <div className="container mx-auto px-6 max-w-5xl">
          <SectionHeading
            title="Upcoming Resets"
            subtitle="Reserve your spot in our next cleanse cohort"
            align="center"
          />
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : upcoming.length === 0 ? (
            <Card className="p-12 text-center bg-muted/30">
              <p className="text-lg text-muted-foreground mb-2">No resets currently scheduled.</p>
              <p className="text-sm text-muted-foreground">
                Check back soon — we'll be announcing our next cohort shortly.
              </p>
            </Card>
          ) : (
            <div className="space-y-6 mt-8">
              {upcoming.map((s) => {
                const spotsLeft = s.capacity !== null ? Math.max(0, s.capacity - s.spots_taken) : null;
                const soldOut = spotsLeft !== null && spotsLeft <= 0;
                return (
                  <Card key={s.id} className="p-6 md:p-8">
                    <div className="grid md:grid-cols-3 gap-6 items-center">
                      <div>
                        <div className="text-sm uppercase tracking-wide text-muted-foreground mb-1">
                          Starts
                        </div>
                        <div className="font-serif text-2xl">{formatDate(s.start_date)}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {s.length_days}-day program
                          {spotsLeft !== null && (
                            <> · {soldOut ? "Sold out" : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}</>
                          )}
                        </div>
                        {s.notes && <p className="text-sm mt-3 text-muted-foreground">{s.notes}</p>}
                      </div>
                      <div className="md:col-span-2 grid sm:grid-cols-2 gap-3">
                        <Button
                          size="lg"
                          variant="outline"
                          disabled={soldOut}
                          onClick={() => openReserve(s, "3day")}
                          className="h-auto py-4 flex-col items-start"
                        >
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">3-Day</span>
                          <span className="text-lg font-serif">Reserve · $265</span>
                        </Button>
                        <Button
                          size="lg"
                          disabled={soldOut}
                          onClick={() => openReserve(s, "5day")}
                          className="h-auto py-4 flex-col items-start"
                        >
                          <span className="text-xs uppercase tracking-wide opacity-80">5-Day</span>
                          <span className="text-lg font-serif">Reserve · $375</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Why */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6 max-w-6xl">
          <SectionHeading
            title="Discover the Power of Organic Purity"
            subtitle="Are you ready to embark on a transformative journey toward a healthier lifestyle? Our Gut Reset Cleanse is designed to reset your gut, aid weight loss, and combat inflammation — a holistic transformation from the inside out."
            align="center"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {benefits.map((b) => (
              <Card key={b.title} className="p-6 text-center">
                <b.icon className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-serif text-xl mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-20">
        <div className="container mx-auto px-6 max-w-6xl">
          <SectionHeading
            title="What's Included in Your Reset"
            subtitle="A proprietary blend of drinks, curated salads, and invigorating shots — every component designed to work together."
            align="center"
          />

          {/* Drinks */}
          <h3 className="font-serif text-3xl mt-16 mb-8 text-center">The Drinks</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drinks.map((d) => (
              <Card key={d.name} className="p-6">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{d.tag}</div>
                <h4 className="font-serif text-xl mb-3">{d.name}</h4>
                <p className="text-sm text-muted-foreground">{d.desc}</p>
              </Card>
            ))}
          </div>

          {/* Waters */}
          <h3 className="font-serif text-3xl mt-20 mb-3 text-center">Infused Waters</h3>
          <p className="text-center text-muted-foreground italic mb-8">Because water should never be basic.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {waters.map((w) => (
              <Card key={w.name} className="p-6">
                <h4 className="font-serif text-xl mb-3">{w.name}</h4>
                <p className="text-sm text-muted-foreground">{w.desc}</p>
              </Card>
            ))}
          </div>

          {/* Salads & Shots */}
          <h3 className="font-serif text-3xl mt-20 mb-8 text-center">Salads & Shots</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {saladsAndShots.map((s) => (
              <Card key={s.name} className="p-6">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{s.tag}</div>
                <h4 className="font-serif text-xl mb-3">{s.name}</h4>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>

          {/* Snacks */}
          <h3 className="font-serif text-3xl mt-20 mb-8 text-center">Snacks</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {snacks.map((s) => (
              <Card key={s.name} className="p-6">
                <h4 className="font-serif text-xl mb-3">{s.name}</h4>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Who can benefit */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <SectionHeading title="Who Can Benefit" align="center" />
          <p className="text-lg text-muted-foreground leading-relaxed mt-6">
            Our Gut Reset is for anyone seeking to kickstart their wellness journey, improve digestion,
            boost energy levels, and enhance their overall sense of well-being. Whether you're looking to
            jumpstart a healthier lifestyle or simply want to give your body a refreshing reset, this
            program is designed for you.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-6 max-w-3xl">
          <SectionHeading title="Frequently Asked" align="center" />
          <Accordion type="single" collapsible className="mt-8">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">Ready for your reset?</h2>
          <p className="text-primary-foreground/80 mb-8 text-lg">
            Reserve your spot in our next cohort and start your transformation.
          </p>
          <Button size="lg" variant="secondary" onClick={scrollToSessions}>
            View upcoming dates
          </Button>
        </div>
      </section>

      <ReserveDialog
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        session={activeSession}
        option={activeOption}
      />
    </Layout>
  );
}
