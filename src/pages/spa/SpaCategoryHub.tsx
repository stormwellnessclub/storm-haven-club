import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ChevronRight, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { SPA_CATEGORIES } from "@/lib/spa-content";

const BASE_URL = "https://stormwellnessclub.com";

// Standalone recovery sub-services that already have their own dedicated pages
const RECOVERY_STANDALONE = [
  { slug: "red-light-therapy", name: "Full-Body Red Light Therapy", tagline: "Cellular recovery through 660/850nm red and near-infrared light." },
  { slug: "cryotherapy", name: "Whole-Body Cryotherapy", tagline: "Three minutes at sub-zero temperatures for systemic recovery." },
  { slug: "cold-plunge", name: "Cold Plunge", tagline: "39–55°F immersion for inflammation, mood, and resilience." },
  { slug: "infrared-sauna", name: "Infrared Sauna", tagline: "Low-temperature deep heat for detoxification and cardiovascular benefit." },
  { slug: "sauna-steam", name: "Traditional Sauna & Steam", tagline: "Classic high-heat sauna and steam room for full-body recovery." },
  { slug: "salt-room", name: "Halotherapy Salt Room", tagline: "Dry salt aerosol for respiratory and skin support." },
  { slug: "zerobody", name: "Starpool ZeroBody Cryo", tagline: "Floatation cryotherapy — 10 minutes for systemic muscle reset." },
];

interface Props {
  category: string;
}

export default function SpaCategoryHub({ category }: Props) {
  const cat = SPA_CATEGORIES[category];
  if (!cat) return null;
  const path = `/spa/${cat.slug}`;
  const fullUrl = `${BASE_URL}${path}`;

  // Build list of all services in this category (handwritten + recovery standalone)
  const items = cat.services.map((s) => ({
    to: `/spa/${cat.slug}/${s.slug}`,
    name: s.name,
    tagline: s.tagline,
    durations: s.durations.join(" / "),
  }));

  // Recovery hub also lists the 7 standalone recovery pages
  const standalone =
    cat.slug === "recovery"
      ? RECOVERY_STANDALONE.map((r) => ({
          to: `/spa/${r.slug}`,
          name: r.name,
          tagline: r.tagline,
          durations: "",
        }))
      : [];

  const allItems = [...standalone, ...items];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Recovery Spa", item: `${BASE_URL}/spa` },
      { "@type": "ListItem", position: 3, name: cat.name, item: fullUrl },
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: cat.h1,
    itemListElement: allItems.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}${it.to}`,
      name: it.name,
    })),
  };

  return (
    <Layout>
      <SEOHead
        title={cat.title}
        description={cat.description}
        path={path}
        image="/og/og-spa.jpg"
        imageAlt="Aella Massage & Recovery Spa at Storm Wellness Club in Livonia, Michigan"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-12 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/spa" className="hover:text-foreground">Recovery Spa</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{cat.name}</span>
          </nav>
          <p className="text-accent text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Aella Spa
          </p>
          <h1 className="heading-display mb-4">{cat.h1}</h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">{cat.subhead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={`/spa?category=${encodeURIComponent(cat.dbCategory)}`}>Book {cat.name}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/spa">All spa services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-6 max-w-3xl">
          {cat.intro.map((p, i) => (
            <p key={i} className="text-foreground/90 leading-relaxed mb-6 text-lg">{p}</p>
          ))}
        </div>
      </section>

      {/* Service list */}
      <section className="py-12 bg-secondary/20 border-t border-border">
        <div className="container mx-auto px-6 max-w-5xl">
          <h2 className="font-serif text-3xl mb-8">All {cat.name.toLowerCase()} services</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {allItems.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className="block p-6 rounded-lg border border-border bg-background hover:border-accent hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-serif text-xl group-hover:text-accent transition-colors">{it.name}</h3>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-3">{it.tagline}</p>
                {it.durations && (
                  <p className="text-xs uppercase tracking-wider text-accent">{it.durations}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Local CTA */}
      <section className="py-16 bg-background border-t border-border">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="font-serif text-3xl mb-3">Aella Spa at Storm Wellness Club</h2>
          <p className="text-muted-foreground mb-6">
            18340 Middlebelt Rd, Livonia, MI 48152 — serving Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, and the greater Detroit metro.
          </p>
          <Button asChild size="lg">
            <Link to={`/spa?category=${encodeURIComponent(cat.dbCategory)}`}>Book a {cat.name.replace(/s$/, "")}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
