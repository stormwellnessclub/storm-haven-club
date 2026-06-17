import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { CafeOrderContent } from "@/components/cafe/CafeOrderContent";

const BASE_URL = "https://stormwellnessclub.com";

const cafeFaqs = [
  {
    q: "Is there a juice bar or smoothie bar near Livonia, MI?",
    a: "Yes — Storm Café inside Storm Wellness Club at 18340 Middlebelt Rd in Livonia is a full juice bar and smoothie bar. Cold-pressed juices, real-fruit smoothies, protein shakes, and wellness shots are made fresh daily. A short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, and Southfield.",
  },
  {
    q: "Is the Storm Café open to non-members?",
    a: "Yes — the Storm Café is open to the public during club hours. You don't need a Storm Wellness Club membership to order smoothies, protein shakes, açaí bowls, juices, or coffee. Walk in, order on the screen, and we'll have it ready.",
  },
  {
    q: "Is the café open for breakfast?",
    a: "Yes — we open with the club in the morning and serve breakfast smoothies, açaí bowls, espresso drinks, and grab-and-go bites. It's a popular pre-class breakfast spot for members training before work.",
  },
  {
    q: "Where can I get the best protein shake near me in Livonia?",
    a: "Storm Café blends protein shakes with clean whey or plant-based protein, real fruit, nut or oat milk, and add-ins like nut butter, greens, or collagen — 25–35g of protein per shake, no powdered fillers. Tap any item on the menu for full macros.",
  },
  {
    q: "Do you offer dairy-free, vegan, or gluten-free options?",
    a: "Yes. Most smoothies, açaí bowls, and cold-pressed juices are dairy-free by default, and we offer plant-based protein and oat or almond milk swaps on request. Many bowls and snacks are gluten-free as well — check the menu tags.",
  },
  {
    q: "Where can I get an açaí bowl near Livonia?",
    a: "Storm Café serves fresh açaí and pitaya bowls daily, made with frozen fruit, granola, nut butter, and seasonal toppings — a short drive from Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, and Southfield.",
  },
  {
    q: "Can I order ahead?",
    a: "Yes — members can order ahead from the member portal, and walk-ins can order at the kiosk. Most drinks are ready in 5–8 minutes.",
  },
];

export default function Cafe() {
  const restaurantLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: "Storm Café at Storm Wellness Club",
    image: `${BASE_URL}/pwa-512x512.png`,
    url: `${BASE_URL}/cafe`,
    telephone: "",
    servesCuisine: [
      "Smoothies",
      "Protein Shakes",
      "Açaí Bowls",
      "Cold-Pressed Juice",
      "Coffee",
      "Healthy Snacks",
    ],
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "18340 Middlebelt Rd",
      addressLocality: "Livonia",
      addressRegion: "MI",
      postalCode: "48152",
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 42.4034,
      longitude: -83.3497,
    },
    areaServed: [
      "Livonia, MI",
      "Farmington Hills, MI",
      "Plymouth, MI",
      "Northville, MI",
      "Novi, MI",
      "Redford, MI",
      "Westland, MI",
      "Canton, MI",
      "Garden City, MI",
      "Southfield, MI",
    ],
    acceptsReservations: false,
    parentOrganization: {
      "@type": "HealthClub",
      name: "Storm Wellness Club",
      url: BASE_URL,
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Café", item: `${BASE_URL}/cafe` },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cafeFaqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <Layout>
      <SEOHead
        title="Café, Juice & Smoothie Bar in Livonia"
        description="Healthy café in Livonia, MI — smoothies, protein shakes, açaí bowls, cold-pressed juice & espresso. Open to the public at Storm Wellness Club."
        path="/cafe"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(restaurantLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
      </Helmet>

      {/* SEO editorial intro — keyword-rich, crawlable copy above the live menu */}
      <section className="pt-28 pb-10 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <p className="text-accent text-sm uppercase tracking-widest mb-4">
            Storm Café · Livonia, MI
          </p>
          <h1 className="heading-display mb-4">
            Café, Juice Bar &amp; Smoothie Bar in Livonia, MI
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            The Storm Café is the in-house café, juice bar, and smoothie bar
            inside Storm Wellness Club — serving fresh smoothies, protein
            shakes, açaí bowls, cold-pressed juices, espresso, and clean
            snacks every day. Open to members and the public, centrally
            located at 18340 Middlebelt Rd in Livonia and a short drive from
            Farmington Hills, Plymouth, Northville, Novi, Redford, Westland,
            Canton, and Southfield. If you're searching for a healthy café
            near you, a juice bar near you, or a smoothie bar near you in
            the Detroit metro — you've found it.
          </p>
        </div>
      </section>

      {/* Menu category descriptions — gives Google something to read */}
      <section className="py-12 bg-background border-b border-border">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-xl mb-2">Smoothies</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Real-fruit smoothies blended with nut or oat milk, optional
                protein, and seasonal add-ins. A post-class staple for our
                members and the easiest healthy lunch in Livonia.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-xl mb-2">Protein Shakes</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Clean whey and plant-based protein shakes built for recovery —
                25–35g of protein per shake, blended with real ingredients,
                never powdered fillers.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-xl mb-2">Açaí &amp; Pitaya Bowls</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Thick, frozen-fruit bowls topped with granola, nut butter,
                fresh fruit, and seasonal toppings. The best açaí bowl near
                Livonia, made to order.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-xl mb-2">Cold-Pressed Juice</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Rotating cold-pressed juices, wellness shots, and hydration
                blends — designed for clean energy before training or as a
                mid-day reset.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-xl mb-2">Coffee &amp; Espresso</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Espresso drinks, drip coffee, matcha, and seasonal lattes —
                with dairy and plant-milk options.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-xl mb-2">Snacks &amp; Light Meals</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Protein-forward snacks, grab-and-go bites, and seasonal items
                — built for people training, recovering, or working from the
                lounge.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Existing live ordering UI */}
      <CafeOrderContent variant="public" showHero />

      {/* FAQ — also rendered as FAQPage JSON-LD above */}
      <section className="py-16 bg-secondary/30 border-t border-border">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="font-serif text-3xl mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {cafeFaqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-serif text-xl mb-2">{f.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-links to recovery to share authority across the club */}
      <section className="py-12 bg-background border-t border-border">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="font-serif text-2xl mb-4">After the café, recover.</h2>
          <p className="text-muted-foreground mb-6">
            Pair your post-workout shake with a recovery session — all under
            one roof at Storm Wellness Club in Livonia.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/spa/red-light-therapy" className="text-sm underline hover:text-accent">Red Light Therapy</Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/spa/cryotherapy" className="text-sm underline hover:text-accent">Cryotherapy</Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/spa/cold-plunge" className="text-sm underline hover:text-accent">Cold Plunge</Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/spa/infrared-sauna" className="text-sm underline hover:text-accent">Infrared Sauna</Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/spa/sauna-steam" className="text-sm underline hover:text-accent">Sauna &amp; Steam</Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
