import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { CheckCircle2, Sparkles, Crown, Gem, Star } from "lucide-react";
import membershipsHero from "@/assets/memberships-hero.jpg";
import { AnimatedSection, StaggerContainer } from "@/components/AnimatedSection";
import {
  buildBreadcrumbLd,
  buildFAQLd,
  buildProductLd,
} from "@/lib/seo/schemas";

// Amenity banner images
import gymArea1 from "@/assets/gym-area-1.jpg";
import saunaInterior from "@/assets/wellness/sauna-interior-wide.jpg";
import steamRoom from "@/assets/wellness/steam-room.jpg";
import saltRoom from "@/assets/wellness/salt-room.jpg";
import coldPlunge from "@/assets/wellness/cold-plunge-premium.jpg";

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
        image={membershipsHero}
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
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={membershipsHero}
            alt="Storm Wellness Club"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal/60 via-charcoal/70 to-charcoal/90" />
        </div>
        <div className="relative z-10 container mx-auto px-6 py-24 text-center">
          <AnimatedSection animation="fade-up">
            <p className="text-gold-light text-sm uppercase tracking-widest mb-4">
              Application-Based Membership
            </p>
            <h1 className="heading-display text-primary-foreground mb-6">
              Membership Tiers
            </h1>
            <p className="text-primary-foreground/80 max-w-2xl mx-auto text-lg">
              Explore our tiered memberships to find the perfect fit for your
              wellness goals. All members enjoy access to premier facilities and
              preferred pricing on spa services.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Core Benefits */}
      <section id="benefits" className="section-padding bg-background overflow-hidden">
        <div className="container mx-auto container-padding">
          <SectionHeading
            title="Included in Every Membership"
            subtitle="All members enjoy access to our premier gym facilities and wet spa amenities."
          />
        </div>

        {/* Amenity Image Banner - Full-bleed + seamless */}
        <AnimatedSection animation="fade-up" className="mb-12">
          <div className="relative w-full overflow-hidden">
            <div className="grid grid-cols-5 h-48 md:h-64 lg:h-72">
              <div className="relative overflow-hidden">
                <img
                  src={gymArea1}
                  alt="Gym"
                  className="w-full h-full object-cover scale-105 hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-charcoal/30 via-transparent to-transparent" />
              </div>
              <div className="relative overflow-hidden">
                <img
                  src={saunaInterior}
                  alt="Sauna"
                  className="w-full h-full object-cover scale-105 hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-charcoal/10" />
              </div>
              <div className="relative overflow-hidden">
                <img
                  src={steamRoom}
                  alt="Steam Room"
                  className="w-full h-full object-cover scale-105 hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-charcoal/10" />
              </div>
              <div className="relative overflow-hidden">
                <img
                  src={saltRoom}
                  alt="Salt Room"
                  className="w-full h-full object-cover scale-105 hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-charcoal/10" />
              </div>
              <div className="relative overflow-hidden">
                <img
                  src={coldPlunge}
                  alt="Cold Plunge"
                  className="w-full h-full object-cover scale-105 hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-charcoal/30 via-transparent to-transparent" />
              </div>
            </div>

            {/* Fade into section background (top/bottom) */}
            <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background opacity-30 pointer-events-none" />
          </div>
        </AnimatedSection>

        <div className="container mx-auto container-padding">
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto" staggerDelay={60}>
            {coreAmenities.map((amenity) => (
              <div
                key={amenity}
                className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg hover-lift-sm transition-all duration-300"
              >
                <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                <span className="text-foreground">{amenity}</span>
              </div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Spa Amenities */}
      <section className="section-padding bg-secondary/30">
        <div className="container mx-auto container-padding">
          <SectionHeading
            title="Luxurious Spa Amenities"
            subtitle="Exclusive amenities designed to enhance your wellness journey."
          />
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto" staggerDelay={80}>
            {luxuriousSpaAmenities.map((amenity) => (
              <div
                key={amenity.name}
                className="card-luxury p-6 text-center hover-lift transition-all duration-300"
              >
                <h3 className="font-serif text-lg mb-2">{amenity.name}</h3>
                <p className="text-muted-foreground text-sm">
                  {amenity.description}
                </p>
              </div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Membership Tiers */}
      <section id="tiers" className="section-padding bg-background">
        <div className="container mx-auto container-padding">
          <SectionHeading
            title="Choose Your Tier"
            subtitle="Select the membership that resonates with your vision of wellness."
          />

          <StaggerContainer 
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch [grid-auto-rows:1fr]" 
            staggerDelay={100}
          >
            {membershipTiers.map((tier) => (
              <div
                key={tier.name}
                className={`card-luxury p-6 flex flex-col h-full relative hover-lift transition-all duration-300 ${
                  tier.highlighted ? "border-accent ring-2 ring-accent shadow-gold-hover" : ""
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground text-xs uppercase tracking-wider px-3 py-1 rounded-sm">
                      Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6 pt-2">
                  <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                    <tier.icon className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="font-serif text-2xl mb-1">{tier.name}</h3>
                  <p className="text-muted-foreground text-sm">{tier.tagline}</p>
                </div>

                <div className="text-center mb-6">
                  <p className="text-3xl font-serif text-foreground">
                    {tier.price}
                    <span className="text-muted-foreground text-base font-sans">
                      /month
                    </span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Annual Fee: {tier.annualFee}
                  </p>
                </div>

                <ul className="space-y-3 mb-6 flex-1 min-h-[140px]">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-3 text-xs text-muted-foreground border-t border-border pt-4 mb-6">
                  <p>
                    <strong className="text-foreground">Childcare:</strong>{" "}
                    {tier.childcareNote}
                  </p>
                  <p>
                    <strong className="text-foreground">Classes:</strong>{" "}
                    {tier.classesNote}
                  </p>
                </div>

                <Link to="/apply" className="mt-auto">
                  <Button
                    variant={tier.highlighted ? "gold" : "gold-outline"}
                    className="w-full hover-brightness"
                  >
                    Apply for Invitation
                  </Button>
                </Link>
              </div>
            ))}
          </StaggerContainer>
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
