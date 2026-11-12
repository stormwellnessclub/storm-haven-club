import { Fragment, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SpaBookingModal } from "@/components/booking/SpaBookingModal";
import { useSpaServices, type SpaService } from "@/hooks/useSpaManagement";
import { orderedSpaMenu, spaMenuMode } from "@/lib/spaMenu";
import { compactMassageMenu } from "@/lib/massages";
import { compactBodyWrapMenu } from "@/lib/bodyWraps";
import { compactSeaweedMenu, isSeaweedRitual } from "@/lib/seaweedRitual";
import facialHands from "@/assets/spa-preview/facial-hands.jpg.asset.json";
import handCheek from "@/assets/spa-preview/hand-cheek.jpg.asset.json";
import maskFacial from "@/assets/spa-preview/mask-facial.jpg.asset.json";
import hammam from "@/assets/spa-preview/hammam-scrub.jpg.asset.json";
import pauseStones from "@/assets/spa-preview/pause-stones.jpg";
import glowProfile from "@/assets/spa-preview/glow-profile.jpg.asset.json";
import serumDropper from "@/assets/spa-preview/serum-dropper.jpg.asset.json";
import foamBrush from "@/assets/spa-preview/foam-brush.jpg.asset.json";
import greenMaskEye from "@/assets/spa-preview/green-mask-eye.jpg.asset.json";
import presenceBlur from "@/assets/spa-preview/presence-blur.jpg.asset.json";
import quietLeaf from "@/assets/spa-preview/quiet-leaf.jpg.asset.json";
import aellaRoom from "@/assets/spa-preview/aella-treatment-room.jpg.asset.json";
import seaweedCocoon from "@/assets/spa-preview/seaweed-cocoon.jpg.asset.json";
import bananaLeaf from "@/assets/spa-preview/banana-leaf.jpg.asset.json";
import goldSkin from "@/assets/spa-preview/gold-skin.jpg.asset.json";
import spaHallway from "@/assets/spa-hallway.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import saltRoom from "@/assets/salt-room.jpg";
import zerobody from "@/assets/zerobody-room.jpg";

type Chapter = { id: string; category: string; title: string; line: string; img: string; chapterImg?: string; chapterPos?: string };

const CHAPTERS: Chapter[] = [
  { id: "massage", category: "Massage", title: "Massage & Bodywork", line: "Unhurried hands, and pressure that listens.", img: handCheek.url },
  { id: "facials", category: "Facials", title: "Facials", line: "Skin, read closely and treated with care.", img: glowProfile.url, chapterImg: serumDropper.url, chapterPos: "object-[50%_40%]" },
  { id: "body", category: "Body Wraps", title: "Body Treatments", line: "Warmth, minerals and a slow rinse.", img: hammam.url, chapterImg: bananaLeaf.url, chapterPos: "object-[50%_30%]" },
  { id: "recovery", category: "Recovery", title: "Recovery", line: "Light, cold and stillness, on your schedule.", img: zerobody },
];

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">{children}</p>
);

const QuietLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="inline-block border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground hover:border-foreground transition-colors">
    {children}
  </a>
);

