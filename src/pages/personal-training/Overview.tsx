import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { buildBreadcrumbLd, buildServiceLd, buildFAQLd } from "@/lib/seo/schemas";
import { ChevronRight, Dumbbell, CircleDot, Users } from "lucide-react";
import { TrainingRequestForm } from "@/components/personal-training/TrainingRequestForm";
import { PTPriceTable } from "@/components/personal-training/PTPriceTable";
import { Chapter, EdImage, Reveal } from "@/components/editorial/Editorial";
import type { PtFormat } from "@/lib/ptFormat";
import heroPhoto from "@/assets/gym-area-2.jpg";
import methodPhoto from "@/assets/gym-area-1.jpg";
import beyondPhoto from "@/assets/zerobody-room.jpg";

const PROCESS = [
  { n: "01", title: "Understand the individual", body: "We begin with your goals, movement capabilities, training history, physical considerations, recovery patterns, and lifestyle. These insights establish the foundation for programming." },
  { n: "02", title: "Program with precision", body: "Exercise selection, resistance, volume, intensity, tempo, and recovery are considered in relation to your individual needs. Your program is designed to create the right stimulus for adaptation—not simply to make every session harder." },
  { n: "03", title: "Measure and adapt", body: "Strength, performance, technique, and training responses inform how your program evolves. Progress is evaluated over time, with adjustments made as your capacity, goals, and needs change." },
  { n: "04", title: "Build the behavior behind the results", body: "Consistency is not simply a matter of discipline. Motivation, confidence, perceived barriers, and the relationship between coach and client all influence adherence. Our coaching approach acknowledges these factors so training becomes something you can sustain." },
];

const PRICE_FORMATS: { value: PtFormat; label: string }[] = [
  { value: "semi_private", label: "Semi-Private" },
  { value: "one_on_one", label: "1:1 Personal Training" },
  { value: "reformer_one_on_one", label: "Private Pilates" },
];

const services = [
  {
    to: "/personal-training/one-on-one",
    number: "01",
    icon: Dumbbell,
    title: "1:1 Personal Training",
    blurb:
      "Private coaching built around your goal and your level. Programmed for you, progressed week to week.",
  },
  {
    to: "/personal-training/private-pilates",
    number: "02",
    icon: CircleDot,
    title: "Private Pilates",
    blurb:
      "One reformer, one instructor, one body. Every spring and cue dialed to where you are today.",
  },
  {
    to: "/personal-training/semi-private",
    number: "03",
    icon: Users,
    title: "Semi-Private (3–4 people)",
    blurb:
      "Small groups of 3 to 4. Each workout is customized for the individual based on goal and level.",
  },
];

