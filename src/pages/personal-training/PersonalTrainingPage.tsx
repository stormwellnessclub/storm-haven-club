import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ChevronRight, Sparkles } from "lucide-react";
import {
  TrainingRequestForm,
  TrainingServiceValue,
} from "@/components/personal-training/TrainingRequestForm";

interface FAQ {
  q: string;
  a: string;
}

export interface PersonalTrainingPageProps {
  title: string;
  description: string;
  path: string;
  serviceName: string;
  defaultService: TrainingServiceValue;
  h1: string;
  subhead: string;
  body: string[];
  whoFor: string[];
  pricing?: { label: string; price: string; note?: string }[];
  faqs?: FAQ[];
}

const BASE_URL = "https://stormwellnessclub.com";

export default function PersonalTrainingPage({
  title,
  description,
  path,
  serviceName,
  defaultService,
  h1,
  subhead,
  body,
  whoFor,
  pricing,
  faqs,
}: PersonalTrainingPageProps) {
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
    areaServed: ["Livonia, MI", "Detroit, MI", "Farmington Hills, MI", "Plymouth, MI", "Novi, MI"],
    url: fullUrl,
    description,
  };

  const faqLd =
    faqs && faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <Layout>
      <SEOHead title={title} description={description} path={path} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(serviceLd)}</script>
        {faqLd && <script type="application/ld+json">{JSON.stringify(faqLd)}</script>}
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-12 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/personal-training" className="hover:text-foreground">Personal Training</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{serviceName}</span>
          </nav>
          <p className="text-accent text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Personal Training
          </p>
          <h1 className="heading-display mb-4">{h1}</h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">{subhead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#request">Request a session</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/personal-training">All training options</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-3xl">
          {body.map((p, i) => (
            <p key={i} className="text-foreground/90 leading-relaxed mb-6 text-lg">
              {p}
            </p>
          ))}

          <div className="mt-10">
            <h2 className="font-serif text-2xl mb-4">Who it's for</h2>
            <ul className="space-y-2">
              {whoFor.map((b, i) => (
                <li key={i} className="flex gap-2 text-foreground/90">
                  <span className="text-accent mt-1">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing */}
      {pricing && pricing.length > 0 && (
        <section className="py-16 bg-secondary/30 border-t border-border">
          <div className="container mx-auto px-6 max-w-4xl">
            <h2 className="font-serif text-3xl mb-8 text-center">Pricing</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pricing.map((p) => (
                <div key={p.label} className="rounded-lg border border-border bg-background p-6">
                  <div className="text-sm uppercase tracking-widest text-muted-foreground mb-2">
                    {p.label}
                  </div>
                  <div className="font-serif text-3xl mb-1">{p.price}</div>
                  {p.note && <p className="text-sm text-muted-foreground">{p.note}</p>}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-6">
              Final pricing confirmed when your coach reaches out. Member discounts may apply.
            </p>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-16 bg-background border-t border-border">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="font-serif text-3xl mb-8 text-center">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "1", t: "Send a request", d: "Tell us your goals and availability." },
              { n: "2", t: "Meet your coach", d: "We match you with the right trainer." },
              { n: "3", t: "Get on the schedule", d: "Book your first session and start." },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground mx-auto mb-3 flex items-center justify-center font-serif text-lg">
                  {s.n}
                </div>
                <h3 className="font-serif text-xl mb-1">{s.t}</h3>
                <p className="text-muted-foreground text-sm">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      {faqs && faqs.length > 0 && (
        <section className="py-16 bg-secondary/30">
          <div className="container mx-auto px-6 max-w-3xl">
            <h2 className="font-serif text-3xl mb-8">Frequently asked questions</h2>
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

      {/* Request */}
      <section id="request" className="py-16 bg-background border-t border-border scroll-mt-24">
        <div className="container mx-auto px-6 max-w-2xl">
          <TrainingRequestForm defaultService={defaultService} />
        </div>
      </section>
    </Layout>
  );
}
