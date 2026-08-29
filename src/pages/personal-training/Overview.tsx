import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { buildBreadcrumbLd, buildServiceLd, buildFAQLd } from "@/lib/seo/schemas";
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
        title="Personal Trainer in Livonia, MI"
        description="1-on-1 personal training, private Pilates on the reformer & semi-private sessions in Livonia, MI. Certified coaches at Storm Wellness Club."
        path="/personal-training"
        jsonLd={[
          buildBreadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Personal Training", path: "/personal-training" },
          ]),
          buildServiceLd({
            name: "1:1 Personal Training",
            description: "Private coaching built around your goal and level. Programmed for you, progressed week to week. Members only.",
            path: "/personal-training/one-on-one",
            serviceType: "Personal Training",
          }),
          buildServiceLd({
            name: "Private Pilates on the Reformer",
            description: "One reformer, one instructor, one body. Every spring and cue dialed to where you are today. Open to everyone.",
            path: "/personal-training/private-pilates",
            serviceType: "Pilates Instruction",
          }),
          buildServiceLd({
            name: "Semi-Private Personal Training (3–4 people)",
            description: "Small groups of 3 to 4. Each workout is customized for the individual based on goal and level. Members only.",
            path: "/personal-training/semi-private",
            serviceType: "Personal Training",
          }),
          buildFAQLd([
            { q: "Do I have to be a member to train?", a: "Private Pilates on the Reformer is open to everyone. 1:1 and Semi-Private training are reserved for active Storm Wellness Club members." },
            { q: "How do I get matched with a coach?", a: "Submit a request with your goals and availability. Our team matches you with the right trainer, who reaches out to schedule your first session." },
            { q: "What's the difference between Private Pilates and 1:1?", a: "Private Pilates is reformer-only and open to non-members. 1:1 Personal Training is strength, conditioning, and full-program coaching for members." },
          ]),
        ]}
      />

      {/* Hero — editorial, asymmetric */}
      <section className="relative pt-32 pb-20 bg-background overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8">
              <p className="text-accent text-[11px] uppercase tracking-[0.4em] mb-6">
                Storm Wellness Club · Private Coaching
              </p>
              <h1 className="text-foreground/90 text-sm md:text-base uppercase tracking-[0.2em] mb-6">
                Personal Training &amp; Private Pilates in Livonia, MI
              </h1>

              <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight mb-6">
                Trained for
                <br />
                <span className="italic text-accent">your goal.</span>
                <br />
                Coached at your level.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-xl">
                Private coaching at Storm Wellness Club. Every session is programmed
                around your goal, your level, and where your body is today.
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
                    Session length
                  </div>
                  <div className="text-foreground/90">60 minutes, by appointment.</div>
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
            Built on exercise science, recovery, nutrition, and behavioral
            psychology — <span className="italic text-accent">not</span> on a generic template.
          </p>

          <div className="grid md:grid-cols-3 gap-10 mt-16 pt-12 border-t border-border">
            {[
              {
                t: "The Storm Method",
                d: "A proprietary coaching framework refined over 15 years in the industry — assessment, programming, and progression built on movement science, not trend.",
              },
              {
                t: "Programmed for your physiology",
                d: "Every plan is written around your goal, your training age, and your body's current capacity. Strength, mobility, Pilates, post-rehab, sport-specific — calibrated, never recycled.",
              },
              {
                t: "Progressed with intent",
                d: "Load, tempo, and volume are tracked and progressed week to week so adaptation compounds. Measured work, measurable change.",
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

      {/* The Storm Method — editorial long-form */}
      <section className="py-24 bg-background border-t border-border">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <p className="text-[11px] uppercase tracking-[0.4em] text-accent mb-4">
                  The Method
                </p>
                <h2 className="font-serif text-4xl md:text-5xl leading-[1.05] mb-6">
                  The Storm <span className="italic">Method</span>
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                  Developed by founder Dr. Storm Durant from research on exercise adherence.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 lg:col-start-6 space-y-6">
              <p className="text-foreground/90 text-lg leading-relaxed">
                The Storm Method is a psychology-driven training system that combines
                fitness, recovery, nutrition, and behavioral science to build a plan
                around the individual — not a generic program.
              </p>
              <p className="text-foreground/80 leading-relaxed">
                It begins with understanding how your body responds to training,
                recovery, stress, and nutrition. That becomes your biological
                blueprint, and every part of the program is personalized from it — to
                improve results and increase long-term consistency.
              </p>

              <div className="pt-6">
                <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
                  What it integrates
                </p>
                <ul className="grid sm:grid-cols-2 gap-x-8">
                  {[
                    "Movement & Exercise Programming",
                    "Recovery Optimization",
                    "Nutrition & Lifestyle Factors",
                    "Accountability & Behavioral Coaching",
                    "Performance & Wellness Metrics",
                  ].map((item) => (
                    <li
                      key={item}
                      className="border-l border-accent/40 pl-4 py-2 text-foreground/90 text-sm"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="font-serif text-xl md:text-2xl italic leading-snug text-foreground/90 pt-6 border-t border-border mt-6">
                The goal isn't to help someone exercise more — it's to build a system
                they can actually sustain, so results become a lifestyle, not a
                short-term outcome.
              </p>
            </div>
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
