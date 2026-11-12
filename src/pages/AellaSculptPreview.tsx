import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useHashScroll } from "@/hooks/useHashScroll";
import { Layout } from "@/components/Layout";
import { AELLA_SCULPT, BODY_LAB } from "@/lib/aellaSculpt";
import { useSpaTreatmentZones } from "@/hooks/useSpaTreatmentZones";
import { activeZones } from "@/lib/spaZones";
import { SculptSeries } from "@/components/spa-preview/SculptSeries";
import { SculptBooking } from "@/components/spa-preview/SculptBooking";
import bodyLabForm from "@/assets/spa-preview/body-lab-form.jpg.asset.json";
import bodyLabBack from "@/assets/spa-preview/body-lab-back.jpg.asset.json";
import bodyLabCavitation from "@/assets/spa-preview/body-lab-cavitation.jpg.asset.json";
import bodyLabWood from "@/assets/spa-preview/body-lab-wood-therapy.jpg.asset.json";

const Eyebrow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[11px] tracking-[0.35em] uppercase text-muted-foreground ${className}`}>{children}</p>
);
const QuietLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="inline-block border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground transition-colors hover:border-foreground">
    {children}
  </a>
);

/** Private design preview of the Aella Sculpt treatment page (noindex, not linked from the menu). */
export default function AellaSculptPreview() {
  useHashScroll();

  const s = AELLA_SCULPT;
  const { data: zoneRows = [] } = useSpaTreatmentZones();
  const zones = activeZones(zoneRows, "aella-sculpt");
  return (
    <Layout>
      <Helmet>
        <title>Aella Sculpt preview</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="dark bg-background text-foreground">
        {/* Hero */}
        <section className="relative min-h-[100svh] md:grid md:grid-cols-12">
          <figure className="absolute inset-0 md:relative md:order-2 md:col-span-7">
            <img src={bodyLabForm.url} alt="Crossed arm resting over a bent knee in low warm light" width={736} height={964}
              className="h-full w-full object-cover object-[50%_30%] md:absolute md:inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent md:hidden" />
          </figure>
          <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-6 pb-16 md:col-span-5 md:px-16 md:pb-24">
            <Link to="/spa/preview#body-lab" className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground hover:text-foreground">
              Spa Aella · {BODY_LAB.name}
            </Link>
            <h1 className="mt-6 font-serif text-6xl leading-none md:text-7xl lg:text-8xl">{s.name}</h1>
            <p className="mt-6 font-serif text-2xl text-foreground/85 md:text-3xl">{s.heroLine}</p>
            <p className="mt-6 text-xs tracking-[0.25em] uppercase text-muted-foreground">{s.minutes} minutes</p>
            <div className="mt-10 flex gap-10">
              <QuietLink href="#book">Book Treatment</QuietLink>
              <QuietLink href="#technologies">How it works</QuietLink>
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="px-6 py-28 md:px-16 md:py-40">
          <div className="mx-auto max-w-3xl space-y-6 text-lg leading-relaxed text-foreground/85 md:text-xl">
            {s.intro.map((p) => <p key={p}>{p}</p>)}
          </div>
        </section>

        {/* Intention */}
        <section className="grid items-center md:grid-cols-12">
          <figure className="md:col-span-6">
            <img src={bodyLabBack.url} alt="The curve of a back in soft warm shadow" loading="lazy" width={1000} height={1000} className="aspect-square w-full object-cover" />
          </figure>
          <div className="px-6 py-20 md:col-span-6 md:px-16">
            <p className="font-serif text-3xl text-muted-foreground md:text-4xl">{s.intention[0]}</p>
            <p className="mt-4 font-serif text-5xl md:text-7xl">{s.intention[1]}</p>
          </div>
        </section>

        {/* Designed for */}
        <section className="px-6 py-28 md:px-16 md:py-40">
          <Eyebrow>What the treatment is designed for</Eyebrow>
          <p className="mt-6 max-w-2xl font-serif text-3xl leading-snug md:text-4xl">{s.designedForIntro}</p>
          <div className="mt-16 grid gap-x-10 md:grid-cols-4">
            {s.designedFor.map((d, i) => (
              <div key={d.title} className="border-t border-foreground/15 py-8">
                <Eyebrow>{String(i + 1).padStart(2, "0")}</Eyebrow>
                <h3 className="mt-4 font-serif text-3xl">{d.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{d.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Technologies */}
        <section id="technologies" className="scroll-mt-20 border-t border-foreground/10">
          <div className="grid md:grid-cols-12">
            <div className="md:col-span-5">
              <img src={bodyLabCavitation.url} alt="A provider guiding a cavitation handpiece across the lower back" loading="lazy" width={864} height={1080}
                className="h-[60svh] w-full object-cover md:sticky md:top-0 md:h-[100svh]" />
            </div>
            <div className="px-6 py-16 md:col-span-7 md:px-16 md:py-28">
              <Eyebrow>The technologies</Eyebrow>
              <h2 className="mt-4 font-serif text-5xl leading-[1.05] md:text-6xl">One treatment, layered.</h2>
              <p className="mt-6 max-w-xl text-muted-foreground">
                Each technology is part of one protocol, layered by your provider according to the treatment area and your goals.
              </p>
              <ol className="mt-12">
                {s.technologies.map((t, i) => (
                  <li key={t.title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t border-foreground/15 py-8">
                    <span className="pt-2 text-[11px] tracking-[0.3em] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h3 className="font-serif text-2xl md:text-3xl">{t.title}</h3>
                      <p className="mt-3 leading-relaxed text-muted-foreground">{t.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* One focus */}
        <section className="bg-cream text-background">
          <div className="grid gap-12 px-6 py-24 md:grid-cols-12 md:px-16 md:py-36">
            <div className="md:col-span-5">
              <h2 className="font-serif text-5xl leading-[1.05] md:text-6xl">{s.focusTitle}</h2>
              <p className="mt-8 leading-relaxed text-background/75">{s.focusBody}</p>
            </div>
            <ul className="md:col-span-6 md:col-start-7">
              {zones.map((z) => (
                <li key={z.id} className="border-t border-background/20 py-4 last:border-b">
                  <p className="font-serif text-2xl md:text-3xl">{z.name}</p>
                  {z.description && <p className="mt-1 text-sm text-background/65">{z.description}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Series + prices */}
        <SculptSeries />

        {/* Is / isn't */}
        <section className="border-t border-foreground/10 px-6 py-28 md:px-16 md:py-40">
          <div className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-5">
              <Eyebrow>What Aella Sculpt is — and isn't</Eyebrow>
              <p className="mt-6 font-serif text-3xl leading-snug md:text-4xl">{s.is}</p>
            </div>
            <div className="md:col-span-6 md:col-start-7">
              <p className="text-muted-foreground">It is not:</p>
              <ul className="mt-4">
                {s.isnt.map((x) => <li key={x} className="border-t border-foreground/15 py-4 text-lg last:border-b">{x}</li>)}
              </ul>
              <p className="mt-6 text-sm text-muted-foreground">{s.isntNote}</p>
            </div>
          </div>
        </section>

        {/* First visit */}
        <section className="border-t border-foreground/10">
          <div className="grid md:grid-cols-12">
            <figure className="md:col-span-5">
              <img src={bodyLabWood.url} alt="Wood therapy roller moving along the back of a thigh by candlelight" loading="lazy" width={480} height={480}
                className="aspect-square w-full object-cover md:sticky md:top-20" />
            </figure>
            <div className="px-6 py-16 md:col-span-7 md:px-16 md:py-28">
              <Eyebrow>First visit</Eyebrow>
              <h2 className="mt-4 font-serif text-4xl leading-[1.05] md:text-5xl">{s.firstVisitTitle}</h2>
              <p className="mt-6 max-w-xl text-muted-foreground">{s.firstVisitLine}</p>
              <ol className="mt-10">
                {s.firstVisit.map((f, i) => (
                  <li key={f} className="grid grid-cols-[2.5rem_1fr] border-t border-foreground/15 py-4 last:border-b">
                    <span className="pt-1 text-[11px] tracking-[0.3em] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <SculptBooking />

        <div className="px-6 pb-20 text-center md:px-16">
          <Link to="/spa/preview#body-lab" className="text-xs tracking-[0.25em] uppercase text-muted-foreground hover:text-foreground">
            Back to Spa Aella
          </Link>
        </div>
      </div>
    </Layout>
  );
}
