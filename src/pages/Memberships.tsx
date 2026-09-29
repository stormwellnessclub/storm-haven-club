import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { CheckCircle2, Sparkles, Crown, Gem, Star } from "lucide-react";
import stairsA from "@/assets/membership/stairs.webp.asset.json";
const lounge = stairsA.url;
import { AnimatedSection, StaggerContainer } from "@/components/AnimatedSection";
import {
  buildBreadcrumbLd,
  buildFAQLd,
  buildProductLd,
} from "@/lib/seo/schemas";

// Club photos (retouched originals)
import gymA from "@/assets/membership/gym.webp.asset.json";
import saunaA from "@/assets/membership/sauna.webp.asset.json";
import steamA from "@/assets/membership/steam.webp.asset.json";
import saltA from "@/assets/membership/salt.webp.asset.json";
import spaLoungeA from "@/assets/membership/lounge.webp.asset.json";
import redLightA from "@/assets/membership/redlight.webp.asset.json";
import zeroBodyA from "@/assets/membership/zerobody.webp.asset.json";
const gymArea1 = gymA.url, saunaInterior = saunaA.url, steamRoom = steamA.url, saltRoom = saltA.url, spaLounge = spaLoungeA.url;

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
    tagline: "The house, the heat, the cold.",
    price: "$200",
    annualFee: "$300",
    icon: Star,
    features: [
      "The gym",
      "The wet spa",
      "Sauna, steam, salt room and cold plunge",
    ],
    childcareNote: "$75/month add-on (2 hrs/day, 4 days/week)",
    classesNote: "Classes by the visit or with class credits",
  },
  {
    name: "Gold",
    tagline: "Light and cold, woven into your month.",
    price: "$250",
    annualFee: "$300",
    icon: Sparkles,
    features: [
      "Everything in Silver",
      "Red light, four sessions a month",
      "Dry cryo, two sessions a month",
    ],
    childcareNote: "$75/month add-on (2 hrs/day, 4 days/week)",
    classesNote: "Classes by the visit or with class credits",
  },
  {
    name: "Platinum",
    tagline: "More time under the light.",
    price: "$350",
    annualFee: "$300",
    icon: Crown,
    features: [
      "Everything in Gold",
      "Red light, six sessions a month",
      "Dry cryo, four sessions a month",
    ],
    childcareNote: "$75/month add-on (2 hrs/day, 4 days/week)",
    classesNote: "Classes by the visit or with class credits",
  },
  {
    name: "Diamond",
    tagline: "The full rhythm.",
    price: "$500",
    annualFee: "$300",
    icon: Gem,
    features: [
      "The full club",
      "Ten classes a month",
      "Red light, ten sessions a month",
      "Dry cryo, six sessions a month",
      "First access to every gathering",
    ],
    childcareNote: "$75/month add-on (2 hrs/day, 4 days/week)",
    classesNote: "10 classes included monthly",
  },
];

const coreAmenities = [
  "The gym",
  "Sauna & Steam Room",
  "Himalayan Salt Room",
  "Cold Plunge",
  "Locker rooms",
  "Member pricing at the spa",
];

