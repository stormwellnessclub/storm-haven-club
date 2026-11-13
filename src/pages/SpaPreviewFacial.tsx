import { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useSpaServices } from "@/hooks/useSpaManagement";
import { getService } from "@/lib/spa-content";
import { groupTreatments } from "@/lib/spaVariants";
import { lengthLabel, requestHref } from "@/components/spa-preview/TreatmentRow";
import foamBrush from "@/assets/spa-preview/foam-brush.jpg.asset.json";
import greenMaskEye from "@/assets/spa-preview/green-mask-eye.jpg.asset.json";
import maskFacial from "@/assets/spa-preview/mask-facial.jpg.asset.json";
import facialHands from "@/assets/spa-preview/facial-hands.jpg.asset.json";
import handCheek from "@/assets/spa-preview/hand-cheek.jpg.asset.json";
import serumDropper from "@/assets/spa-preview/serum-dropper.jpg.asset.json";
import glowProfile from "@/assets/spa-preview/glow-profile.jpg.asset.json";
import klytiaAmpoules from "@/assets/spa-preview/klytia-ampoules.jpg.asset.json";

/** One photo per facial page. The three mask/brush close-ups live here rather than on the main page. */
export const FACIAL_PHOTOS: Record<string, { src: string; alt: string; pos?: string }> = {
  customized: { src: foamBrush.url, alt: "A soft fan brush lifting cleansing foam from the skin", pos: "object-[50%_45%]" },
  "detoxifying-purity": { src: greenMaskEye.url, alt: "A green clay mask setting around the eye", pos: "object-[50%_40%]" },
  "botanical-bliss": { src: maskFacial.url, alt: "A botanical mask smoothed along the jaw" },
  "age-defying": { src: facialHands.url, alt: "Hands sculpting along the jaw during a facial", pos: "object-[50%_35%]" },
  "hydration-infusion": { src: serumDropper.url, alt: "A serum dropper resting against dewy skin", pos: "object-[50%_40%]" },
  "radiant-glow": { src: glowProfile.url, alt: "A calm profile with skin catching warm light", pos: "object-[50%_30%]" },
  "vitamin-c-brightening": { src: handCheek.url, alt: "A hand resting against a freshly treated cheek", pos: "object-[50%_40%]" },
  "peptide-renewal": { src: klytiaAmpoules.url, alt: "Klytia serum ampoules on a dark surface" },
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">{children}</p>
);
const primary = "inline-flex items-center justify-center border border-foreground bg-foreground px-8 py-4 text-xs tracking-[0.25em] uppercase text-background transition-opacity hover:opacity-90";

/** A facial's "View Treatment" page in the Spa Aella design (canonical: the /spa/facials/:slug service page). */
export default function SpaPreviewFacial() {
  const { slug = "" } = useParams<{ slug: string }>();
  const content = getService("facials", slug);
  const { data: services = [] } = useSpaServices();
  const group = useMemo(
    () => groupTreatments(services.filter((s) => s.category === "Facials")).find((g) => g.name === content?.name),
    [services, content?.name],
  );
  if (!content) return <Navigate to="/spa#facials-menu" replace />;
  const photo = FACIAL_PHOTOS[slug] ?? FACIAL_PHOTOS.customized;
  const lengths = group?.variants ?? [];
  const request = requestHref({ name: group?.variants[0]?.name ?? content.name });

  return (
    <Layout>
      <Helmet>
        <title>{`${content.name} | Spa Aella`}</title>
        <link rel="canonical" href={`https://stormwellnessclub.com/spa/facials/${slug}`} />
      </Helmet>
      <div className="dark bg-background text-foreground">
        <section className="relative min-h-[100svh] md:grid md:grid-cols-12">
          <figure className="absolute inset-0 md:relative md:order-2 md:col-span-7">
            <img src={photo.src} alt={photo.alt} className={`h-full w-full object-cover saturate-[0.85] brightness-[0.85] md:absolute md:inset-0 ${photo.pos ?? ""}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent md:hidden" />
          </figure>
          <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-6 pb-16 md:col-span-5 md:px-16 md:pb-24">
            <Link to="/spa#facials-menu" className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground hover:text-foreground">
              Spa Aella · Facials
            </Link>
            <h1 className="mt-6 font-serif text-5xl leading-[1.02] md:text-6xl lg:text-7xl">{content.name}</h1>
            <p className="mt-6 max-w-lg leading-relaxed text-foreground/85">{content.subhead}</p>
            <p className="mt-6 text-xs tracking-[0.2em] uppercase text-muted-foreground">
              {lengths.length ? lengths.map(lengthLabel).join("   /   ") : content.durations.join(" or ")}
            </p>
            <div className="mt-10"><Link to={request} className={primary}>Request Appointment</Link></div>
          </div>
        </section>

        <section className="px-6 py-24 md:px-16 md:py-36">
          <div className="mx-auto max-w-3xl">
            <Eyebrow>The experience</Eyebrow>
            <div className="mt-8 space-y-6 text-lg leading-relaxed text-foreground/85">
              {content.body.map((p) => <p key={p}>{p}</p>)}
            </div>
          </div>
        </section>

        <section className="border-t border-foreground/10 px-6 py-24 md:px-16 md:py-32">
          <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-12">
            <div className="md:col-span-4"><Eyebrow>Why you might choose it</Eyebrow></div>
            <ul className="md:col-span-8">
              {content.benefits.map((b) => <li key={b} className="border-t border-foreground/15 py-4 text-lg last:border-b">{b}</li>)}
            </ul>
          </div>
        </section>

        <section className="border-t border-foreground/10 px-6 py-24 md:px-16 md:py-32">
          <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-12">
            <div className="md:col-span-4"><Eyebrow>Before you arrive</Eyebrow></div>
            <dl className="md:col-span-8">
              {content.faqs.map((f) => (
                <div key={f.q} className="border-t border-foreground/15 py-6 last:border-b">
                  <dt className="font-serif text-2xl">{f.q}</dt>
                  <dd className="mt-2 leading-relaxed text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="px-6 py-28 text-center md:py-40">
          <h2 className="font-serif text-5xl md:text-6xl">Let's find your time.</h2>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">Send us the days and times that suit you, and we'll confirm your appointment.</p>
          <div className="mt-10"><Link to={request} className={primary}>Request Appointment</Link></div>
          <div className="mt-12">
            <Link to="/spa#facials-menu" className="text-xs tracking-[0.25em] uppercase text-muted-foreground hover:text-foreground">Back to facials</Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