function Row({ s, onBook }: { s: SpaService; onBook: (s: SpaService) => void }) {
  const mode = spaMenuMode(s);
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 py-6 border-t border-foreground/15">
      <div>
        <h4 className="font-serif text-2xl text-foreground">{s.name}</h4>
        {s.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2 max-w-xl">{s.description}</p>}
        <p className="mt-2 text-xs tracking-[0.2em] uppercase text-muted-foreground">
          {s.duration_minutes} min · ${Number(s.price).toFixed(0)}
        </p>
      </div>
      <div className="flex flex-col items-end justify-center gap-3">
        {mode === "book" && (
          <button onClick={() => onBook(s)} className="text-xs tracking-[0.25em] uppercase border border-foreground/50 px-5 py-3 text-foreground hover:bg-foreground hover:text-background transition-colors">
            Book
          </button>
        )}
        {mode === "request" && (
          <Link to="/spa?category=Facials" className="text-xs tracking-[0.25em] uppercase border border-foreground/50 px-5 py-3 text-foreground hover:bg-foreground hover:text-background transition-colors">
            Request
          </Link>
        )}
        {mode === "soon" && <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground">Coming soon</span>}
      </div>
    </li>
  );
}

export default function SpaPreview() {
  const { data: services = [] } = useSpaServices();
  const [selected, setSelected] = useState<SpaService | null>(null);
  const active = useMemo(() => services.filter((s) => s.is_active), [services]);
  const menuFor = (cat: string) => compactMassageMenu(compactBodyWrapMenu(compactSeaweedMenu(orderedSpaMenu(active, cat))));
  const signature = useMemo(() => {
    const ritual = active.find((s) => isSeaweedRitual(s));
    const sig = active.find((s) => /storm signature/i.test(s.name));
    return [sig, ritual].filter(Boolean) as SpaService[];
  }, [active]);

  return (
    <Layout>
      <Helmet>
        <title>Spa Aella preview</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="dark bg-background text-foreground">
        {/* 1. Arrival */}
        <section className="relative h-[100svh] min-h-[560px] overflow-hidden">
          <img src={facialHands.url} alt="Hands resting along a client's jaw during a facial" className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/20" />
          <div className="relative z-10 flex h-full flex-col justify-end px-6 pb-16 md:px-16 md:pb-24 max-w-5xl">
            <Eyebrow>Spa Aella</Eyebrow>
            <h1 className="mt-5 font-serif text-5xl leading-[1.02] md:text-7xl lg:text-8xl">
              The part of wellness you shouldn't have to earn.
            </h1>
            <div className="mt-10 flex gap-10">
              <QuietLink href="#need">Explore Treatments</QuietLink>
              <QuietLink href="#massage">View Availability</QuietLink>
            </div>
          </div>
        </section>

        {/* 2. Why Aella */}
        <section className="px-6 py-28 md:py-44 md:px-16">
          <p className="mx-auto max-w-3xl text-center font-serif text-3xl leading-snug md:text-5xl text-foreground/90">
            You should not have to be exhausted before you decide your body deserves care.
          </p>
        </section>

        {/* 3. What do you need today */}
        <section id="need" className="px-6 pb-28 md:px-16 scroll-mt-20">
          <Eyebrow>What do you need today?</Eyebrow>
          <div className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            {CHAPTERS.map((c, i) => (
              <a key={c.id} href={`#${c.id}`} className={`group relative overflow-hidden ${i % 2 ? "md:mt-16" : ""}`}>
                <img src={c.img} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover saturate-[0.7] brightness-[0.85] transition-transform duration-[1200ms] group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent" />
                <span className="absolute bottom-4 left-4 right-4 font-serif text-xl md:text-2xl">{c.title}</span>
              </a>
            ))}
          </div>
        </section>

        {/* 4. Pause */}
        <section aria-hidden="true">
          <img src={pauseStones} alt="" loading="lazy" width={1920} height={1088} className="h-[70svh] w-full object-cover" />
        </section>

        {/* 5. Signature */}
        {signature.length > 0 && (
          <section className="px-6 py-28 md:px-16 md:py-40">
            <Eyebrow>Signature</Eyebrow>
            <div className="mt-12 space-y-24">
              {signature.map((s, i) => (
                <article key={s.id} className={`grid items-center gap-10 md:grid-cols-12 ${i % 2 ? "md:[&>figure]:order-2" : ""}`}>
                  <figure className="md:col-span-7">
                    {isSeaweedRitual(s) ? (
                      <img src={seaweedCocoon.url} alt="A guest resting in a warm body wrap cocoon" loading="lazy" className="aspect-[3/2] w-full object-cover object-[60%_50%]" />
                    ) : (
                      <img src={pauseStones} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover md:aspect-[4/3]" />
                    )}
                  </figure>
                  <div className="md:col-span-5">
                    <h3 className="font-serif text-4xl md:text-5xl">{s.name}</h3>
                    {s.description && <p className="mt-5 text-muted-foreground leading-relaxed">{s.description}</p>}
                    <p className="mt-6 text-xs tracking-[0.2em] uppercase text-muted-foreground">{s.duration_minutes} min · ${Number(s.price).toFixed(0)}</p>
                    <button onClick={() => setSelected(s)} className="mt-8 text-xs tracking-[0.25em] uppercase border border-foreground/50 px-6 py-3 hover:bg-foreground hover:text-background transition-colors">
                      Find Your Time
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* 6. Chapters */}
        {CHAPTERS.map((c, i) => {
          const rows = menuFor(c.category);
          return (
            <Fragment key={c.id}>
            {c.id === "recovery" && (
              <section aria-hidden="true" className="bg-spa-stone">
                <img src={quietLeaf.url} alt="" loading="lazy" className="w-full md:ml-auto md:w-[45%] md:[mask-image:linear-gradient(to_right,transparent,black_35%)]" />
              </section>
            )}
            {c.id === "facials" && (
              <section aria-label="Facials" className="relative h-[90svh] min-h-[520px] overflow-hidden">
                <img src={presenceBlur.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_45%]" />
                <div className="absolute inset-0 bg-background/25" />
                <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
                  <p className="text-[11px] tracking-[0.4em] uppercase text-foreground/85">The power of</p>
                  <p className="mt-3 font-serif text-6xl leading-none text-foreground md:text-8xl lg:text-9xl">presence</p>
                </div>
              </section>
            )}
            <section id={c.id} className="scroll-mt-20 border-t border-foreground/10">
              <div className="grid md:grid-cols-12">
                <div className={`md:col-span-5 ${i % 2 ? "md:order-2" : ""}`}>
                  <img src={c.chapterImg ?? c.img} alt="" loading="lazy" className={`h-[60svh] w-full object-cover saturate-[0.7] brightness-[0.85] md:sticky md:top-0 md:h-[100svh] ${c.chapterPos ?? ""}`} />
                </div>
                <div className="px-6 py-16 md:col-span-7 md:px-16 md:py-28">
                  <Eyebrow>{String(i + 1).padStart(2, "0")}</Eyebrow>
                  <h2 className="mt-4 font-serif text-5xl md:text-6xl">{c.title}</h2>
                  <p className="mt-4 text-muted-foreground">{c.line}</p>
                  <ul className="mt-12">
                    {rows.length ? rows.map((s) => <Row key={s.id} s={s} onBook={setSelected} />) : (
                      <li className="py-6 border-t border-foreground/15 text-muted-foreground">Loading the menu…</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
            {c.id === "facials" && (
              <>
                <section aria-hidden="true" className="px-2 py-2 md:px-3 md:py-3">
                  <div className="grid grid-cols-3 gap-2 md:gap-3">
                    <img src={foamBrush.url} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover saturate-[0.8] brightness-[0.9]" />
                    <img src={greenMaskEye.url} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover saturate-[0.8] brightness-[0.9] md:translate-y-12" />
                    <img src={maskFacial.url} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover saturate-[0.8] brightness-[0.9]" />
                  </div>
                </section>
              </>
            )}
            </Fragment>
          );
        })}

        {/* 7. The space */}
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
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <img src={spaHallway} alt="Spa Aella hallway" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                <img src={spaShower} alt="Spa showers" loading="lazy" className="aspect-[3/4] w-full object-cover" />
              </div>
              <img src={saltRoom} alt="Salt room" loading="lazy" className="aspect-[16/10] w-full object-cover md:flex-1" />
            </div>
          </div>
        </section>

        {/* 8. Open to you */}
        <section className="px-6 pb-28 md:px-16 md:pb-40">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-4xl md:text-5xl">Aella is open to you.</h2>
            <p className="mt-5 text-muted-foreground">No membership needed. Book online, or let us know and we'll find you a time.</p>
          </div>
        </section>

        {/* 9. Find your time */}
        <section className="relative overflow-hidden">
          <img src={goldSkin.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_55%] opacity-50" />
          <div className="relative px-6 py-32 text-center md:py-48">
            <h2 className="font-serif text-5xl md:text-7xl">Let's find your time.</h2>
            <div className="mt-10"><QuietLink href="#massage">View Availability</QuietLink></div>
          </div>
        </section>
      </div>

      <SpaBookingModal service={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </Layout>
  );
}
