import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { CheckCircle2, Sparkles, Crown, Gem, Star } from "lucide-react";
import lounge from "@/assets/memberships/lounge.webp";
import { AnimatedSection, StaggerContainer } from "@/components/AnimatedSection";
import {
  buildBreadcrumbLd,
  buildFAQLd,
  buildProductLd,
} from "@/lib/seo/schemas";

// Amenity banner images
import gymArea1 from "@/assets/memberships/gym.webp";
import saunaInterior from "@/assets/memberships/sauna.webp";
import steamRoom from "@/assets/memberships/steam.webp";
import saltRoom from "@/assets/memberships/salt.webp";
import coldPlunge from "@/assets/memberships/cold-plunge.webp";

interface MembershipTier {
  name: string;
  tagline: string;
  price: string;
  annualFee: string;
  icon: React.ElementType;
  features: string[];
  highlighted?: boolean;
  childcareNote: string;
  classesNote: string;
}

const membershipTiers: MembershipTier[] = [
  {
    name: "Silver",
    tagline: "The Foundation",
    price: "$200",
    annualFee: "$300",
    icon: Star,
    features: [
      "Full access to state-of-the-art gym",
      "Luxurious wet spa amenities",
      "Sauna & Steam Room",
      "Himalayan Salt Room",
      "Cold Plunge",
    ],
    childcareNote: "$75/month add-on (2 hrs/day, 4 days/week)",
    classesNote: "Purchase classes à la carte or through class credits",
  },
  {
    name: "Gold",
    tagline: "The Enhanced Experience",
    price: "$250",
    annualFee: "$300",
    icon: Sparkles,
    features: [
      "All Silver benefits included",
      "Red Light Therapy x4/month",
      "Dry Cryo x2/month",
      "Enhanced wellness treatments",
    ],
    childcareNote: "$75/month add-on (2 hrs/day, 4 days/week)",
    classesNote: "Purchase classes à la carte or through class credits",
  },
  {
    name: "Platinum",
    tagline: "The Pinnacle of Luxury",
    price: "$350",
    annualFee: "$300",
    icon: Crown,
    features: [
      "All Silver & Gold benefits",
      "Red Light Therapy x6/month",
      "Dry Cryo x4/month",
      "Premium wellness experience",
    ],
    childcareNote: "$75/month add-on (2 hrs/day, 4 days/week)",
    classesNote: "Purchase classes à la carte or through class credits",
  },
  {
    name: "Diamond",
    tagline: "The Ultimate Commitment",
    price: "$500",
    annualFee: "$300",
    icon: Gem,
    features: [
      "Full access to luxurious facilities",
      "10 classes per month included",
      "10 Red Light Therapy sessions/month",
      "6 Dry Cryo sessions/month",
      "Priority booking & exclusive events",
    ],
    childcareNote: "$75/month add-on (2 hrs/day, 4 days/week)",
    classesNote: "10 classes included monthly",
  },
];

const coreAmenities = [
  "State-of-the-art gym facilities",
  "Sauna & Steam Room",
  "Himalayan Salt Room",
  "Cold Plunge Pool",
  "Luxury Locker Rooms",
  "Preferred pricing on spa services",
];

const luxuriousSpaAmenities = [
  {
    name: "Himalayan Salt Room",
    description: "Promotes respiratory health and skin rejuvenation",
  },
  {
    name: "Steam Room",
    description: "Detoxify your body and relax your muscles",
  },
  {
    name: "Sauna",
    description: "Improve circulation and promote healthy perspiration",
  },
  {
    name: "Cold Plunge",
    description: "Reduce inflammation and accelerate recovery",
  },
  {
    name: "Dry Cryo Bed",
    description: "Enhanced recovery without getting wet",
  },
  {
    name: "Red Light Therapy",
    description: "Rejuvenate skin and support cellular health",
  },
];

