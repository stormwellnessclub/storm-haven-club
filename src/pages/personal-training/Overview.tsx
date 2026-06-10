import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ChevronRight, Dumbbell, CircleDot, Users } from "lucide-react";
import { TrainingRequestForm } from "@/components/personal-training/TrainingRequestForm";

const services = [
  {
    to: "/personal-training/one-on-one",
    number: "01",
    icon: Dumbbell,
    title: "1:1 Personal Training",
    blurb:
      "Private coaching built around your goal and your level. Programmed for you, progressed week to week.",
    membersOnly: true,
  },
  {
    to: "/personal-training/private-pilates",
    number: "02",
    icon: CircleDot,
    title: "Private Pilates",
    blurb:
      "One reformer, one instructor, one body. Every spring and cue dialed to where you are today.",
    membersOnly: false,
  },
  {
    to: "/personal-training/semi-private",
    number: "03",
    icon: Users,
    title: "Semi-Private (3–4 people)",
    blurb:
      "Small groups of 3 to 4. Each workout is customized for the individual based on goal and level.",
    membersOnly: true,
  },
];

export default function PersonalTrainingOverview() {
  return (
    <Layout>
      <SEOHead
        title="Personal Training at Storm Wellness Club — Livonia, MI"
        description="Private coaching at Storm Wellness Club. 1:1 personal training, private Pilates, and semi-private sessions inside the circular club in Livonia, MI."
        path="/personal-training"
      />

      {/* Hero — editorial, asymmetric */}
      <section className="relative pt-32 pb-20 bg-background overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8">
              <p className="text-accent text-[11px] uppercase tracking-[0.4em] mb-6">
                Storm Wellness Club · Private Coaching
              </p>
              <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight mb-6">
                One body.
                <br />
                <span className="italic text-accent">One coach.</span>
                <br />
                One hour that counts.
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-xl">
                Private coaching at Storm Wellness Club — quiet rooms, premium equipment,
                and coaches who program for the body in front of them. Not a chain. Not a
                template. Yours.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href="#request">Request a coach</a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/memberships">View memberships</Link>
                </Button>
              </div>
            </div>

            <aside className="lg:col-span-4 lg:pl-8 lg:border-l border-border">
              <div className="space-y-6 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                    Where
                  </div>
                  <div className="font-serif text-xl">18340 Middlebelt Rd, Livonia</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                    Who it's for
                  </div>
                  <div className="text-foreground/90">
                    Members and the wider Detroit metro community — beginners welcome, advanced
                    respected.
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                    Session length
                  </div>
                  <div className="text-foreground/90">45–60 minutes, by appointment.</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Services — numbered editorial list */}
      <section className="py-20 bg-secondary/30 border-t border-border">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-2">
                The formats
              </p>
              <h2 className="font-serif text-4xl md:text-5xl">Three ways in.</h2>
            </div>
            <p className="hidden md:block text-sm text-muted-foreground max-w-xs">
              Pick the format. We'll match the coach.
            </p>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {services.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.to}
                  to={s.to}
                  className="group grid grid-cols-12 gap-4 md:gap-8 py-8 items-center hover:bg-background/60 transition-colors px-2 -mx-2"
                >
                  <div className="col-span-2 md:col-span-1 font-serif text-2xl md:text-3xl text-accent/70">
                    {s.number}
                  </div>
                  <div className="hidden md:flex md:col-span-1 w-12 h-12 rounded-full bg-accent/10 text-accent items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="col-span-7 md:col-span-6">
                    <div className="font-serif text-2xl md:text-3xl flex items-center gap-3 flex-wrap">
                      {s.title}
                      {s.membersOnly && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent text-[10px] tracking-[0.2em] uppercase">
                          Members only
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-10 md:col-span-3 text-sm text-muted-foreground md:text-left col-start-3 md:col-start-auto">
                    {s.blurb}
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all">
                    <ChevronRight className="h-6 w-6" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Philosophy — quiet, confident, brand-aligned */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6 max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-6 text-center">
            What you can expect
          </p>
          <p className="font-serif text-3xl md:text-4xl leading-snug text-center text-foreground/90">
            Training at Storm Wellness Club is intentionally quiet. Considered rooms,
            equipment chosen for the work, and a coach whose only job for the next hour
            is <span className="italic text-accent">you</span>.
          </p>

          <div className="grid md:grid-cols-3 gap-10 mt-16 pt-12 border-t border-border">
            {[
              {
                t: "Credentialed coaches",
                d: "Certified, technical, and chosen for how they teach — not how they sell.",
              },
              {
                t: "Considered rooms",
                d: "Reformers, racks, and recovery within a few steps of each other. No waiting.",
              },
              {
                t: "Built around your week",
                d: "Programming that fits the body you have and the schedule you actually keep.",
              },
            ].map((b) => (
              <div key={b.t}>
                <div className="font-serif text-xl mb-2">{b.t}</div>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Request form */}
      <section
        id="request"
        className="py-20 bg-secondary/30 border-t border-border scroll-mt-24"
      >
        <div className="container mx-auto px-6 max-w-2xl">
          <div className="text-center mb-10">
            <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-3">
              Start here
            </p>
            <h2 className="font-serif text-4xl mb-3">Tell us about your training.</h2>
            <p className="text-muted-foreground">
              A coach from Storm Wellness Club will reach out within one business day.
            </p>
          </div>
          <TrainingRequestForm />
        </div>
      </section>
    </Layout>
  );
}
