import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import legs from "@/assets/body-roller/Image_16.jpeg.asset.json";
import machine from "@/assets/body-roller/Image_57.jpeg.asset.json";
import loopVideo from "@/assets/body-roller/body-roller-loop.mp4.asset.json";

const BENEFITS: [string, string][] = [
  ["Less bloating, less water retention", "Rhythmic rolling and gentle compression help release trapped fluid. Many guests notice the difference first in their legs, which feel lighter and less swollen. Arms and the midsection can feel less puffy too."],
  ["Lymph, set in motion", "Unlike blood, lymph has no heart to pump it. It relies on movement. The rollers apply steady pressure along the body's natural pathways and guide fluid toward the lymph node clusters at the knees, groin and underarms, where the body processes what it no longer needs."],
  ["Circulation and energy", "As blood and lymph move more freely, more oxygen and nutrients reach soft tissue. Guests often say they leave feeling more energized, not sleepy."],
  ["Muscle release", "Slow, deep rolling works like a long session on a foam roller or a massage, except you get to stay still. Tight fascia softens and post-workout soreness eases."],
  ["Smoother, firmer-looking skin", "With regular sessions, the rolling can soften the look of cellulite and help skin look and feel firmer. Combined with how you already train and eat, it supports your body-shaping goals."],
  ["Warmed by red light", "Our machine has built-in red light therapy. Its gentle warmth reaches deeper into the tissue and makes the session feel comforting from start to finish."],
];

export default function LymphaticBodyRoller() {
  return (
    <Layout>
      <Helmet>
        <title>What a Lymphatic Body Roller Session Does | Storm Wellness Club</title>
        <meta name="description" content="How the Lymphatic Body Roller with red light supports lymph flow, eases bloating and soreness, and helps skin look smoother. Now on presale at Storm Wellness Club in Livonia, MI." />
        <link rel="canonical" href="https://stormwellnessclub.com/journal/lymphatic-body-roller" />
      </Helmet>

      <article className="container mx-auto px-6 pt-32 pb-20 max-w-3xl">
        <p className="text-xs tracking-[0.35em] text-accent mb-4">THE JOURNAL</p>
        <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-6">What a Lymphatic Body Roller session does for your body</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Rows of warm, turned wood roll beneath you in a slow, steady wave, from the ankles upward, while red light glows softly underneath.
          This is the Lymphatic Body Roller, arriving at Storm Wellness Club this November. Here is what happens during a session.
        </p>

        <video src={loopVideo.url} poster={machine.url} autoPlay muted loop playsInline preload="metadata"
          aria-label="The Lymphatic Body Roller in motion" className="w-full aspect-video object-cover mb-14" />

        <div className="divide-y divide-border/60">
          {BENEFITS.map(([t, d], i) => (
            <section key={t} className="py-8 grid md:grid-cols-[4rem_1fr] gap-2">
              <span className="font-serif text-2xl text-accent">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="font-serif text-2xl mb-3">{t}</h2>
                <p className="text-muted-foreground leading-relaxed">{d}</p>
              </div>
            </section>
          ))}
        </div>

        <img src={legs.url} alt="A Lymphatic Body Roller session at Storm Wellness Club" className="w-full h-96 object-cover my-14" loading="lazy" />

        <h2 className="font-serif text-3xl mb-4">Getting the most from a session</h2>
        <p className="text-muted-foreground leading-relaxed mb-12">
          Drink water through the day, wear something light, and arrive a few minutes early. Afterward, keep drinking water and take a short walk to keep things moving.
          Most guests choose a 30-minute session as a reset and a 60-minute session for a full ritual. Results build with regular sessions.
        </p>

        <div className="border border-border/60 bg-card p-10 text-center">
          <p className="text-xs tracking-[0.3em] text-accent mb-3">PRESALE NOW OPEN</p>
          <h2 className="font-serif text-3xl mb-3">Reserve before it arrives</h2>
          <p className="text-muted-foreground mb-8">Presale pricing for members and non-members, held until launch. Sessions expire six months after purchase.</p>
          <Button variant="gold" size="lg" asChild><Link to="/body-roller-presale">Reserve presale pricing</Link></Button>
        </div>

        <p className="mt-10 text-xs text-muted-foreground leading-relaxed">
          This is general wellness information, not medical advice. If you are pregnant or have a medical condition, check with your doctor before booking.
        </p>
      </article>
    </Layout>
  );
}
