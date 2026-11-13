import { Fragment, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/Layout";
import { SpaBookingModal } from "@/components/booking/SpaBookingModal";
import { useSpaServices, type SpaService } from "@/hooks/useSpaManagement";
import { useHashScroll } from "@/hooks/useHashScroll";
import { orderedSpaMenu } from "@/lib/spaMenu";
import { groupTreatments, type TreatmentGroup } from "@/lib/spaVariants";
import { isSeaweedRitual, SEAWEED_RITUAL_BENEFITS, SEAWEED_RITUAL_PREPARATION } from "@/lib/seaweedRitual";
import { SPA_CATEGORIES } from "@/lib/spa-content";
import { TreatmentRow } from "@/components/spa-preview/TreatmentRow";
import { SpaTimeFinder } from "@/components/spa-preview/SpaTimeFinder";
import { BodyLabChapter } from "@/components/spa-preview/BodyLabChapter";
import aellaLogo from "@/assets/aella-logo-mark.png";
import glowProfile from "@/assets/spa-preview/glow-profile.jpg.asset.json";
import massageHands from "@/assets/spa-preview/massage-hands-rest.jpg.asset.json";
import handCheekMoody from "@/assets/spa-preview/hand-cheek-moody.jpg";
import hammam from "@/assets/spa-preview/hammam-scrub.jpg.asset.json";
import serumDropper from "@/assets/spa-preview/serum-dropper.jpg.asset.json";
import presenceEven from "@/assets/spa-preview/presence-even.jpg.asset.json";
import aellaRoom from "@/assets/spa-preview/aella-treatment-room.jpg.asset.json";
import bananaLeaf from "@/assets/spa-preview/banana-leaf.jpg.asset.json";
import goldSkin from "@/assets/spa-preview/gold-skin.jpg.asset.json";
import klytiaAmpoules from "@/assets/spa-preview/klytia-ampoules.jpg.asset.json";
import klytiaHeritageDark from "@/assets/spa-preview/klytia-heritage-dark.jpg.asset.json";
import microneedling from "@/assets/spa-preview/microneedling.jpg.asset.json";
import aellaDoor from "@/assets/spa-preview/aella-door-candlelit.jpg.asset.json";
import saunaSilhouette from "@/assets/spa-preview/sauna-silhouette.jpg.asset.json";
import mudWrap from "@/assets/spa-preview/mud-wrap.jpg";
import bodyLabForm from "@/assets/spa-preview/body-lab-form.jpg.asset.json";

type Chapter = { id: string; category: string; title: string; line: string; img: string; chapterImg?: string; chapterPos?: string; chapterTone?: string; cardPos?: string };

const CHAPTERS: Chapter[] = [
  { id: "massage", category: "Massage", title: "Massage & Bodywork", line: "Unhurried hands, and pressure that listens.", img: massageHands.url, cardPos: "object-[50%_35%]", chapterPos: "object-[50%_35%]" },
  { id: "facials", category: "Facials", title: "Facials", line: "Skin, read closely and treated with care.", img: handCheekMoody, chapterImg: serumDropper.url, chapterPos: "object-[50%_40%]" },
  { id: "body", category: "Body Wraps", title: "Body Treatments", line: "Warmth, minerals and a slow rinse.", img: hammam.url, chapterPos: "object-[50%_50%]", chapterTone: "saturate-[0.75] brightness-[0.62] sepia-[0.15]" },
  { id: "body-lab", category: "Aella Body Lab", title: "Aella Body Lab", line: "Body sculpting & contouring.", img: bodyLabForm.url, cardPos: "object-[50%_30%]" },
  { id: "recovery", category: "Recovery", title: "Recovery", line: "Heat, cold, light and stillness, on your schedule.", img: saunaSilhouette.url, cardPos: "object-[60%_50%]", chapterPos: "object-[60%_50%]" },
];

const FACIAL_SLUGS = new Map(SPA_CATEGORIES.facials.services.map((s) => [s.name, s.slug]));

/** Extra presentation for particular treatments; everything else is a plain menu row. */
function rowExtras(g: TreatmentGroup<SpaService>) {
  const first = g.variants[0];
  if (/^storm signature massage/i.test(g.name)) return { label: "Signature" };
  if (isSeaweedRitual(first)) {
    return {
      label: "Signature ritual",
      photo: { src: bananaLeaf.url, alt: "Hands resting on a broad green leaf held close to the body", pos: "object-[50%_40%]" },
      notes: SEAWEED_RITUAL_BENEFITS.map((b) => b.title),
      aside: SEAWEED_RITUAL_PREPARATION,
    };
  }
  if (first.category === "Body Wraps" && /mud/i.test(g.name)) {
    return { photo: { src: mudWrap, alt: "Mineral mud brushed across a guest's back in candlelight", pos: "object-[50%_45%]" } };
  }
  if (first.category === "Facials") {
    const slug = FACIAL_SLUGS.get(g.name);
    return slug ? { viewHref: `/spa/preview/facials/${slug}` } : {};
  }
  return {};
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">{children}</p>
);

const QuietLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="inline-block border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground hover:border-foreground transition-colors">
    {children}
  </a>
);

