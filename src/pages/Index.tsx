import { useMemo } from "react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { Share, Plus } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SmsSignupSection } from "@/components/home/SmsSignupSection";
import { usePublicClassReviews } from "@/hooks/usePublicClassReviews";
import { useSpaReviewsList } from "@/hooks/useSpaReviews";
import { Reveal, EdImage, Chapter, Caption, QuietLink } from "@/components/editorial/Editorial";

// Real club photography only.
import lobbyHero from "@/assets/lobby-hero.jpeg";
import marbleStair from "@/assets/interiors/marble-staircase-clean.jpg";
import reformer from "@/assets/reformer-pilates-hero.jpg";
import cycling from "@/assets/cycling-studio-hero.jpg";
import gymFloor from "@/assets/gym-area-1.jpg";
import aerobics from "@/assets/aerobics-studio-hero.jpg";
import saltRoom from "@/assets/salt-room.jpg";
import steamRoom from "@/assets/wellness/steam-room-clean.jpg";
import sauna from "@/assets/wellness/sauna-interior-wide.jpg";
import plunge from "@/assets/wellness/cold-plunge-premium.jpg";
import redLight from "@/assets/wellness/red-light-therapy.jpg";
import zeroBody from "@/assets/zerobody-float.jpeg";
import spaDoor from "@/assets/spa-hallway.jpg";
import treatmentRoom from "@/assets/treatment-room.jpg";
import showers from "@/assets/locker-room.jpg";
import matcha from "@/assets/food/matcha-latte.jpg";
import smoothie from "@/assets/cafe/smoothie-orange-creamsicle.jpg";
import gymFloor2 from "@/assets/gym-area-2.jpg";
import lockers from "@/assets/interiors/wooden-lockers-gold.jpg";