export default function PersonalTrainingOverview() {
  const [priceFormat, setPriceFormat] = useState<PtFormat>("semi_private");
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
            description: "Private coaching built around your goal and level. Programmed for you, progressed week to week. Open to members and non-members.",
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
            description: "Small groups of 3 to 4. Each workout is customized for the individual based on goal and level. Open to members and non-members.",
            path: "/personal-training/semi-private",
            serviceType: "Personal Training",
          }),
          buildFAQLd([
            { q: "Do I have to be a member to train?", a: "No. 1:1, Private Pilates and Semi-Private training are open to members and non-members. Members get member pricing." },
            { q: "How do I get matched with a coach?", a: "Submit a request with your goals and availability. Our team matches you with the right trainer, who reaches out to schedule your first session." },
            { q: "What's the difference between Private Pilates and 1:1?", a: "Private Pilates is reformer-only. 1:1 Personal Training is strength, conditioning, and full-program coaching." },
          ]),
        ]}
      />

      {/* Hero */}
      <section className="relative">
        <EdImage src={heroPhoto} alt="The training floor at Storm Wellness Club" className="h-[70vh] min-h-[420px]" eager />
        <div className="absolute inset-0 bg-foreground/50" />
        <div className="absolute inset-x-0 bottom-0 container mx-auto px-6 pb-12 text-primary-foreground">
          <Chapter n="01" label="Personal Training · Livonia, MI" light />
          <h1 className="font-serif text-5xl md:text-7xl mt-4 max-w-3xl leading-[0.95]">Personal Training</h1>
          <p className="mt-5 max-w-2xl text-lg md:text-2xl font-serif text-primary-foreground/90">
            The science of movement. The psychology of lasting change.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
            <a href="#request" className="inline-flex items-center gap-3 ed-caption pb-1 border-b border-primary-foreground/50 hover:border-primary-foreground transition-colors">
              Request a coach <span aria-hidden>↓</span>
            </a>
            <a href="#packages" className="inline-flex items-center gap-3 ed-caption pb-1 border-b border-primary-foreground/30 hover:border-primary-foreground transition-colors">
              Packages <span aria-hidden>↓</span>
            </a>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="py-20 md:py-28 bg-background">
        <div className="container mx-auto px-6 max-w-3xl">
          <Reveal>
            <p className="font-serif text-3xl md:text-5xl leading-tight">
              Your body is not a template. Your training shouldn't be either.
            </p>
            <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
              At Storm Wellness Club, personal training begins with understanding the individual. How you move. How you
              respond to physical demands. What influences your recovery, motivation, and consistency.
            </p>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Through The Storm Method, we bring together exercise science, individualized programming, and behavioral
              psychology to create a more thoughtful approach to training—one that evolves with you.
            </p>
          </Reveal>
        </div>
      </section>

      {/* The Storm Method */}
      <section className="border-t border-border bg-background">
        <div className="container mx-auto px-6 py-20 md:py-28 grid gap-10 md:grid-cols-2 md:gap-16 items-center">
          <EdImage src={methodPhoto} alt="The strength floor at Storm Wellness Club" className="aspect-[4/5]" />
          <Reveal>
            <Chapter n="02" label="The Storm Method" />
            <h2 className="font-serif text-4xl md:text-5xl mt-4 leading-[1.05]">Where physical science meets human behavior.</h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Developed through years of coaching experience and founder Dr. Storm Durant's research into exercise adherence
              and the trainer–trainee relationship, The Storm Method was built around a fundamental understanding: knowing how
              to train someone is only part of helping them succeed.
            </p>
            <p className="mt-5 font-serif text-2xl leading-snug">Understanding the person behind the movement matters just as much.</p>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Our approach considers the physiological demands of training alongside the psychological and lifestyle factors
              that influence progress. Rather than asking every client to fit the same system, we adapt the system to the
              individual.
            </p>
          </Reveal>
        </div>
      </section>

      {/* The Process */}
      <section className="border-t border-border bg-secondary/30">
        <div className="container mx-auto px-6 py-20 md:py-28 max-w-6xl">
          <Reveal>
            <Chapter n="03" label="The Process" />
            <h2 className="font-serif text-4xl md:text-5xl mt-4 max-w-2xl leading-[1.05]">Nothing arbitrary. Every detail has a purpose.</h2>
          </Reveal>
          <div className="mt-14 grid gap-x-14 gap-y-12 md:grid-cols-2">
            {PROCESS.map((step, i) => (
              <Reveal key={step.n} delay={i * 80} className="border-t border-border pt-6">
                <p className="font-serif text-3xl text-accent/80">{step.n}</p>
                <h3 className="font-serif text-2xl mt-3">{step.title}</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Beyond the Workout */}
      <section className="border-t border-border bg-background">
        <div className="container mx-auto px-6 py-20 md:py-28 grid gap-10 md:grid-cols-2 md:gap-16 items-center">
          <Reveal className="md:order-1">
            <Chapter n="04" label="Beyond the Workout" />
            <h2 className="font-serif text-4xl md:text-5xl mt-4 leading-[1.05]">Training is one part of the equation.</h2>
            <p className="mt-6 font-serif text-2xl leading-snug">Exercise creates the stimulus. How the body responds depends on much more.</p>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Recovery, sleep, nutrition, stress, and daily demands all influence training readiness and adaptation. We
              consider these factors throughout the coaching process rather than treating each workout as an isolated event.
            </p>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              At Storm Wellness Club, the opportunity to bring movement, recovery, and wellness into one environment allows for
              a more connected approach to how you train and care for your body.
            </p>
          </Reveal>
          <EdImage src={beyondPhoto} alt="The recovery suite at Storm Wellness Club" className="aspect-[4/5] md:order-2" />
        </div>
      </section>

      {/* Personal to You */}
      <section className="border-t border-border bg-background">
        <div className="container mx-auto px-6 py-20 md:py-28 max-w-3xl">
          <Reveal>
            <Chapter n="05" label="Personal to You" />
            <h2 className="font-serif text-4xl md:text-5xl mt-4 leading-[1.05]">Different bodies. Different goals. Different starting points.</h2>
            <p className="mt-8 text-lg text-foreground/90 leading-relaxed">
              Building strength. Improving movement quality. Developing athletic performance. Returning to a consistent routine.
              Navigating physical limitations. Rebuilding confidence in your body.
            </p>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Whatever brings you here, the process begins with where you are—not where someone assumes you should be.
            </p>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              No two clients require the same approach, and no program should remain unchanged as the person progresses.
            </p>
          </Reveal>
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

      {/* Your Investment in the Process */}
      <section id="packages" className="border-t border-border bg-background scroll-mt-24">
        <div className="container mx-auto px-6 py-20 md:py-28 max-w-4xl">
          <Reveal>
            <Chapter n="06" label="Your Investment in the Process" />
            <h2 className="font-serif text-4xl md:text-5xl mt-4 leading-[1.05]">Personal Training Packages</h2>
            <p className="mt-5 text-muted-foreground max-w-2xl leading-relaxed">
              Explore our personal training packages, with member and non-member pricing and available payment options.
            </p>
          </Reveal>
          <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Training format">
            {PRICE_FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={priceFormat === f.value}
                onClick={() => setPriceFormat(f.value)}
                className={`ed-caption px-4 py-2 border transition-colors ${priceFormat === f.value ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="mt-6">
            <PTPriceTable format={priceFormat} />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>Payment plans are available on select larger packages. Final pricing is confirmed when your coach reaches out.</p>
            <a href="#request" className="text-foreground underline underline-offset-4">Go to the request form ↓</a>
          </div>
          <p className="mt-16 font-serif text-2xl md:text-3xl max-w-2xl leading-snug">
            Meaningful progress is built through understanding, intention, and consistency.
          </p>
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
