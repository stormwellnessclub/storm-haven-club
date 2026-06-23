import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ChevronRight, Snowflake, Droplets, Sparkles } from "lucide-react";

const BASE_URL = "https://stormwellnessclub.com";
const PATH = "/recovery-guide";
const TITLE = "Cold Plunge vs Cryotherapy: Recovery Guide — Livonia, MI";
const DESCRIPTION =
  "Cold plunge vs cryotherapy: physiological benefits, recovery times, and which to choose for your goals. A practical guide from Storm Wellness Club in Livonia, MI.";

const faqs = [
  {
    q: "Is a cold plunge or cryotherapy better for muscle recovery?",
    a: "Both reduce inflammation and soreness, but they work differently. Cold plunge cools you to the core through water immersion, which most research shows is more effective for whole-body muscle recovery after intense training. Cryotherapy chills the skin and superficial tissue rapidly with cold air, which is excellent for joint pain, localized inflammation, and a fast mood/energy lift.",
  },
  {
    q: "Which is colder — cold plunge or cryotherapy?",
    a: "Cryotherapy chambers reach roughly -200°F to -240°F for two to three minutes, while a cold plunge is typically 45–55°F for two to five minutes. Cryotherapy feels more intense on the skin, but cold plunge cools the body more deeply because water conducts heat about 25 times faster than air.",
  },
  {
    q: "How often can I do each?",
    a: "Most members do cold plunge 3–5 times per week and cryotherapy 2–4 times per week. Many alternate — cryotherapy on heavy training or recovery days, cold plunge after workouts or as a daily morning reset.",
  },
  {
    q: "Can I do both in the same visit?",
    a: "Yes. A common stack at Storm is infrared sauna → cold plunge → red light therapy, or a cryotherapy session followed by red light. Avoid doing two intense cold modalities back-to-back; space them by at least an hour.",
  },
  {
    q: "Which one is better for beginners?",
    a: "Cryotherapy is often easier to start with — it's a short, dry, controlled three minutes. Cold plunge has a steeper learning curve because the water immersion feels more intense, but it gets easier quickly. Both are safe for healthy adults; consult a doctor first if you have a heart condition, uncontrolled blood pressure, Raynaud's, or are pregnant.",
  },
  {
    q: "Where can I try cold plunge and cryotherapy near Livonia?",
    a: "Storm Wellness Club at 18340 Middlebelt Rd in Livonia, MI has both — plus infrared sauna, red light therapy, salt room, and Starpool ZeroBody — all in one recovery suite. We serve the greater Detroit metro including Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, and Southfield.",
  },
];

