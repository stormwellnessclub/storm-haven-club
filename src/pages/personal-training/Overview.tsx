import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ChevronRight, Dumbbell, CircleDot, Bike, Users, Sparkles } from "lucide-react";
import { TrainingRequestForm } from "@/components/personal-training/TrainingRequestForm";

const services = [
  {
    to: "/personal-training/one-on-one",
    icon: Dumbbell,
    title: "1:1 Personal Training",
    blurb: "Strength, conditioning, and accountability with a dedicated coach.",
  },
  {
    to: "/personal-training/private-pilates",
    icon: CircleDot,
    title: "Private Pilates",
    blurb: "1:1 reformer sessions tailored to your body and goals.",
  },
  {
    to: "/personal-training/private-cycling",
    icon: Bike,
    title: "Private Cycling",
    blurb: "1:1 indoor cycling coaching — form, power, and pacing.",
  },
  {
    to: "/personal-training/semi-private",
    icon: Users,
    title: "Semi-Private (up to 4)",
    blurb: "Train with friends or family in a focused small-group setting.",
  },
];

export default function PersonalTrainingOverview() {
  return (
    <Layout>
      <SEOHead
        title="Personal Training in Livonia, MI"
        description="1:1 personal training, private Pilates, private cycling, and semi-private sessions at Storm Wellness Club in Livonia, MI."
        path="/personal-training"
      />

      {/* Hero */}
      <section className="pt-32 pb-12 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <p className="text-accent text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Personal Training
          </p>
          <h1 className="heading-display mb-4">Coaching, one body at a time.</h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
            Private coaching for strength, Pilates, cycling, and small groups — built around your
            goals, schedule, and body. Open to members and the wider Detroit metro community.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#request">Request a session</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/memberships">View memberships</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Service tiles */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-5xl">
          <h2 className="font-serif text-3xl mb-8 text-center">Choose your format</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {services.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.to}
                  to={s.to}
                  className="group flex items-start gap-4 p-6 rounded-lg border border-border hover:border-accent hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-serif text-xl mb-1 flex items-center gap-2">
                      {s.title}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-sm text-muted-foreground">{s.blurb}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="font-serif text-3xl mb-8 text-center">Why train with Storm</h2>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              {
                t: "Credentialed coaches",
                d: "Certified trainers and instructors with deep technical backgrounds.",
              },
              {
                t: "Considered environment",
                d: "Premium equipment, quiet studios, and a club designed for focus.",
              },
              {
                t: "Built around you",
                d: "Programming that fits your goals, history, and the way you actually live.",
              },
            ].map((b) => (
              <div key={b.t}>
                <h3 className="font-serif text-xl mb-2">{b.t}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Request form */}
      <section id="request" className="py-16 bg-background scroll-mt-24">
        <div className="container mx-auto px-6 max-w-2xl">
          <TrainingRequestForm />
        </div>
      </section>
    </Layout>
  );
}
