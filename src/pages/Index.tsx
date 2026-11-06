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
import marbleStair from "@/assets/interiors/marble-staircase.jpg";
import reformer from "@/assets/reformer-pilates-hero.jpg";
import cycling from "@/assets/cycling-studio-hero.jpg";
import gymFloor from "@/assets/gym-area-1.jpg";
import aerobics from "@/assets/aerobics-studio-hero.jpg";
import saltRoom from "@/assets/salt-room.jpg";
import steamRoom from "@/assets/wellness/steam-room.jpg";
import sauna from "@/assets/wellness/sauna-interior-wide.jpg";
import plunge from "@/assets/wellness/cold-plunge-premium.jpg";
import redLight from "@/assets/wellness/red-light-therapy.jpg";
import zeroBody from "@/assets/zerobody-float.jpeg";
import spaDoor from "@/assets/spa-hallway.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import matcha from "@/assets/food/matcha-latte.jpg";
import cafeTree from "@/assets/textures/cafe-tree.jpg";
import community from "@/assets/community-banner.png";
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
  { src: sauna, title: "Sauna", line: "Cedar and dry heat, under a ceiling of small lights." },
  { src: plunge, title: "Cold Plunge", line: "Held cold, on your terms." },
  { src: redLight, title: "Red Light", line: "Full-body red and near-infrared panels." },
  { src: zeroBody, title: "Starpool ZeroBody", line: "Warm, weightless and completely still." },
];