const comparisonRows = [
  { label: "Temperature", plunge: "45–55°F water", cryo: "-200° to -240°F air" },
  { label: "Session length", plunge: "2–5 minutes", cryo: "2–3 minutes" },
  { label: "How it cools you", plunge: "Whole-body, deep — water conducts heat ~25× faster than air", cryo: "Surface and superficial tissue, very fast" },
  { label: "Best for", plunge: "Muscle recovery, mental resilience, contrast therapy with sauna", cryo: "Joint inflammation, quick energy/mood lift, time-pressed days" },
  { label: "Feels like", plunge: "Intense cold + breath control challenge", cryo: "Sharp, dry, tingly — easier to tolerate" },
  { label: "Recovery time after", plunge: "Warm up 10–15 min, then back to normal", cryo: "Immediate — walk out and go" },
  { label: "Frequency", plunge: "Daily is fine for most people", cryo: "2–4× per week typical" },
  { label: "Pairs well with", plunge: "Sauna (contrast therapy), red light", cryo: "Red light, training days, ZeroBody" },
];

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Recovery Guide", item: `${BASE_URL}${PATH}` },
  ],
};

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Cold Plunge vs Cryotherapy: A Practical Recovery Guide",
  description: DESCRIPTION,
  mainEntityOfPage: `${BASE_URL}${PATH}`,
  author: { "@type": "Organization", name: "Storm Wellness Club" },
  publisher: {
    "@type": "Organization",
    name: "Storm Wellness Club",
    url: BASE_URL,
  },
  about: ["Cold Plunge", "Cryotherapy", "Recovery", "Cold Therapy"],
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function RecoveryGuide() {
  return (
    <Layout>
      <SEOHead title={TITLE} description={DESCRIPTION} path={PATH} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-12 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4 flex items-center gap-1 flex-wrap">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/spa" className="hover:text-foreground">Recovery Spa</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Recovery Guide</span>
          </nav>
          <p className="text-accent text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Recovery Guide
          </p>
          <h1 className="heading-display mb-4">Cold Plunge vs Cryotherapy</h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            Both are powerful cold therapies — but they work differently and shine in different
            moments. Here's how to choose between cold plunge and whole-body cryotherapy based on
            your training, goals, and schedule, written by the recovery team at Storm Wellness Club
            in Livonia, MI.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/apply">Apply for Membership</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/spa">View all recovery services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Two-card overview */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-4xl grid gap-6 md:grid-cols-2">
          <div className="p-6 rounded-lg border border-border bg-secondary/20">
            <div className="flex items-center gap-2 mb-3">
              <Droplets className="h-5 w-5 text-accent" />
              <h2 className="font-serif text-2xl">Cold Plunge</h2>
            </div>
            <p className="text-foreground/90 leading-relaxed mb-4">
              Two to five minutes of cold-water immersion at 45–55°F. Cools your core deeply because
              water transfers heat about 25 times faster than air. The classic protocol for
              post-workout muscle recovery, mental resilience, and contrast therapy with the sauna.
            </p>
            <ul className="space-y-2 text-foreground/90">
              <li className="flex gap-2"><span className="text-accent mt-1">•</span>Deep, whole-body cooling</li>
              <li className="flex gap-2"><span className="text-accent mt-1">•</span>Strong dopamine and norepinephrine response</li>
              <li className="flex gap-2"><span className="text-accent mt-1">•</span>Best paired with sauna for contrast therapy</li>
            </ul>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/spa/cold-plunge">Learn about Cold Plunge</Link>
            </Button>
          </div>

          <div className="p-6 rounded-lg border border-border bg-secondary/20">
            <div className="flex items-center gap-2 mb-3">
              <Snowflake className="h-5 w-5 text-accent" />
              <h2 className="font-serif text-2xl">Whole-Body Cryotherapy</h2>
            </div>
            <p className="text-foreground/90 leading-relaxed mb-4">
              Two to three minutes in a chamber chilled to roughly -200°F to -240°F with cold,
              dry air. It cools your skin and superficial tissue rapidly, triggering a powerful
              anti-inflammatory and mood-boost response without ever getting you wet.
            </p>
            <ul className="space-y-2 text-foreground/90">
              <li className="flex gap-2"><span className="text-accent mt-1">•</span>Fast, dry, no warm-up afterward</li>
              <li className="flex gap-2"><span className="text-accent mt-1">•</span>Targets joint inflammation and surface tissue</li>
              <li className="flex gap-2"><span className="text-accent mt-1">•</span>Easy to fit into a busy schedule</li>
            </ul>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/spa/cryotherapy">Learn about Cryotherapy</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="font-serif text-3xl mb-6">Side-by-side comparison</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left p-4 font-serif font-normal w-1/4">&nbsp;</th>
                  <th className="text-left p-4 font-serif font-normal">Cold Plunge</th>
                  <th className="text-left p-4 font-serif font-normal">Cryotherapy</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="p-4 text-muted-foreground align-top">{row.label}</td>
                    <td className="p-4 text-foreground/90 align-top">{row.plunge}</td>
                    <td className="p-4 text-foreground/90 align-top">{row.cryo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Goal-based picker */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="font-serif text-3xl mb-6">Which should you choose?</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-serif text-xl mb-2">If your goal is muscle recovery after hard training</h3>
              <p className="text-muted-foreground leading-relaxed">
                Lean cold plunge. Whole-body water immersion cools muscle tissue more thoroughly
                than cold air, which is why athletes have used ice baths for decades. Two to four
                minutes within an hour of training is the sweet spot — unless you're specifically
                trying to maximize hypertrophy from a session, in which case wait 4–6 hours.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl mb-2">If your goal is joint pain or localized inflammation</h3>
              <p className="text-muted-foreground leading-relaxed">
                Lean cryotherapy. The intense surface cold is excellent for arthritic joints,
                tendinitis, and overuse injuries, and the dry environment is gentler on people
                who don't love water immersion.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl mb-2">If your goal is energy, focus, and mood</h3>
              <p className="text-muted-foreground leading-relaxed">
                Either works — both trigger a large dopamine and norepinephrine release that
                lasts for hours. Cold plunge produces a slightly longer-lasting lift; cryotherapy
                gives a faster, sharper one with no warm-up time.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl mb-2">If you're short on time</h3>
              <p className="text-muted-foreground leading-relaxed">
                Cryotherapy. Three minutes in, walk out dry and warm in your normal clothes,
                done. No towel, no shower, no warm-up.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl mb-2">If you want the deepest stress-resilience training</h3>
              <p className="text-muted-foreground leading-relaxed">
                Cold plunge. Sitting with the discomfort of water immersion teaches nervous-system
                control in a way that a three-minute chamber session doesn't quite replicate.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl mb-2">If you want the best of both</h3>
              <p className="text-muted-foreground leading-relaxed">
                Use both, on different days. A common Storm protocol: sauna → cold plunge → red
                light on training days, and a standalone cryotherapy session on rest days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="font-serif text-3xl mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((f, i) => (
              <div key={i}>
                <h3 className="font-serif text-xl mb-2">{f.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related */}
      <section className="py-16 bg-background border-t border-border">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="font-serif text-2xl mb-6">Explore the recovery suite</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { to: "/spa/cold-plunge", label: "Cold Plunge" },
              { to: "/spa/cryotherapy", label: "Cryotherapy" },
              { to: "/spa/infrared-sauna", label: "Infrared Sauna" },
              { to: "/spa/red-light-therapy", label: "Red Light Therapy" },
              { to: "/spa/sauna-steam", label: "Sauna & Steam Room" },
              { to: "/spa/zerobody", label: "Starpool ZeroBody" },
            ].map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-accent hover:bg-secondary/30 transition-colors"
              >
                <span className="font-serif text-lg">{r.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Local CTA */}
      <section className="py-16 bg-secondary/30 border-t border-border">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="font-serif text-3xl mb-3">Try both at Storm Wellness Club</h2>
          <p className="text-muted-foreground mb-6">
            Cold plunge, cryotherapy, infrared sauna, red light therapy, salt room, and ZeroBody —
            all in one recovery suite at 18340 Middlebelt Rd, Livonia, MI 48152. Serving Farmington
            Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, and the greater Detroit metro.
          </p>
          <Button asChild size="lg">
            <Link to="/apply">Apply for Membership</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