export default function Memberships() {
  return (
    <Layout>
      <SEOHead
        title="Gym & Wellness Memberships in Livonia, MI"
        description="Compare Silver, Gold, Platinum & Diamond memberships in Livonia, MI — Reformer Pilates, cycling, recovery spa credits, sauna, café and kids care included. Apply online."
        path="/memberships"
        image="/og/og-memberships.jpg"
        imageAlt="Membership at Storm Wellness Club in Livonia, Michigan"
        jsonLd={[
          buildBreadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Memberships", path: "/memberships" },
          ]),
          ...membershipTiers.map((t) =>
            buildProductLd({
              name: `${t.name} Membership — ${t.tagline}`,
              description: `${t.name} tier monthly membership. ${t.features.join(". ")}. Annual fee ${t.annualFee}.`,
              path: "/memberships",
              price: Number(t.price.replace(/[^0-9.]/g, "")),
              sku: `membership-${t.name.toLowerCase()}`,
              category: "Gym Membership",
            })
          ),
          buildFAQLd([
            {
              q: "How does the membership application work?",
              a: "Apply online, then our team reviews your application and contacts you within 48 hours to schedule a personalized tour. During the tour we'll match you to the right tier.",
            },
            {
              q: "Is there an annual fee?",
              a: "Yes — all tiers include a $300 annual fee in addition to monthly dues. This funds facility upgrades and equipment maintenance.",
            },
            {
              q: "Can I freeze my membership?",
              a: "Yes. Active members in good standing may freeze their membership through their member portal. Freezes pause both billing and benefits.",
            },
            {
              q: "What's included in Silver vs Diamond?",
              a: "Silver includes full gym + wet spa access. Diamond adds 10 monthly classes, 10 Red Light sessions, 6 Dry Cryo sessions, priority booking, and exclusive events.",
            },
          ]),
        ]}
      />
      {/* Hero — editorial split */}
      <section className="bg-primary text-primary-foreground pt-28 lg:pt-24">
        <div className="grid lg:grid-cols-2 min-h-[80vh]">
          <div className="flex items-center px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
            <AnimatedSection animation="fade-up" className="max-w-xl">
              <p className="text-gold-light text-xs uppercase tracking-[0.3em] mb-6">
                Membership by application
              </p>
              <h1 className="font-serif text-5xl md:text-6xl xl:text-7xl leading-[1.05] mb-8">
                A private club for the way you want to feel.
              </h1>
              <p className="text-primary-foreground/70 text-lg leading-relaxed mb-10">
                Four tiers, one standard. Every member enjoys the full gym, the wet spa and
                preferred pricing across the club.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/apply">
                  <Button variant="gold" size="lg">Apply for Membership</Button>
                </Link>
                <a href="#tiers">
                  <Button variant="outline" size="lg" className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground">
                    Compare tiers
                  </Button>
                </a>
              </div>
            </AnimatedSection>
          </div>
          <div className="relative min-h-[420px] lg:min-h-0 overflow-hidden">
            <img
              src={lounge}
              alt="Storm Wellness Club gym floor with gold dumbbells in Livonia, Michigan"
              className="absolute inset-0 h-full w-full object-cover"
              fetchPriority="high"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/20 to-transparent lg:from-primary lg:via-transparent" />
          </div>
        </div>
      </section>

      {/* Included in every membership — editorial mosaic */}
      <section id="benefits" className="section-padding bg-background">
        <div className="container mx-auto container-padding">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-end mb-14">
            <div className="lg:col-span-5">
              <p className="text-accent text-xs uppercase tracking-[0.3em] mb-4">Every tier includes</p>
              <h2 className="font-serif text-4xl md:text-5xl leading-tight">The full club, from your first visit.</h2>
            </div>
            <ul className="lg:col-span-7 grid sm:grid-cols-2 gap-x-10 gap-y-4">
              {coreAmenities.map((amenity) => (
                <li key={amenity} className="flex items-center gap-3 border-b border-border pb-3 text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {amenity}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-3 md:h-[620px]">
            {[
              { src: gymArea1, label: "The gym floor", alt: "Strength and cardio equipment on the Storm Wellness Club gym floor", cls: "col-span-2 row-span-2 aspect-[4/3] md:aspect-auto" },
              { src: saltRoom, label: "Himalayan salt room", alt: "Himalayan salt room for halotherapy at Storm Wellness Club", cls: "col-span-2 aspect-[16/9] md:aspect-auto" },
              { src: steamRoom, label: "Steam room", alt: "Steam room in the wet spa at Storm Wellness Club", cls: "aspect-square md:aspect-auto" },
              { src: coldPlunge, label: "Cold plunge", alt: "Cold plunge for recovery at Storm Wellness Club", cls: "aspect-square md:aspect-auto" },
            ].map((t) => (
              <figure key={t.label} className={`group relative overflow-hidden rounded-sm bg-secondary ${t.cls}`}>
                <img
                  src={t.src}
                  alt={t.alt}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-transparent" />
                <figcaption className="absolute bottom-4 left-5 text-xs uppercase tracking-[0.25em] text-primary-foreground">
                  {t.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Spa amenities — quiet typographic row */}
      <section className="py-16 bg-secondary/40 border-y border-border">
        <div className="container mx-auto container-padding">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8">
            {luxuriousSpaAmenities.map((amenity) => (
              <div key={amenity.name}>
                <h3 className="font-serif text-xl mb-2">{amenity.name}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{amenity.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership Tiers */}
      <section id="tiers" className="section-padding bg-background scroll-mt-24">
        <div className="container mx-auto container-padding">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-accent text-xs uppercase tracking-[0.3em] mb-4">The tiers</p>
            <h2 className="font-serif text-4xl md:text-5xl mb-5">Choose your rhythm</h2>
            <p className="text-muted-foreground">Each tier adds more recovery and more ritual. Annual fee {membershipTiers[0].annualFee} on every tier.</p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 border border-border rounded-sm overflow-hidden">
            {membershipTiers.map((tier, i) => {
              const top = tier.name === "Diamond";
              return (
                <div
                  key={tier.name}
                  className={`flex flex-col p-8 ${top ? "bg-primary text-primary-foreground" : "bg-card"} ${i > 0 ? "border-t md:border-t-0 xl:border-l border-border" : ""} ${i % 2 === 1 ? "md:border-l" : ""} ${i >= 2 ? "md:border-t xl:border-t-0" : ""}`}
                >
                  <p className={`min-h-[2.5rem] text-xs uppercase tracking-[0.3em] mb-3 ${top ? "text-gold-light" : "text-accent"}`}>{tier.tagline}</p>
                  <h3 className="font-serif text-3xl mb-6">{tier.name}</h3>
                  <p className="font-serif text-5xl leading-none">
                    {tier.price}
                    <span className={`ml-1 font-sans text-sm ${top ? "text-primary-foreground/60" : "text-muted-foreground"}`}>/month</span>
                  </p>
                  <div className={`my-8 h-px ${top ? "bg-primary-foreground/20" : "bg-border"}`} />
                  <ul className="space-y-3 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm leading-relaxed">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${top ? "text-gold-light" : "text-accent"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-8 space-y-2 text-xs ${top ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    <p><span className="uppercase tracking-wider">Classes · </span>{tier.classesNote}</p>
                    <p><span className="uppercase tracking-wider">Childcare · </span>{tier.childcareNote}</p>
                  </div>
                  <Link to="/apply" className="mt-8">
                    <Button variant={top ? "gold" : "gold-outline"} className="w-full">Apply for Invitation</Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Founding Member */}
      <section className="section-padding bg-primary text-primary-foreground overflow-hidden">
        <div className="container mx-auto container-padding">
          <AnimatedSection animation="fade-up" className="max-w-3xl mx-auto text-center">
            <p className="text-gold-light text-sm uppercase tracking-widest mb-4">
              Limited Opportunity
            </p>
            <h2 className="heading-section text-primary-foreground mb-6">
              Founding Member Privilege
            </h2>
            <p className="text-primary-foreground/80 mb-8 leading-relaxed text-lg">
              Apply now and pay your membership annually in advance to become one
              of our elite founding members. This status grants you a special
              founding member card, exclusive branded apparel, a premium gym bag,
              and priority access to all private events.
            </p>
            <Link to="/apply">
              <Button variant="gold" size="lg" className="hover-lift pulse-soft">
                Apply to Be a Founding Member
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* Men's Rates - Hidden for now
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section mb-4">Men's Membership Rates</h2>
            <p className="text-muted-foreground mb-6">
              Tailored access with prorated rates due to gender-specific access
              days, ensuring a comfortable and inclusive environment.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <div className="bg-background p-4 rounded-sm">
                <p className="font-serif text-lg">Silver</p>
                <p className="text-gold font-semibold">$120/mo</p>
              </div>
              <div className="bg-background p-4 rounded-sm">
                <p className="font-serif text-lg">Gold</p>
                <p className="text-gold font-semibold">$155/mo</p>
              </div>
              <div className="bg-background p-4 rounded-sm">
                <p className="font-serif text-lg">Platinum</p>
                <p className="text-gold font-semibold">$175/mo</p>
              </div>
            </div>
            <p className="text-sm text-foreground/70">
              Reduced annual fee of $175 on all tiers
            </p>
          </div>
        </div>
      </section>
      */}


      {/* Final CTA */}
      <section className="section-padding bg-charcoal">
        <div className="container mx-auto container-padding text-center">
          <AnimatedSection animation="fade-up">
            <h2 className="heading-section text-primary-foreground mb-6">
              Ready to Transform?
            </h2>
            <p className="text-primary-foreground/70 max-w-xl mx-auto mb-10 text-lg">
              Select the membership tier that resonates with your vision of
              wellness and begin your journey at Storm Wellness Club.
            </p>
            <Link to="/apply">
              <Button variant="gold" size="lg" className="hover-lift">
                Apply for Membership
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>
    </Layout>
  );
}
