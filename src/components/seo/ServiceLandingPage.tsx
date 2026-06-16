import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ChevronRight, Sparkles } from "lucide-react";

export interface FAQItem {
  q: string;
  a: string;
}

export interface RelatedService {
  to: string;
  label: string;
}

export interface BreadcrumbStep {
  label: string;
  path: string;
}

export interface ServiceLandingPageProps {
  title: string;
  description: string;
  path: string;
  h1: string;
  subhead: string;
  body: string[];
  benefits?: string[];
  faqs?: FAQItem[];
  serviceName: string;
  ctaHref?: string;
  ctaLabel?: string;
  related?: RelatedService[];
  relatedHeading?: string;
  eyebrow?: string;
  /** Optional intermediate breadcrumbs between /spa and the current service */
  extraBreadcrumbs?: BreadcrumbStep[];
}

const BASE_URL = "https://stormwellnessclub.com";

export default function ServiceLandingPage({
  title,
  description,
  path,
  h1,
  subhead,
  body,
  benefits,
  faqs,
  serviceName,
  ctaHref = "/apply",
  ctaLabel = "Apply for Membership",
  related,
}: ServiceLandingPageProps) {
  const fullUrl = `${BASE_URL}${path}`;

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: serviceName,
    serviceType: serviceName,
    provider: {
      "@type": "HealthClub",
      name: "Storm Wellness Club",
      url: BASE_URL,
      address: {
        "@type": "PostalAddress",
        streetAddress: "18340 Middlebelt Rd",
        addressLocality: "Livonia",
        addressRegion: "MI",
        postalCode: "48152",
        addressCountry: "US",
      },
    },
    areaServed: [
      "Livonia, MI",
      "Detroit, MI",
      "Farmington Hills, MI",
      "Redford, MI",
      "Plymouth, MI",
      "Northville, MI",
      "Novi, MI",
      "Southfield, MI",
    ],
    url: fullUrl,
    description,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Recovery Spa", item: `${BASE_URL}/spa` },
      { "@type": "ListItem", position: 3, name: serviceName, item: fullUrl },
    ],
  };

  const faqLd = faqs && faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  } : null;

  return (
    <Layout>
      <SEOHead title={title} description={description} path={path} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(serviceLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
        {faqLd && <script type="application/ld+json">{JSON.stringify(faqLd)}</script>}
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-12 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/spa" className="hover:text-foreground">Recovery Spa</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{serviceName}</span>
          </nav>
          <p className="text-accent text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Recovery & Wellness
          </p>
          <h1 className="heading-display mb-4">{h1}</h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">{subhead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={ctaHref}>{ctaLabel}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/spa">View all spa services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-3xl prose-content">
          {body.map((p, i) => (
            <p key={i} className="text-foreground/90 leading-relaxed mb-6 text-lg">
              {p}
            </p>
          ))}

          {benefits && benefits.length > 0 && (
            <div className="mt-10">
              <h2 className="font-serif text-2xl mb-4">Benefits</h2>
              <ul className="space-y-2">
                {benefits.map((b, i) => (
                  <li key={i} className="flex gap-2 text-foreground/90">
                    <span className="text-accent mt-1">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      {faqs && faqs.length > 0 && (
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
      )}

      {/* Related */}
      {related && related.length > 0 && (
        <section className="py-16 bg-background border-t border-border">
          <div className="container mx-auto px-6 max-w-4xl">
            <h2 className="font-serif text-2xl mb-6">Explore other recovery services</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
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
      )}

      {/* Local CTA */}
      <section className="py-16 bg-secondary/30 border-t border-border">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="font-serif text-3xl mb-3">Visit us in Livonia, Michigan</h2>
          <p className="text-muted-foreground mb-6">
            18340 Middlebelt Rd, Livonia, MI 48152 — serving the greater Detroit metro area
            including Farmington Hills, Plymouth, Northville, Novi, Redford, and Southfield.
          </p>
          <Button asChild size="lg">
            <Link to={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
