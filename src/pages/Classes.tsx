import { Link } from "react-router-dom";
import { Bike, CircleDot, Flame, Users, CalendarCheck, MapPin } from "lucide-react";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/SectionHeading";
import { buildBreadcrumbLd, buildFAQLd, buildServiceLd, type FAQ } from "@/lib/seo/schemas";
import { useClassPassPricing, findPrice } from "@/hooks/useClassPassPricing";
import { CANCELLATION_POLICY_TEXT } from "@/components/booking/CancellationPolicyText";

const STUDIOS = [
  {
    icon: CircleDot,
    name: "Reformer Studio",
    cap: "8 reformers per class",
    body:
      "Reformer Pilates on spring-loaded machines, including heated and non-heated classes. Small groups mean your instructor can adjust your form throughout the class.",
  },
  {
    icon: Bike,
    name: "Cycle Studio",
    cap: "10 bikes per class",
    body:
      "Music-driven indoor cycling with coached intervals. You set your own resistance, so every ride works for beginners and strong riders alike.",
  },
  {
    icon: Flame,
    name: "Aerobics Studio",
    cap: "Mat, yoga & strength",
    body:
      "Yoga, mat Pilates, barre, sculpt, bootcamp and HIIT-style classes for building strength, mobility and endurance.",
  },
];

const STEPS = [
  { icon: CalendarCheck, title: "Pick a class", body: "Browse the weekly schedule by studio and day, then tap a class to see the details." },
  { icon: Users, title: "Reserve your spot", body: "Sign in, sign the waiver once, and book with a class pass or your membership credits. You can buy a pass right in the booking window." },
  { icon: MapPin, title: "Show up and check in", body: "Arrive a few minutes early so the front desk can check you in and your instructor can get you set up." },
];

export default function Classes() {
  const { data: pricing } = useClassPassPricing();
  const single = findPrice(pricing, "pilates_cycling", "single", "non_member");
  const singleMember = findPrice(pricing, "pilates_cycling", "single", "member");

  const faqs: FAQ[] = [
    {
      q: "Do I need a membership to take classes?",
      a: "No. Anyone can buy a class pass and book Reformer Pilates, cycling and studio classes. Members get class credits and member pricing.",
    },
    {
      q: "I've never done Reformer Pilates. Can I join?",
      a: "Yes. Look for beginner-friendly or all-levels classes on the schedule. Classes are capped at 8, so the instructor walks you through the machine and adjusts your form.",
    },
    {
      q: "How much is a class?",
      a: single
        ? `A single Reformer or cycling class pass is $${single.dollars}${singleMember ? ` ($${singleMember.dollars} for members)` : ""}. Class packs lower the price per class.`
        : "Single class passes and class packs are available on our class pass page. Members get member pricing.",
    },
    {
      q: "What should I bring?",
      a: "Comfortable workout clothes. Grip socks are required for Reformer Pilates and studio classes. For cycling, wear athletic shoes or bring your own cycling shoes with clips.",
    },
    { q: "What is the cancellation policy?", a: CANCELLATION_POLICY_TEXT },
    {
      q: "Where are you located?",
      a: "Storm Wellness Club is at 18340 Middlebelt Rd, Livonia, MI 48152, a short drive from Farmington Hills, Plymouth, Northville, Novi, Redford and Westland.",
    },
  ];

  return (
    <Layout>
      <SEOHead
        title="Reformer Pilates, Cycling & Yoga Classes in Livonia, MI"
        description="Small-group Reformer Pilates (heated & non-heated), indoor cycling, yoga, barre and HIIT classes in Livonia, MI. No membership needed — book online with a class pass."
        path="/classes"
        image="/og/og-classes.jpg"
        imageAlt="Reformer Pilates studio at Storm Wellness Club in Livonia, Michigan"
        jsonLd={[
          buildBreadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Classes", path: "/classes" },
          ]),
          buildServiceLd({
            name: "Reformer Pilates, Cycling & Yoga Classes",
            serviceType: "Group Fitness Classes",
            description:
              "Small-group Reformer Pilates (8 max), indoor cycling (10 max), yoga, barre and HIIT classes at Storm Wellness Club in Livonia, Michigan. Open to members and class-pass holders.",
            path: "/classes",
          }),
          buildFAQLd(faqs),
        ]}
      />

      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <p className="text-accent text-sm uppercase tracking-widest mb-4">Group Classes</p>
          <h1 className="heading-display mb-4">Reformer Pilates, Cycling & Yoga Classes in Livonia, MI</h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            Small, coached classes in three dedicated studios. No membership needed — grab a class
            pass and book your spot online in about a minute.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/schedule">See the schedule</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/class-passes">Class passes{single ? ` from $${single.dollars}` : ""}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-5xl">
          <SectionHeading title="Our studios" subtitle="Each studio is built for one style of training, and every class is kept small." />
          <div className="grid gap-6 md:grid-cols-3">
            {STUDIOS.map((s) => (
              <div key={s.name} className="card-luxury p-6">
                <s.icon className="h-6 w-6 text-accent mb-4" />
                <h3 className="font-serif text-xl mb-1">{s.name}</h3>
                <p className="text-xs uppercase tracking-wider text-accent mb-3">{s.cap}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary/20 border-t border-border">
        <div className="container mx-auto px-6 max-w-5xl">
          <SectionHeading title="What to expect" subtitle="Your first class, step by step." />
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="p-6 rounded-lg border border-border bg-background">
                <p className="text-xs uppercase tracking-wider text-accent mb-2">Step {i + 1}</p>
                <h3 className="font-serif text-xl mb-2 flex items-center gap-2">
                  <s.icon className="h-5 w-5 text-accent" /> {s.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 bg-background border-t border-border">
        <div className="container mx-auto px-6 max-w-3xl">
          <SectionHeading title="Beginner questions" />
          <div className="space-y-6">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-serif text-lg mb-1">{f.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary/30 border-t border-border">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="font-serif text-3xl mb-3">Classes near Livonia, Farmington Hills, Plymouth & Northville</h2>
          <p className="text-muted-foreground mb-6">
            18340 Middlebelt Rd, Livonia, MI 48152 — also serving Novi, Redford, Westland, Canton and Garden City.
          </p>
          <Button asChild size="lg">
            <Link to="/schedule">Book a class</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