const luxuriousSpaAmenities = [
  { name: "Himalayan Salt Room", description: "Walls of hand-cut Himalayan salt. Sit, breathe, reset." },
  { name: "Steam Room", description: "Gold mosaic and eucalyptus steam. Open the lungs, clear the head." },
  { name: "Sauna", description: "Cedar, high heat, deep sweat. The oldest recovery ritual there is." },
  { name: "Cold Plunge", description: "Held cold, on your terms. The fastest way back to clarity." },
  { name: "Dry Cryo Bed", description: "Minus temperatures in minutes, fully dressed. Built for inflammation and recovery." },
  { name: "Red Light Therapy", description: "Clinical-grade red and near-infrared panels, full body." },
  { name: "Starpool ZeroBody", description: "Italian dry float. Weightless, warm and completely still." },
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
              q: "Is there a commitment or annual fee?",
              a: "Every membership is a 12-month commitment, billed monthly. All tiers also carry a $300 annual fee in addition to monthly dues.",
            },
            {
              q: "Can I freeze my membership?",
              a: "Yes. Active members in good standing may freeze their membership through their member portal. Freezes pause both billing and benefits.",
            },
            {
              q: "What's included in Silver vs Diamond?",
              a: "Silver includes the gym and the wet spa. Diamond adds 10 monthly classes, 10 Red Light sessions, 6 Dry Cryo sessions, priority booking, and exclusive events.",
            },
          ]),
        ]}
      />
      {/* Hero — full-bleed photo */}
      <section className="relative bg-primary text-primary-foreground pt-28 lg:pt-24">
        <div className="relative h-[80vh] min-h-[480px] overflow-hidden">
          <img
            src={lounge}
            alt="Stairway through an arch toward the glowing salt room at Storm Wellness Club"
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />
          <div className="absolute bottom-12 left-0 right-0 flex justify-center">
            <Link to="/apply">
              <Button variant="gold" size="lg">Apply for invitation</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Photo mosaic */}
      <section id="benefits" className="section-padding bg-background">
        <div className="container mx-auto container-padding">
          <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-4 gap-3 md:h-[1200px]">
            {[
              { src: gymArea1, label: "The gym", alt: "Strength and cardio equipment on the Storm Wellness Club gym floor", cls: "col-span-2 row-span-2 aspect-[4/3] md:aspect-auto" },
              { src: saltRoom, label: "Salt room", alt: "Glowing Himalayan salt room at Storm Wellness Club", cls: "col-span-2 aspect-[16/9] md:aspect-auto" },
              { src: steamRoom, label: "Steam room", alt: "Gold mosaic steam room at Storm Wellness Club", cls: "aspect-square md:aspect-auto" },
              { src: saunaInterior, label: "Cedar sauna", alt: "Cedar sauna at Storm Wellness Club", cls: "aspect-square md:aspect-auto" },
              { src: redLightA.url, label: "Red light", alt: "Member stretching in front of a red light therapy panel at Storm Wellness Club", cls: "row-span-2 aspect-[3/4] md:aspect-auto" },
              { src: zeroBodyA.url, label: "Starpool ZeroBody", alt: "Two Starpool ZeroBody dry-float beds behind an arched door at Storm Wellness Club", cls: "row-span-2 aspect-[3/4] md:aspect-auto" },
              { src: spaLounge, label: "The wet spa", alt: "Wet spa lounge with slatted wood ceiling at Storm Wellness Club", cls: "col-span-2 row-span-2 aspect-[16/9] md:aspect-auto" },
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
            <p className="text-accent text-xs uppercase tracking-[0.3em] mb-4">Membership</p>
            <h2 className="font-serif text-4xl md:text-5xl mb-5">Four ways to belong.</h2>
            <p className="text-muted-foreground">Every membership is a one-year commitment, billed monthly. A {membershipTiers[0].annualFee} annual fee applies to every tier.</p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 border border-border rounded-sm overflow-hidden">
            {membershipTiers.map((tier, i) => {
              const top = tier.name === "Diamond";
              return (
                <div
                  key={tier.name}
                  className={`flex flex-col p-8 ${top ? "bg-primary text-primary-foreground" : "bg-card"} ${i > 0 ? "border-t md:border-t-0 xl:border-l border-border" : ""} ${i % 2 === 1 ? "md:border-l" : ""} ${i >= 2 ? "md:border-t xl:border-t-0" : ""}`}
                >
                  <p className={`min-h-[2.5rem] font-serif italic text-base mb-3 ${top ? "text-gold-light" : "text-accent"}`}>{tier.tagline}</p>
                  <h3 className="font-serif text-3xl mb-6">{tier.name}</h3>
                  <p className="font-serif text-5xl leading-none">
                    {tier.price}
                    <span className={`ml-1 font-sans text-sm ${top ? "text-primary-foreground/60" : "text-muted-foreground"}`}>/month</span>
                  </p>
                  <div className={`mt-4 space-y-1 text-sm ${top ? "text-primary-foreground/80" : "text-foreground/80"}`}>
                    <p>12-month commitment</p>
                    <p>{tier.annualFee} annual fee</p>
                  </div>
                  <div className={`my-8 h-px ${top ? "bg-primary-foreground/20" : "bg-border"}`} />
                  <ul className="space-y-3 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm leading-relaxed">
                        <span className={`mt-2.5 h-px w-3 flex-shrink-0 ${top ? "bg-gold-light" : "bg-accent"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-8 space-y-2 text-xs ${top ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    <p><span className="uppercase tracking-wider">Classes · </span>{tier.classesNote}</p>
                    <p><span className="uppercase tracking-wider">Childcare · </span>{tier.childcareNote}</p>
                  </div>
                  <Link to="/apply" className="mt-8">
                    <Button variant={top ? "gold" : "gold-outline"} className="w-full">Apply for invitation</Button>
                  </Link>
                </div>
              );
            })}
          </div>
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

    </Layout>
  );
}