/** One real, recent, written member review, set large. Never rewritten. */
function MemberVoice() {
  const { data: classReviews = [] } = usePublicClassReviews();
  const { data: spaReviews = [] } = useSpaReviewsList(null);
  const pick = useMemo(() => {
    const all = [
      ...classReviews.map((r) => ({ text: (r.review_text || "").trim(), name: r.reviewer_name, what: r.class_type_name || "Class", rating: r.rating, date: r.created_at })),
      ...spaReviews.map((r) => ({ text: (r.review_text || "").trim(), name: r.reviewer_name, what: r.service_name || "Spa Aella", rating: r.rating, date: r.created_at })),
    ].filter((r) => r.rating >= 5 && r.text.length >= 60 && r.text.length <= 240);
    return all.sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [classReviews, spaReviews]);
  if (!pick) return null;
  return (
    <Reveal className="max-w-4xl">
      <blockquote className="ed-quote">“{pick.text}”</blockquote>
      <p className="ed-caption text-muted-foreground mt-8">{pick.name} — {pick.what}</p>
      <div className="mt-6"><QuietLink to="/reviews">Read member reviews</QuietLink></div>
    </Reveal>
  );
}

const recoverRooms = [
  { src: plunge, title: "Cold Plunge" },
  { src: sauna, title: "Sauna" },
  { src: zeroBody, title: "Starpool ZeroBody" },
  { src: redLight, title: "Red Light" },
];

const lifeStrip = [
  { src: gymFloor2, alt: "Strength equipment on the marble training floor", cap: "The Training Floor", shape: "wide" },
  { src: steamRoom, alt: "Steam rising in the gold mosaic steam room", cap: "Steam Room", shape: "tall" },
  { src: aerobics, alt: "Arched windows and mats in the aerobics studio", cap: "Aerobics Studio", shape: "wide" },
  { src: lockers, alt: "Oak lockers with brass details in the locker room", cap: "Locker Room", shape: "tall" },
  { src: showers, alt: "Marble showers and soaking tub", cap: "Showers", shape: "wide" },
  { src: matcha, alt: "Matcha poured over oat milk at the Storm Café", cap: "Storm Café", shape: "tall" },
];

export default function Index() {
  const { isIOS, showIOSModal, closeIOSModal } = usePWAInstall();

  return <Layout>
      <SEOHead title="Wellness Club in Livonia, MI" description="A wellness club in Livonia, MI where training, recovery, Spa Aella, the café and kids care fit into one routine you can keep." path="/" />

      {/* 01 — ARRIVAL */}
      <section className="relative h-[100svh] min-h-[560px] overflow-hidden bg-primary">
        <EdImage eager src={lobbyHero} alt="The Storm Wellness Club lobby in Livonia, Michigan: arched doorway, marble and warm light" className="absolute inset-0 bg-primary" imgClassName="opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/10 to-transparent" />
        <div className="relative z-10 h-full container mx-auto px-6 md:px-12 flex flex-col justify-end pb-14 md:pb-20">
          <h1 className="sr-only">Storm Wellness Club · Wellness Club &amp; Fitness Center in Livonia, MI</h1>
          <Reveal>
            <p className="ed-statement text-primary-foreground max-w-[12ch]">
              Taking care of yourself, <span className="italic">built in.</span>
            </p>
          </Reveal>
          <Reveal delay={400} className="mt-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-12">
            <QuietLink to="/memberships#tiers" light>Explore Memberships</QuietLink>
            <p className="ed-caption text-primary-foreground/60">Livonia, Michigan</p>
          </Reveal>
        </div>
      </section>

      {/* 02 — THE IDEA */}
      <section className="bg-background py-28 md:py-44">
        <div className="container mx-auto px-6 md:px-12 grid md:grid-cols-12 gap-14 md:gap-8 items-end">
          <div className="md:col-span-6 md:col-start-1">
            <Reveal><Chapter n="01" label="The Idea" /></Reveal>
            <Reveal delay={150}>
              <h2 className="ed-headline mt-10 max-w-[14ch]">Training, recovery and care no longer live in separate places.</h2>
            </Reveal>
            <Reveal delay={300}>
              <p className="ed-body text-muted-foreground mt-10">
                One routine for strength, rest and care. The kind you keep.
              </p>
              <div className="mt-10"><QuietLink to="/about">Our story</QuietLink></div>
            </Reveal>
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <EdImage src={marbleStair} alt="Veined marble staircase inside the club" className="aspect-[4/5] md:aspect-[2/3]" />
          </div>
        </div>
      </section>

      {/* 03 — MOVE (tighter rhythm) */}
      <section className="bg-background pb-24 md:pb-36">
        <div className="container mx-auto px-6 md:px-12">
          <Reveal><Chapter n="02" label="Move" /></Reveal>
          <div className="mt-12 grid gap-4 md:gap-6 md:grid-cols-[8fr_9fr]">
            <EdImage src={reformer} alt="A member working on a reformer in the Reformer Pilates studio" className="aspect-[4/5] md:aspect-[2/3]" imgClassName="object-[50%_35%]" />
            <div className="grid gap-4 md:gap-6 md:grid-rows-2">
              <EdImage src={cycling} alt="Rows of bikes beneath arched lights in the Cycle Studio" className="aspect-[3/2] md:aspect-auto md:h-full" />
              <EdImage src={gymFloor} alt="The training floor with marble flooring and strength equipment" className="aspect-[3/2] md:aspect-auto md:h-full" />
            </div>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-10 gap-y-5">
            <QuietLink to="/classes">Classes</QuietLink>
            <QuietLink to="/personal-training">Personal training</QuietLink>
          </div>
        </div>
      </section>

      {/* 04 — RECOVER (slower, darker, more space) */}
      <section className="bg-primary text-primary-foreground">
        <EdImage src={saltRoom} alt="Glowing walls of hand-cut Himalayan salt in the salt room" className="h-[85svh] min-h-[480px] w-full bg-primary" />
        <div className="container mx-auto px-6 md:px-12 py-28 md:py-48">
          <Reveal><Chapter n="03" label="Recover" light /></Reveal>
          <div className="mt-16 md:mt-24 space-y-16 md:space-y-24">
            <div className="grid gap-16 md:gap-6 md:grid-cols-[4fr_9fr]">
              {recoverRooms.slice(0, 2).map((r, i) => (
                <figure key={r.title}>
                  <EdImage src={r.src} alt={`${r.title} at Storm Wellness Club`} className={i === 0 ? "aspect-[4/5] md:aspect-[2/3] bg-primary" : "aspect-[3/2] bg-primary"} />
                  <figcaption className="mt-5 border-t border-primary-foreground/15 pt-4 font-serif text-2xl md:text-3xl font-light">{r.title}</figcaption>
                </figure>
              ))}
            </div>
            <div className="grid gap-16 md:gap-6 md:grid-cols-2">
              {recoverRooms.slice(2).map((r) => (
                <figure key={r.title}>
                  <EdImage src={r.src} alt={`${r.title} at Storm Wellness Club`} className="aspect-[3/2] bg-primary" />
                  <figcaption className="mt-5 border-t border-primary-foreground/15 pt-4 font-serif text-2xl md:text-3xl font-light">{r.title}</figcaption>
                </figure>
              ))}
            </div>
          </div>
          <div className="mt-16 md:mt-24"><QuietLink to="/amenities" light>The recovery suite</QuietLink></div>
        </div>
      </section>

      {/* 05 — SPA AELLA (its own warmer, quieter layer) */}
      <section className="bg-secondary py-28 md:py-48">
        <div className="container mx-auto px-6 md:px-12 grid md:grid-cols-12 gap-12 md:gap-6 items-end">
          <div className="md:col-span-4 order-2 md:order-1">
            <Reveal><Chapter n="04" label="Spa Aella" /></Reveal>
            <Reveal delay={200}>
              <div className="mt-10"><QuietLink to="/spa">Visit Spa Aella</QuietLink></div>
            </Reveal>
          </div>
          <div className="md:col-span-7 md:col-start-6 order-1 md:order-2 grid grid-cols-[3fr_2fr] gap-4 md:gap-6 items-end">
            <EdImage src={spaDoor} alt="An arched oak door leading into a Spa Aella treatment room" className="aspect-[2/3]" />
            <EdImage src={treatmentRoom} alt="A Spa Aella treatment room with a glowing salt wall" className="aspect-[2/3]" />
          </div>
        </div>
      </section>

      {/* 06 — NOURISH */}
      <section className="bg-background py-24 md:py-40">
        <div className="container mx-auto px-6 md:px-12 grid md:grid-cols-12 gap-12 md:gap-6 items-end">
          <div className="md:col-span-5">
            <EdImage src={smoothie} alt="A Storm Café smoothie on marble" className="aspect-[4/5]" />
          </div>
          <div className="md:col-span-4 md:col-start-7">
            <Reveal><Chapter n="05" label="Storm Café" /></Reveal>
            <Reveal delay={150}>
              <div className="mt-10"><QuietLink to="/cafe">The café menu</QuietLink></div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 07 — LIFE INSIDE STORM WELLNESS */}
      <section className="bg-background pb-24 md:pb-40">
        <div className="container mx-auto px-6 md:px-12">
          <Reveal><Chapter n="06" label="Life at Storm" /></Reveal>
        </div>
        <div className="mt-10 flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory px-6 md:px-12 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Photographs from inside the club">
          {lifeStrip.map((p) => (
            <figure key={p.cap} className="snap-start shrink-0">
              <EdImage src={p.src} alt={p.alt} className={`h-[52svh] max-h-[440px] min-h-[300px] ${p.shape === "tall" ? "aspect-[2/3]" : "aspect-[3/2]"}`} />
              <figcaption><Caption>{p.cap}</Caption></figcaption>
            </figure>
          ))}
        </div>
        <div className="container mx-auto px-6 md:px-12 mt-24 md:mt-36">
          <MemberVoice />
        </div>
      </section>

      {/* 08 — MEMBERSHIP */}
      <section className="bg-primary text-primary-foreground py-28 md:py-44 border-t border-primary-foreground/10">
        <div className="container mx-auto px-6 md:px-12 grid md:grid-cols-12 gap-12 md:gap-8 items-end">
          <div className="md:col-span-8">
            <Reveal><Chapter n="07" label="Membership" light /></Reveal>
            <Reveal delay={200}>
              <p className="ed-statement mt-12 max-w-[13ch]">Somewhere you actually want to be.</p>
            </Reveal>
          </div>
          <Reveal delay={350} className="md:col-span-4">
            <p className="ed-body text-primary-foreground/70">
              Four tiers. Kids Care for the youngest members of the household.
            </p>
            <div className="mt-10 flex flex-col gap-6 items-start">
              <QuietLink to="/memberships#tiers" light>Explore Memberships</QuietLink>
              <QuietLink to="/kids-care" light>Kids Care</QuietLink>
            </div>
          </Reveal>
        </div>
      </section>

      <SmsSignupSection />

      {/* iOS Install Instructions Modal */}
      <Dialog open={showIOSModal} onOpenChange={closeIOSModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Install Storm Wellness App</DialogTitle>
            <DialogDescription className="text-center">
              Add this app to your home screen for the best experience
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {isIOS ? (
              <>
                <div className="flex items-start gap-4 p-3 bg-secondary/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-accent">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Tap the Share button</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Look for <Share className="inline h-3 w-3" /> at the bottom of your screen
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-3 bg-secondary/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-accent">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Select "Add to Home Screen"</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scroll down and tap <Plus className="inline h-3 w-3" /> Add to Home Screen
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-3 bg-secondary/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-accent">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Tap "Add"</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Confirm by tapping Add in the top right corner
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm">
                  To install this app, open this page in Chrome or Safari on your mobile device, 
                  then follow the browser's install prompt.
                </p>
              </div>
            )}
          </div>
          
          <Button variant="outline" onClick={closeIOSModal} className="w-full">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </Layout>;
}