export default function SpaPreview() {
  const { data: services = [] } = useSpaServices();
  const [selected, setSelected] = useState<SpaService | null>(null);
  useHashScroll();
  const active = useMemo(() => services.filter((s) => s.is_active), [services]);
  const menuFor = (cat: string) => groupTreatments(orderedSpaMenu(active, cat));

  return (
    <Layout>
      <Helmet>
        <title>Spa Aella preview</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="dark bg-background text-foreground">
        {/* 1. Arrival */}
        <section className="relative md:grid md:min-h-[100svh] md:grid-cols-12">
          <figure className="relative md:order-2 md:col-span-7">
            <img src={glowProfile.url} alt="A calm profile, eyes closed, skin catching warm light" className="aspect-[4/5] w-full object-cover object-[50%_30%] md:absolute md:inset-0 md:aspect-auto md:h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent md:bg-gradient-to-r md:from-background md:via-transparent" />
          </figure>
          <div className="relative z-10 -mt-24 flex flex-col justify-end px-6 pb-16 md:col-span-5 md:mt-0 md:min-h-[100svh] md:px-16 md:pb-24">
            <h1 className="sr-only">Spa Aella</h1>
            <img src={aellaLogo} alt="Spa Aella" width={600} height={247} className="h-12 w-auto self-start md:h-16" />
            <div className="mt-10 flex gap-10">
              <QuietLink href="#need">Explore Treatments</QuietLink>
              <QuietLink href="#book">View Availability</QuietLink>
            </div>
          </div>
        </section>

        {/* 2. What do you need today */}
        <section id="need" className="px-6 pt-20 pb-28 md:px-16 md:pt-28 scroll-mt-20">
          <Eyebrow>What do you need today?</Eyebrow>
          <div className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
            {CHAPTERS.map((c, i) => {
              const wide = i === CHAPTERS.length - 1 && CHAPTERS.length % 2 === 1; // odd last card spans the row on phones
              return (
                <a key={c.id} href={`#${c.id === "facials" ? "facials-intro" : c.id}`} className={`group relative overflow-hidden ${i % 2 ? "md:mt-16" : ""} ${wide ? "col-span-2 md:col-span-1" : ""}`}>
                  <img src={c.img} alt="" loading="lazy" className={`${wide ? "aspect-[16/10] md:aspect-[3/4]" : "aspect-[3/4]"} w-full object-cover saturate-[0.7] brightness-[0.85] transition-transform duration-[1200ms] group-hover:scale-[1.03] ${c.cardPos ?? ""}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent" />
                  <span className="absolute bottom-4 left-4 right-4 font-serif text-xl md:text-2xl">{c.title}</span>
                </a>
              );
            })}
          </div>
        </section>

        {/* 4. Chapters — signature treatments sit inside their own chapter */}
        {CHAPTERS.map((c, i) => {
          const groups = menuFor(c.category);
          return (
            <Fragment key={c.id}>
              {c.id === "facials" && (
                <>
                  <section id="facials-intro" aria-label="Facials" className="relative h-[90svh] min-h-[520px] overflow-hidden scroll-mt-20">
                    <img src={presenceEven.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_45%]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
                    <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
                      <p className="text-[11px] tracking-[0.4em] uppercase text-foreground/85">The power of</p>
                      <p className="mt-3 font-serif text-6xl leading-none text-foreground md:text-8xl lg:text-9xl">presence</p>
                    </div>
                  </section>
                  <section id="facials" className="scroll-mt-20">
                    <div className="grid md:grid-cols-12">
                      <figure className="md:col-span-7">
                        <img src={klytiaHeritageDark.url} alt="Klytia Paris serums and ampoules laid over archive photographs of Paris" loading="lazy" className="aspect-[4/3] w-full object-cover md:h-full" />
                      </figure>
                      <div className="flex flex-col justify-center px-6 py-20 md:col-span-5 md:px-14 md:py-28">
                        <Eyebrow>Klytia Paris · Since 1895</Eyebrow>
                        <h2 className="mt-5 font-serif text-5xl leading-[1.05] md:text-6xl">Skin keeps its own time.</h2>
                        <p className="mt-8 leading-relaxed text-foreground/80">
                          Klytia began in Paris in 1895 as an institut de beauté on Place Vendôme. Their professional facials follow chronobiology: skin changes through the day and with the seasons, so each treatment is shaped to where your skin is now.
                        </p>
                        <p className="mt-6 leading-relaxed text-foreground/80">
                          Aella is the only place in the United States offering Klytia's professional facials, performed by estheticians trained by Klytia.
                        </p>
                      </div>
                    </div>
                  </section>
                </>
              )}
              {c.id === "body-lab" ? <BodyLabChapter index={i} flip={i % 2 === 1} /> : (
                <section id={c.id === "facials" ? "facials-menu" : c.id} className="scroll-mt-20 border-t border-foreground/10">
                  <div className="grid md:grid-cols-12">
                    <div className={`md:col-span-5 ${i % 2 ? "md:order-2" : ""}`}>
                      <img src={c.chapterImg ?? c.img} alt="" loading="lazy" className={`h-[60svh] w-full object-cover ${c.chapterTone ?? "saturate-[0.7] brightness-[0.85]"} md:sticky md:top-0 md:h-[100svh] ${c.chapterPos ?? ""}`} />
                    </div>
                    <div className="px-6 py-16 md:col-span-7 md:px-16 md:py-28">
                      <Eyebrow>{String(i + 1).padStart(2, "0")}</Eyebrow>
                      <h2 className="mt-4 font-serif text-5xl md:text-6xl">{c.title}</h2>
                      <p className="mt-4 text-muted-foreground">{c.line}</p>
                      <ul className="mt-12">
                        {groups.length ? groups.map((g) => <TreatmentRow key={g.key} group={g} onBook={setSelected} {...rowExtras(g)} />) : (
                          <li className="py-6 border-t border-foreground/15 text-muted-foreground">Loading the menu…</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </section>
              )}
              {c.id === "facials" && (
                <section id="mesoeffect" aria-label="Klytia MesoEffect" className="scroll-mt-20 border-t border-foreground/10">
                  <div className="grid md:grid-cols-12">
                    <figure className="md:col-span-5">
                      <img src={microneedling.url} alt="A nano-needling pen moving across the skin's surface" loading="lazy" className="h-[70svh] w-full object-cover object-[50%_60%] md:h-full" />
                    </figure>
                    <div className="px-6 py-20 md:col-span-7 md:px-16 md:py-28">
                      <Eyebrow>New at Aella · Coming soon</Eyebrow>
                      <h2 className="mt-5 font-serif text-5xl leading-[1.05] md:text-6xl">Klytia MesoEffect</h2>
                      <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/85">
                        A nano-needling facial that works three concentrated Klytia serums into the skin.
                      </p>
                      <ul className="mt-10 max-w-xl">
                        <li className="border-t border-foreground/15 py-5 text-muted-foreground">Three serums layered in one visit: anti-aging, hydration and perfection.</li>
                        <li className="border-t border-foreground/15 py-5 text-muted-foreground">Gentle nano-needling works them into the surface of the skin.</li>
                        <li className="border-y border-foreground/15 py-5 text-muted-foreground">A calming sheet mask for face and neck, then a repair cream to finish.</li>
                      </ul>
                      <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted-foreground">Chosen for smoother texture, softer-looking fine lines and deep hydration.</p>
                      <img src={klytiaAmpoules.url} alt="Klytia serum ampoules" loading="lazy" className="mt-14 aspect-[16/9] w-full object-cover" />
                    </div>
                  </div>
                </section>
              )}
            </Fragment>
          );
        })}

        {/* 5. The space */}
        <section className="px-2 py-28 md:px-3 md:py-40">
          <div className="grid gap-2 md:grid-cols-12 md:gap-3">
            <figure className="md:col-span-7">
              <img src={aellaRoom.url} alt="A Spa Aella treatment room in warm candlelight" loading="lazy" className="aspect-[3/4] w-full object-cover" />
            </figure>
            <div className="flex flex-col gap-2 md:col-span-5 md:gap-3">
              <div className="px-4 py-10 md:px-8 md:py-16">
                <Eyebrow>The space</Eyebrow>
                <p className="mt-5 font-serif text-3xl leading-snug md:text-4xl">Warm light, a quiet door, and an hour that belongs to you.</p>
              </div>
              <img src={aellaDoor.url} alt="The arched oak door into a Spa Aella treatment room" loading="lazy" className="aspect-[3/4] w-full object-cover object-[50%_55%] md:aspect-auto md:h-0 md:min-h-0 md:flex-1" />
            </div>
          </div>
        </section>

        {/* 6. Open to you */}
        <section className="px-6 pb-28 md:px-16 md:pb-40">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-4xl md:text-5xl">Aella is open to you.</h2>
            <p className="mt-5 text-muted-foreground">No membership needed. Book online, or let us know and we'll find you a time.</p>
          </div>
        </section>

        {/* 7. Find your time — books right here instead of sending you back up the page */}
        <section id="book" className="scroll-mt-20">
          <div className="relative overflow-hidden">
            <img src={goldSkin.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_55%] opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
            <div className="relative px-6 pt-32 pb-16 text-center md:pt-44">
              <h2 className="font-serif text-5xl md:text-7xl">Let's find your time.</h2>
            </div>
          </div>
          <div className="px-6 pb-32 md:px-16 md:pb-44">
            <SpaTimeFinder services={active} chapters={CHAPTERS} onBook={setSelected} />
          </div>
        </section>
      </div>

      <SpaBookingModal service={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </Layout>
  );
}
