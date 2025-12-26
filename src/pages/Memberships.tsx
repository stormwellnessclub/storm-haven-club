import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { CheckCircle2, Sparkles, Crown, Gem, Star } from "lucide-react";
import gymArea2 from "@/assets/gym-area-2.jpg";

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
    highlighted: true,
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
      {/* Hero Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={gymArea2}
            alt="Storm Wellness Club"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal/60 via-charcoal/70 to-charcoal/90" />
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center">
          <p className="text-gold-light text-sm uppercase tracking-widest mb-4">
            Application-Based Membership
          </p>
          <h1 className="heading-display text-primary-foreground mb-6">
            Membership Tiers
          </h1>
          <p className="text-primary-foreground/80 max-w-2xl mx-auto">
            Explore our tiered memberships to find the perfect fit for your
            wellness goals. All members enjoy access to premier facilities and
            preferred pricing on spa services.
          </p>
        </div>
      </section>

      {/* Core Benefits */}
      <section id="benefits" className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Included in Every Membership"
            subtitle="All members enjoy access to our premier gym facilities and wet spa amenities."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {coreAmenities.map((amenity) => (
              <div
                key={amenity}
                className="flex items-center gap-3 p-4 bg-secondary/50 rounded-sm"
              >
                <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                <span className="text-foreground">{amenity}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Spa Amenities */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Luxurious Spa Amenities"
            subtitle="Exclusive amenities designed to enhance your wellness journey."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {luxuriousSpaAmenities.map((amenity) => (
              <div
                key={amenity.name}
                className="card-luxury p-6 text-center"
              >
                <h3 className="font-serif text-lg mb-2">{amenity.name}</h3>
                <p className="text-muted-foreground text-sm">
                  {amenity.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership Tiers */}
      <section id="tiers" className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Choose Your Tier"
            subtitle="Select the membership that resonates with your vision of wellness."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {membershipTiers.map((tier) => (
              <div
                key={tier.name}
                className={`card-luxury p-6 flex flex-col relative ${
                  tier.highlighted ? "border-accent ring-1 ring-accent" : ""
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

                <ul className="space-y-3 mb-6 flex-grow">
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
                    variant={tier.highlighted ? "gold" : "outline"}
                    className="w-full"
                  >
                    Apply for Invitation
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founding Member */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-gold-light text-sm uppercase tracking-widest mb-4">
              Limited Opportunity
            </p>
            <h2 className="heading-section text-primary-foreground mb-6">
              Founding Member Privilege
            </h2>
            <p className="text-primary-foreground/80 mb-8 leading-relaxed">
              Apply now and pay your membership annually in advance to become one
              of our elite founding members. This status grants you a special
              founding member card, exclusive branded apparel, a premium gym bag,
              and priority access to all private events.
            </p>
            <Link to="/apply">
              <Button variant="gold" size="lg">
                Apply to Be a Founding Member
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Men's Rates */}
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
                <p className="text-accent">$120/mo</p>
              </div>
              <div className="bg-background p-4 rounded-sm">
                <p className="font-serif text-lg">Gold</p>
                <p className="text-accent">$155/mo</p>
              </div>
              <div className="bg-background p-4 rounded-sm">
                <p className="font-serif text-lg">Platinum</p>
                <p className="text-accent">$175/mo</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Reduced annual fee of $175 on all tiers
            </p>
          </div>
        </div>
      </section>

      {/* Access Schedule */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section mb-6">Accessibility Schedule</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card-luxury p-6">
                <h3 className="font-serif text-lg mb-3">Women-Only Access</h3>
                <p className="text-muted-foreground">
                  Monday, Wednesday, Friday & Saturday
                </p>
              </div>
              <div className="card-luxury p-6">
                <h3 className="font-serif text-lg mb-3">Unisex Access</h3>
                <p className="text-muted-foreground">
                  Tuesday, Thursday & Sunday
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              Café and Spa are open 7 days a week to all members. Services
              available à la carte at preferred member rates.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-charcoal">
        <div className="container mx-auto px-6 text-center">
          <h2 className="heading-section text-primary-foreground mb-6">
            Ready to Transform?
          </h2>
          <p className="text-primary-foreground/70 max-w-xl mx-auto mb-10">
            Select the membership tier that resonates with your vision of
            wellness and begin your journey at Storm Wellness Club.
          </p>
          <Link to="/apply">
            <Button variant="gold" size="lg">
              Apply for Membership
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