const lifeStrip = [
  { src: community, alt: "Members talking between reformers after class", cap: "After class" },
  { src: lockers, alt: "Oak lockers with brass details in the locker room", cap: "The locker room" },
  { src: cafeTree, alt: "Olive tree beside the café seating", cap: "The café" },
  { src: steamRoom, alt: "Steam rising in the gold mosaic steam room", cap: "Steam" },
  { src: aerobics, alt: "Arched windows and mats in the aerobics studio", cap: "The aerobics studio" },
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
                Storm Wellness Club was built so strength, rest and personal care could share one routine — one you keep, instead of one you keep restarting.
              </p>
              <div className="mt-10"><QuietLink to="/about">Our story</QuietLink></div>
            </Reveal>
          </div>
          <div className="md:col-span-5 md:col-start-8">
            <EdImage src={marbleStair} alt="Veined marble staircase inside the club" className="aspect-[3/4] md:aspect-[4/5]" />
            <Caption>The marble stair</Caption>
          </div>
        </div>
      </section>

      {/* 03 — MOVE (tighter rhythm) */}
      <section className="bg-background pb-24 md:pb-36">
        <div className="container mx-auto px-6 md:px-12">
          <Reveal><Chapter n="02" label="Move" /></Reveal>
          <div className="mt-10 grid md:grid-cols-12 gap-4 md:gap-6">
            <div className="md:col-span-8">
              <EdImage src={reformer} alt="A member working on a reformer in the Reformer Pilates studio" className="aspect-[4/5] md:aspect-[16/11]" />
              <Caption>Reformer Pilates — eight people, one instructor watching your form</Caption>
            </div>
            <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-6 content-start">
              <div>
                <EdImage src={cycling} alt="Rows of bikes beneath arched lights in the Cycle Studio" className="aspect-[4/5] md:aspect-[4/3]" />
                <Caption>Cycle Studio</Caption>
              </div>
              <div>
                <EdImage src={gymFloor} alt="The training floor with marble flooring and strength equipment" className="aspect-[4/5] md:aspect-[4/3]" />
                <Caption>The training floor</Caption>
              </div>
            </div>
          </div>
          <div className="mt-16 md:mt-20 grid md:grid-cols-12 gap-8 items-start">
            <Reveal className="md:col-span-6">
              <h2 className="ed-headline max-w-[16ch]">Get stronger with people who know what they’re doing.</h2>
            </Reveal>
            <Reveal delay={150} className="md:col-span-4 md:col-start-8">
              <p className="ed-body text-muted-foreground">Small classes, coached corrections and personal training that grows with you.</p>
              <div className="mt-8 flex flex-wrap gap-x-10 gap-y-5">
                <QuietLink to="/classes">Classes</QuietLink>
                <QuietLink to="/personal-training">Personal training</QuietLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 04 — RECOVER (slower, darker, more space) */}
      <section className="bg-primary text-primary-foreground">
        <EdImage src={saltRoom} alt="Glowing walls of hand-cut Himalayan salt in the salt room" className="h-[85svh] min-h-[480px] w-full bg-primary" />
        <div className="container mx-auto px-6 md:px-12 py-28 md:py-48">
          <Reveal><Chapter n="03" label="Recover" light /></Reveal>
          <Reveal delay={200}>
            <p className="ed-statement mt-12 max-w-[14ch]">Progress isn’t only what happens while you train.</p>
          </Reveal>
          <Reveal delay={400}>
            <p className="ed-body text-primary-foreground/70 mt-12 md:ml-[40%]">
              Training creates the stimulus. Recovery is where your body adapts. The salt room, sauna, steam and cold plunge come with every membership, with nothing to book.
            </p>
          </Reveal>
          <div className="mt-24 md:mt-36 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-20 md:gap-y-32">
            {recoverRooms.map((r, i) => (
              <div key={r.title} className={i % 2 === 1 ? "md:mt-40" : ""}>
                <EdImage src={r.src} alt={`${r.title} at Storm Wellness Club`} className="aspect-[4/5] bg-primary" />
                <div className="mt-6 flex items-baseline justify-between gap-6 border-t border-primary-foreground/15 pt-5">
                  <h3 className="font-serif text-2xl md:text-3xl font-light">{r.title}</h3>
                  <p className="text-sm text-primary-foreground/60 font-light text-right max-w-[24ch]">{r.line}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-20"><QuietLink to="/amenities" light>The recovery suite</QuietLink></div>
        </div>
      </section>

      {/* 05 — SPA AELLA (its own warmer, quieter layer) */}
      <section className="bg-secondary py-28 md:py-48">
        <div className="container mx-auto px-6 md:px-12 grid md:grid-cols-12 gap-14 md:gap-8 items-center">
          <div className="md:col-span-5 order-2 md:order-1">
            <Reveal><Chapter n="04" label="Spa Aella" /></Reveal>
            <Reveal delay={200}>
              <h2 className="ed-headline mt-10 max-w-[12ch] italic">Warm stone, low light, unhurried hands.</h2>
            </Reveal>
            <Reveal delay={350}>
              <p className="ed-body text-muted-foreground mt-10">
                Massage, facials and body treatments from therapists who notice what your body needs that day. Open to everyone — no membership required.
              </p>
              <div className="mt-10"><QuietLink to="/spa">Enter Spa Aella</QuietLink></div>
            </Reveal>
          </div>
          <div className="md:col-span-6 md:col-start-7 order-1 md:order-2 grid grid-cols-5 gap-4">
            <div className="col-span-3">
              <EdImage src={spaDoor} alt="An arched oak door leading into a Spa Aella treatment room" className="aspect-[3/5]" />
            </div>
            <div className="col-span-2 self-end">
              <EdImage src={spaShower} alt="Marble shower and soaking tub in the spa" className="aspect-[3/4]" />
              <Caption>Spa Aella</Caption>
            </div>
          </div>
        </div>
      </section>

      {/* 06 — NOURISH */}
      <section className="bg-background py-24 md:py-40">
        <div className="container mx-auto px-6 md:px-12 grid md:grid-cols-12 gap-12 md:gap-8 items-center">
          <div className="md:col-span-7">
            <EdImage src={matcha} alt="Matcha being poured over oat milk at the Storm Café" className="aspect-[4/5] md:aspect-[5/4]" />
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <Reveal><Chapter n="05" label="Nourish" /></Reveal>
            <Reveal delay={150}>
              <h2 className="ed-headline mt-10">Worth staying for.</h2>
              <p className="ed-body text-muted-foreground mt-8">Fresh juices, smoothies and made-to-order plates — before a class, after the sauna, or between meetings.</p>
              <div className="mt-10"><QuietLink to="/cafe">The café menu</QuietLink></div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 07 — LIFE INSIDE STORM WELLNESS */}
      <section className="bg-background pb-24 md:pb-40">
        <div className="container mx-auto px-6 md:px-12">
          <Reveal><Chapter n="06" label="Life inside Storm Wellness" /></Reveal>
        </div>
        <div className="mt-10 flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory px-6 md:px-12 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Photographs from inside the club">
          {lifeStrip.map((p) => (
            <figure key={p.cap} className="snap-start shrink-0 w-[78vw] sm:w-[48vw] md:w-[30vw]">
              <EdImage src={p.src} alt={p.alt} className="aspect-[4/5]" />
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
              Four tiers, one year, billed monthly. Members with children can add Kids Care, a supervised space of its own.
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
