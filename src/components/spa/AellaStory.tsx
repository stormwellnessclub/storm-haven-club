import { Reveal, EdImage } from "@/components/editorial/Editorial";
import treatmentRoom from "@/assets/treatment-room.jpg";
import spaHallway from "@/assets/spa-hallway.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import bodyTreatments from "@/assets/body-treatments.jpg";
import therapeuticMassage from "@/assets/therapeutic-massage.jpg";
import saltRoom from "@/assets/salt-room.jpg";
import steamRoom from "@/assets/wellness/steam-room-clean.jpg";
import saunaInterior from "@/assets/wellness/sauna-interior.jpg";

type Go = (category: string) => void;

function Eyebrow({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`ed-caption mb-6 ${light ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{children}</p>;
}

function TextLink({ onClick, children, light }: { onClick: () => void; children: React.ReactNode; light?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center gap-3 ed-caption pb-1 border-b transition-colors ${light ? "text-primary-foreground border-primary-foreground/40 hover:border-primary-foreground" : "text-foreground border-foreground/30 hover:border-foreground"}`}
    >
      {children}
      <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
    </button>
  );
}

export function AellaHero({ onExplore, onAvailability }: { onExplore: () => void; onAvailability: () => void }) {
  return (
    <section className="relative min-h-[100svh] flex items-end bg-charcoal">
      <img src={treatmentRoom} alt="A treatment room at Spa Aella" className="absolute inset-0 h-full w-full object-cover" loading="eager" />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/40 to-charcoal/10" />
      <div className="relative z-10 container mx-auto px-6 pb-20 pt-40 md:pb-28">
        <div className="max-w-3xl">
          <p className="ed-caption text-primary-foreground/70 mb-6">Spa Aella</p>
          <h2 className="ed-statement text-primary-foreground mb-8">The part of wellness you shouldn't have to earn.</h2>
          <p className="ed-body text-primary-foreground/85 max-w-xl mb-3">Massage. Skin. Body treatments. Recovery.</p>
          <p className="ed-body text-primary-foreground/75 max-w-xl mb-3">
            Spa Aella was created for the moments when your body needs something different from another workout — thoughtful care, intentional treatments, and time to let someone else take care of you for a while.
          </p>
          <p className="ed-body text-primary-foreground/75 max-w-xl mb-10">Open to members and non-members.</p>
          <div className="flex flex-wrap items-center gap-8">
            <button type="button" onClick={onExplore} className="bg-primary-foreground text-foreground px-8 py-4 ed-caption hover:bg-primary-foreground/90 transition-colors">
              Explore Treatments
            </button>
            <TextLink light onClick={onAvailability}>View Availability</TextLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AellaStory({ go }: { go: Go }) {
  return (
    <>
      {/* Experience */}
      <section className="py-28 md:py-40 bg-background">
        <div className="container mx-auto px-6 grid md:grid-cols-12 gap-12">
          <Reveal className="md:col-span-6">
            <h2 className="ed-headline">There is a difference between stopping and actually restoring.</h2>
          </Reveal>
          <Reveal className="md:col-span-5 md:col-start-8 space-y-5 ed-body text-muted-foreground" delay={150}>
            <p>Some days your body needs movement.</p>
            <p>Some days it needs hands-on care. Heat. Recovery. Exfoliation. Hydration. Quiet.</p>
            <p>Spa Aella brings those experiences together so taking care of yourself does not begin and end with how hard you can push.</p>
            <p className="text-foreground">Come in for what your body needs today.</p>
          </Reveal>
        </div>
      </section>

      {/* Discovery: four entrances */}
      <section id="aella-discover" className="pb-28 md:pb-40 bg-background scroll-mt-20">
        <div className="container mx-auto px-6">
          <Reveal>
            <Eyebrow>What do you need today?</Eyebrow>
            <h2 className="ed-headline max-w-3xl mb-20">Start with how you want to feel.</h2>
          </Reveal>

          {/* Massage — tall image left */}
          <div className="grid md:grid-cols-12 gap-10 items-end mb-24 md:mb-32">
            <EdImage src={therapeuticMassage} alt="Massage at Spa Aella" className="md:col-span-7 aspect-[4/5] md:aspect-[3/4]" />
            <Reveal className="md:col-span-4 md:col-start-9">
              <Eyebrow>Massage &amp; Bodywork</Eyebrow>
              <h3 className="ed-headline text-3xl md:text-4xl mb-6">I need to let go of tension.</h3>
              <p className="ed-body text-muted-foreground mb-4">For the days when your shoulders have crept upward, your body feels heavy, or everything simply feels like it has been held for too long.</p>
              <p className="ed-body text-muted-foreground mb-8">Our massage and bodywork experiences begin with how your body feels when you arrive — not with a one-size-fits-all idea of relaxation.</p>
              <TextLink onClick={() => go("Massage")}>Explore Massage</TextLink>
            </Reveal>
          </div>

          {/* Facials — text left, wide image right */}
          <div className="grid md:grid-cols-12 gap-10 items-center mb-24 md:mb-32">
            <Reveal className="md:col-span-4 order-2 md:order-1">
              <Eyebrow>Facials</Eyebrow>
              <h3 className="ed-headline text-3xl md:text-4xl mb-6">My skin needs attention.</h3>
              <p className="ed-body text-muted-foreground mb-4">Not a trend. Not another complicated routine.</p>
              <p className="ed-body text-muted-foreground mb-8">Thoughtful facial treatments selected around what your skin needs now — hydration, brightness, clarity, replenishment, texture support, and care.</p>
              <TextLink onClick={() => go("Facials")}>Explore Facials</TextLink>
            </Reveal>
            <EdImage src={spaHallway} alt="The corridor to the Spa Aella treatment rooms" className="md:col-span-7 md:col-start-6 aspect-[3/2] order-1 md:order-2" />
          </div>

          {/* Body — full width image, text beneath */}
          <div className="mb-24 md:mb-32">
            <EdImage src={bodyTreatments} alt="A body treatment at Spa Aella" className="aspect-[16/9] md:aspect-[21/9]" />
            <Reveal className="grid md:grid-cols-12 gap-10 mt-12">
              <div className="md:col-span-5">
                <Eyebrow>Body Treatments</Eyebrow>
                <h3 className="ed-headline text-3xl md:text-4xl">I want the full body treatment.</h3>
              </div>
              <div className="md:col-span-5 md:col-start-8">
                <p className="ed-body text-muted-foreground mb-4">This is where skincare stops at the neck.</p>
                <p className="ed-body text-muted-foreground mb-8">Exfoliation, mineral-rich clays, seaweed, professional body masks, wraps, shower rituals, and deep hydration come together in treatments designed for the skin across your entire body.</p>
                <TextLink onClick={() => go("Body Wraps")}>Explore Body Treatments</TextLink>
              </div>
            </Reveal>
          </div>

          {/* Recovery — dark band with paired images */}
          <div className="bg-charcoal text-primary-foreground -mx-6 px-6 py-20 md:py-28">
            <div className="grid md:grid-cols-12 gap-10 items-center">
              <div className="md:col-span-6 grid grid-cols-2 gap-4">
                <EdImage src={saunaInterior} alt="Sauna" className="aspect-[2/3]" />
                <EdImage src={saltRoom} alt="Salt room" className="aspect-[2/3] mt-12" />
              </div>
              <Reveal className="md:col-span-5 md:col-start-8">
                <Eyebrow light>Recovery</Eyebrow>
                <h3 className="ed-headline text-3xl md:text-4xl mb-6">I need to recover.</h3>
                <p className="ed-body text-primary-foreground/75 mb-4">Heat. Cold. Light. Compression. Stillness.</p>
                <p className="ed-body text-primary-foreground/75 mb-8">Recovery experiences designed to support the work your body is already doing — whether you trained today, have been carrying too much tension, or simply need time to reset.</p>
                <TextLink light onClick={() => go("Recovery")}>Explore Recovery</TextLink>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Pause — no CTA */}
      <section className="py-32 md:py-48 bg-secondary/40">
        <Reveal className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="ed-headline mb-10">Not everything you do for your body has to be work.</h2>
          <div className="ed-body text-muted-foreground space-y-2">
            <p>We believe effort and recovery belong in the same conversation.</p>
            <p>So do strength and softness. Performance and care.</p>
            <p className="pt-6">The goal is not to escape your life for an hour. It is to return to it feeling different inside your own body.</p>
          </div>
        </Reveal>
      </section>

      {/* Signature */}
      <section className="py-28 md:py-40 bg-background">
        <div className="container mx-auto px-6 grid md:grid-cols-12 gap-12 items-center">
          <EdImage src={spaShower} alt="The shower in a Spa Aella body treatment room" className="md:col-span-6 aspect-[4/5]" />
          <Reveal className="md:col-span-5 md:col-start-8">
            <Eyebrow>Signature Experiences</Eyebrow>
            <h2 className="ed-headline text-3xl md:text-4xl mb-12">Come for the treatment. Remember the ritual.</h2>
            <h3 className="ed-caption text-foreground mb-4">Seaweed Body Ritual</h3>
            <div className="ed-body text-muted-foreground space-y-4 mb-6">
              <p>A head-to-toe body treatment built around marine botanicals, skin preparation, warmth, hydration, and rest.</p>
              <p>The ritual begins by preparing the skin through exfoliation before the body is enveloped in a mineral-rich seaweed treatment and left to rest. While the body is wrapped, attention shifts upward with facial and lymphatic-focused touch.</p>
              <p>After showering, the treatment finishes with deeply hydrating body care and massage.</p>
              <p>For skin that feels dry, dull, depleted, or simply overdue for more attention than a traditional massage provides.</p>
            </div>
            <p className="ed-caption text-muted-foreground mb-8">70 or 90 minutes</p>
            <TextLink onClick={() => go("Body Wraps")}>Explore the Ritual</TextLink>
          </Reveal>
        </div>
      </section>

      {/* The Aella experience */}
      <section className="py-28 md:py-40 bg-charcoal text-primary-foreground">
        <div className="container mx-auto px-6">
          <Reveal className="max-w-3xl mb-16">
            <h2 className="ed-headline">Your appointment should feel like it started before the treatment did.</h2>
          </Reveal>
          <div className="grid grid-cols-12 gap-4 mb-16">
            <EdImage src={steamRoom} alt="Steam room" className="col-span-12 md:col-span-7 aspect-[3/2]" />
            <EdImage src={treatmentRoom} alt="Treatment room" className="col-span-6 md:col-span-5 aspect-[3/4] md:aspect-auto" />
            <EdImage src={spaHallway} alt="Spa corridor" className="col-span-6 md:hidden aspect-[3/4]" />
          </div>
          <Reveal className="grid md:grid-cols-12 gap-10">
            <div className="md:col-span-5 ed-body text-primary-foreground/75 space-y-1">
              <p>The details matter.</p>
              <p>The room. The light. The temperature.</p>
              <p>The products touching your skin.</p>
              <p>The way you're greeted.</p>
              <p>The transition from one part of the treatment to another.</p>
              <p>The moment you realize there is nowhere else you need to be.</p>
            </div>
            <p className="md:col-span-5 md:col-start-8 ed-body text-primary-foreground/75">
              Spa Aella was designed around the complete experience — not simply the minutes listed beside the appointment.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Public access */}
      <section className="py-28 md:py-36 bg-background">
        <Reveal className="container mx-auto px-6 max-w-2xl">
          <Eyebrow>Open to the public</Eyebrow>
          <h2 className="ed-headline mb-8">Aella is open to you.</h2>
          <p className="ed-body text-muted-foreground mb-4">You do not need a Storm Wellness Club membership to book Spa Aella.</p>
          <p className="ed-body text-muted-foreground mb-8">Massage, facials, body treatments, and eligible recovery experiences are available to both members and non-members.</p>
          <p className="ed-body text-foreground mb-10">Choose what you need. Find your time. Come in.</p>
          <TextLink onClick={() => go("All")}>View Available Appointments</TextLink>
        </Reveal>
      </section>

      {/* Menu intro */}
      <section className="pt-12 pb-4 bg-background border-t border-border">
        <div className="container mx-auto px-6">
          <Eyebrow>The Aella Menu</Eyebrow>
          <h2 className="ed-headline text-3xl md:text-4xl mb-4">Choose what your body needs today.</h2>
          <p className="ed-body text-muted-foreground max-w-xl">Not sure where to begin? Start with what you're feeling — not what you think you're supposed to book.</p>
        </div>
      </section>
    </>
  );
}
