import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { AnimatedSection, StaggerContainer } from "@/components/AnimatedSection";
import { ArrowRight, Sparkles, CircleDot, Bike, Activity, Bath, Droplets, Wind, Coffee, Baby, Flame, Sun, Snowflake, Download, Share, Plus, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import gymArea1 from "@/assets/gym-area-1.jpg";
import lobbyHero from "@/assets/lobby-hero.jpeg";
import treatmentRoom from "@/assets/treatment-room.jpg";
import reformerPilates from "@/assets/reformer-pilates-hero.jpg";
import cycling from "@/assets/cycling-studio-hero.jpg";
import aerobicsStudio from "@/assets/aerobics-studio-hero.jpg";
import communityBanner from "@/assets/community-banner.png";
import stormLogoDark from "@/assets/storm-logo-dark.png";
import therapeuticMassage from "@/assets/therapeutic-massage.jpg";
import bodyTreatments from "@/assets/body-treatments.jpg";
import sauna from "@/assets/sauna.jpg";
import saunaBlue from "@/assets/sauna-blue.jpeg";
import saltRoom from "@/assets/salt-room.jpg";
import zerobodyFloat from "@/assets/zerobody-float.jpeg";
import { SmsSignupSection } from "@/components/home/SmsSignupSection";

// Brand imagery
import mainLobby from "@/assets/main-lobby.jpeg";
import avocadoToast from "@/assets/food/avocado-toast.jpg";
import cafeHeroImage from "@/assets/food/matcha-latte.jpg";

const classStudios = [{
  icon: CircleDot,
  title: "Reformer Pilates",
  description: "Precision movement on state-of-the-art reformers. Heated and non-heated sessions for all levels. Small class sizes — 8 members maximum.",
  image: reformerPilates,
  isHeated: false,
  color: "text-foreground",
  bgColor: "bg-secondary/30"
}, {
  icon: Bike,
  title: "Cycling Studio",
  description: "Immersive rides in a studio built for energy. Dynamic lighting, Technogym bikes, instructor-driven intensity. 10 riders maximum per session.",
  image: cycling,
  isHeated: true,
  badgeText: "Cycling",
  color: "text-foreground",
  bgColor: "bg-secondary/30"
}, {
  icon: Activity,
  title: "Aerobics Room",
  description: "Yoga, HIIT, Barre, Bootcamp, Sculpt and more — in a mixed heated and non-heated studio built for variety. Whatever you need that day, there's a class designed around it.",
  image: aerobicsStudio,
  isHeated: true,
  badgeText: "AEROBICS",
  color: "text-foreground",
  bgColor: "bg-secondary/30"
}];

const quickLinks = [{
  href: "/classes",
  icon: Activity,
  label: "View Classes",
  description: "Explore our full schedule"
}, {
  href: "/spa",
  icon: Sparkles,
  label: "Book Aella Spa",
  description: "Open to all, no membership"
}, {
  href: "/cafe",
  icon: Coffee,
  label: "Café Menu",
  description: "Fresh & healthy options"
}, {
  href: "/amenities",
  icon: Bath,
  label: "Amenities",
  description: "Member facilities"
}];

const recoverySuiteAmenities = [
  { icon: Flame, label: "Infrared Sauna", description: "" },
  { icon: Wind, label: "Steam Room", description: "" },
  { icon: Droplets, label: "Cold Plunge Pool", description: "" },
  { icon: Sparkles, label: "Himalayan Salt Room", description: "Floor-to-ceiling Himalayan salt walls with an active halogenerator dispersing pharmaceutical-grade salt microparticles into the air. Used clinically for respiratory health, skin conditions, and immune support. No appointment needed — included in every membership." },
  { icon: Sun, label: "Red Light Therapy", description: "Precision wavelengths that reduce inflammation, accelerate recovery, and restore skin at the cellular level." },
  { icon: Snowflake, label: "Starpool ZeroBody Cryo", description: "Dry floatation in complete weightlessness. The nervous system resets. The mind follows." },
];

const lifestyleAmenities = [
  { icon: Bath, label: "Luxury Locker Rooms" },
  { icon: Sparkles, label: "Relaxation Lounge" },
  { icon: Coffee, label: "Café Access" },
  { icon: Baby, label: "Kids Care" },
];
export default function Index() {
  const { isIOS, isStandalone, showIOSModal, handleInstall, closeIOSModal } = usePWAInstall();

  return <Layout>
      <SEOHead title="Wellness Club in Livonia, MI" description="Storm Wellness Club is Livonia's premier wellness club & fitness center — Reformer Pilates, cycling, recovery spa, sauna, café, kids care & family memberships." path="/" />




      {/* Hero Section */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden bg-primary">
        <div className="absolute inset-0">
          <img 
            src={lobbyHero} 
            alt="Storm Wellness Club lobby interior in Livonia, Michigan — entry to fitness studios, recovery spa, and café" 
            className="w-full h-full object-cover object-center opacity-60"
            width={1920}
            height={1080}
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal/20 via-charcoal/35 to-charcoal/55" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4 sm:px-6 text-center py-20 sm:py-0">
          <h1 className="text-primary-foreground/90 text-xs sm:text-sm uppercase tracking-[0.25em] mb-4 sm:mb-6 animate-fade-up opacity-0 stagger-1">
            Wellness Club &amp; Fitness Center in Livonia, MI
          </h1>
          <h2 className="heading-display text-primary-foreground mb-4 sm:mb-6 animate-fade-up opacity-0 stagger-2 text-3xl sm:text-4xl md:text-5xl lg:text-6xl">

            This is what it feels like
            <br />
            <span>to finally </span><span className="text-accent">arrive.</span>
          </h2>
          <p className="text-primary-foreground/80 text-base sm:text-lg max-w-xl mx-auto mb-8 sm:mb-10 animate-fade-up opacity-0 stagger-3 px-4 sm:px-0">
            A private wellness club designed for people who take every detail of their life seriously.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center animate-fade-up opacity-0 stagger-4 px-4 sm:px-0">
            <Link to="/memberships" className="w-full sm:w-auto">
              <Button variant="hero" size="lg" className="w-full sm:w-auto">
                Explore Memberships
              </Button>
            </Link>
          </div>
        </div>

        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden sm:block">
          <div className="w-6 h-10 border-2 border-primary-foreground/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-primary-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container mx-auto px-6">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4 [grid-auto-rows:1fr]" staggerDelay={75}>
            {quickLinks.map(link => (
              <Link key={link.href} to={link.href} className="card-luxury p-4 h-full flex items-center gap-4 hover:border-accent transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
                <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <link.icon className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">{link.label}</p>
                  <p className="text-muted-foreground text-xs">{link.description}</p>
                </div>
              </Link>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Class Studios Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading title="Where you train matters as much as how you train." subtitle="Three purpose-built studios. Each one designed to feel as intentional as the rest of this space." />
          
          <StaggerContainer className="grid md:grid-cols-3 gap-8 [grid-auto-rows:1fr]" staggerDelay={150}>
            {classStudios.map((studio, index) => (
              <div key={index} className="card-luxury overflow-hidden group hover-lift h-full flex flex-col">
                <div className="relative h-64 overflow-hidden">
                  <img 
                    src={studio.image} 
                    alt={studio.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-hero opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
                  <div className="absolute top-4 right-4 flex gap-2">
                    {studio.isHeated ? (
                      <span className="flex items-center gap-1 px-3 py-1 text-accent-foreground text-xs uppercase tracking-wider bg-secondary">
                        {studio.badgeText || "Heated Options"}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1 text-secondary-foreground text-xs uppercase tracking-wider bg-secondary">
                        Reformer Pilates
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full ${studio.bgColor} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                      <studio.icon className={`w-5 h-5 ${studio.color}`} />
                    </div>
                    <h3 className="font-serif text-xl group-hover:text-muted-foreground transition-colors duration-300">{studio.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3 min-h-[3rem]">{studio.description}</p>
                  <Link to="/classes" className="text-accent text-sm font-medium hover:underline inline-flex items-center gap-1 group/link mt-auto">
                    View Classes 
                    <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover/link:translate-x-1" />
                  </Link>
                </div>
              </div>
            ))}
          </StaggerContainer>

          <AnimatedSection className="mt-16" delay={300}>
            <img 
              src={communityBanner} 
              alt="Storm Wellness Club members training together inside our Livonia fitness studio" 
              className="w-full rounded-sm" 
              loading="lazy"
            />
          </AnimatedSection>

          <AnimatedSection className="text-center mt-12" delay={400}>
            <Link to="/classes">
              <Button variant="outline" size="lg" className="group">
                View Full Schedule <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* Membership Benefits / Recovery */}
      <section className="relative py-24 bg-primary text-primary-foreground overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <AnimatedSection animation="fade-right">
              <img src={saunaBlue} alt="Dry heat sauna with blue star-point ceiling lighting" className="rounded-sm shadow-2xl" loading="lazy" />
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={150}>
              <p className="text-accent text-sm uppercase tracking-widest mb-4">Members Only</p>
              <h2 className="heading-section text-primary-foreground mb-6">
                Recovery is not optional here. It's built in.
              </h2>
              <p className="text-primary-foreground/80 mb-8 leading-relaxed">
                Every membership includes full access to our recovery suite — no booking required, no extra cost. The Himalayan salt room, dry heat sauna, steam room, and cold plunge are yours every time you walk in. This is where the real work happens.
              </p>
              
              {/* Recovery Suite */}
              <div className="mb-6">
                <p className="text-accent text-xs uppercase tracking-widest mb-3 font-medium">Recovery Suite</p>
                <div className="space-y-3">
                  {recoverySuiteAmenities.map((amenity) => (
                    <div 
                      key={amenity.label} 
                      className="transition-all duration-300 hover:translate-x-1"
                    >
                      <div className="flex items-center gap-2 text-sm text-primary-foreground/90 hover:text-primary-foreground">
                        <amenity.icon className="w-4 h-4 text-accent" />
                        <span>{amenity.label}</span>
                      </div>
                      {amenity.description && (
                        <p className="text-primary-foreground/60 text-xs ml-6 mt-0.5 leading-relaxed">{amenity.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lifestyle & Comfort */}
              <div className="mb-10">
                <p className="text-accent text-xs uppercase tracking-widest mb-3 font-medium">Lifestyle & Comfort</p>
                <div className="grid grid-cols-2 gap-3">
                  {lifestyleAmenities.map((amenity) => (
                    <div 
                      key={amenity.label} 
                      className="flex items-center gap-2 text-sm text-primary-foreground/90 transition-all duration-300 hover:text-primary-foreground hover:translate-x-1"
                    >
                      <amenity.icon className="w-4 h-4 text-accent" />
                      <span>{amenity.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Himalayan Salt Room Banner */}
          <AnimatedSection className="mt-16" animation="fade-up">
            <div className="relative w-full rounded-sm overflow-hidden" style={{ height: '500px' }}>
              <img src={saltRoom} alt="Himalayan Salt Room" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-charcoal/40" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <p className="text-primary-foreground/90 text-xs uppercase tracking-[0.25em] mb-4">Himalayan Salt Room · Active Halotherapy</p>
                <h3 className="font-serif text-2xl md:text-3xl text-primary-foreground">Step inside. Everything outside stays there.</h3>
              </div>
            </div>
          </AnimatedSection>

          {/* Buttons */}
          <AnimatedSection className="mt-12 flex flex-col sm:flex-row gap-4 justify-center" delay={200}>
            <Link to="/apply">
              <Button variant="gold" size="lg" className="group">
                Apply for Membership
              </Button>
            </Link>
            <Link to="/amenities">
              <Button variant="hero-outline" size="lg" className="group">
                View All Amenities <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </AnimatedSection>

          {/* ZeroBody Float Image */}
          <AnimatedSection className="mt-16" animation="fade-up" delay={100}>
            <div className="relative w-full rounded-sm overflow-hidden" style={{ height: '600px' }}>
              <img src={zerobodyFloat} alt="ZeroBody dry floatation experience" className="w-full h-full object-cover" loading="lazy" />
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* SMS lead capture */}
      <SmsSignupSection />

      {/* Philosophy - Why We Exist */}
      <section className="relative py-32 bg-background text-foreground overflow-hidden">
        <AnimatedSection className="container mx-auto px-6 text-center" animation="scale-in">
          <div className="max-w-3xl mx-auto">
            <p className="text-accent text-sm uppercase tracking-widest mb-6">Why We Exist</p>
            <h2 className="heading-section mb-12">
              We built the thing that didn't exist.
            </h2>
            <div className="text-muted-foreground text-lg leading-relaxed space-y-6">
              <p>
                Wellness became a word that lost its meaning. A trend. A product. An aesthetic.
              </p>
              <p>
                Storm Wellness Club exists because of what wellness actually is — and what it has always deserved to be.
              </p>
              <p className="my-10 text-foreground font-serif text-xl italic">
                A ritual. A right.
              </p>
              <p>
                Not a reward for the disciplined few, but a daily practice available to anyone willing to show up for themselves.
              </p>
              <p>
                This space was built by someone who lived through both extremes. Who understood from the inside what it means to neglect yourself — and what it means to finally stop. Who saw that the offerings that truly support human wellbeing were scarce, fragmented, or made to feel inaccessible.
              </p>
              <p className="my-10 text-foreground font-serif text-xl italic">
                So we built the thing that didn't exist.
              </p>
              <p>
                A place where training and recovery and restoration live together — not as separate expenses or separate trips or separate disciplines, but as one seamless ritual you return to because it genuinely makes you feel like yourself again.
              </p>
              <p>
                You are allowed to take care of yourself. Fully. Intentionally. Without apology.
              </p>
              <p>
                That is what Storm Wellness Club was built to say. Every corner of it. Every day.
              </p>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Aella Spa Section */}
      <section className="relative py-24 bg-secondary/30 overflow-hidden">
        <div className="container mx-auto px-6">
          <AnimatedSection className="text-center mb-12">
            {/* Aella logo removed */}
            <h2 className="heading-section mb-4">
              A Sanctuary for Renewal & Restoration
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Open to all—no membership required. Our holistic approach encompasses a wide range of 
              treatments designed to support every step of your wellness journey.
            </p>
          </AnimatedSection>

          {/* Services with Images */}
          <StaggerContainer className="grid md:grid-cols-3 gap-6 mb-12" staggerDelay={150}>
            <Link to="/spa?category=Facials" className="group relative rounded-sm overflow-hidden h-72 block hover-lift">
              <img src={treatmentRoom} alt="Signature Facials" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent group-hover:from-charcoal/70 transition-all duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between transform group-hover:translate-y-0 transition-transform duration-300">
                <h3 className="font-serif text-xl text-primary-foreground">Signature Facials</h3>
                <span className="text-primary-foreground/90 text-sm font-medium border border-primary-foreground/30 px-3 py-1 rounded-sm group-hover:bg-primary-foreground/20 transition-all duration-300">Explore</span>
              </div>
            </Link>
            <Link to="/spa?category=Massage" className="group relative rounded-sm overflow-hidden h-72 block hover-lift">
              <img src={therapeuticMassage} alt="Therapeutic Massage" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent group-hover:from-charcoal/70 transition-all duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                <h3 className="font-serif text-xl text-primary-foreground">Therapeutic Massage</h3>
                <span className="text-primary-foreground/90 text-sm font-medium border border-primary-foreground/30 px-3 py-1 rounded-sm group-hover:bg-primary-foreground/20 transition-all duration-300">Explore</span>
              </div>
            </Link>
            <Link to="/spa?category=Body Wraps" className="group relative rounded-sm overflow-hidden h-72 block hover-lift">
              <img src={bodyTreatments} alt="Body Treatments" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent group-hover:from-charcoal/70 transition-all duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                <h3 className="font-serif text-xl text-primary-foreground">Body Treatments</h3>
                <span className="text-primary-foreground/90 text-sm font-medium border border-primary-foreground/30 px-3 py-1 rounded-sm group-hover:bg-primary-foreground/20 transition-all duration-300">Explore</span>
              </div>
            </Link>
          </StaggerContainer>

          <AnimatedSection className="text-center" delay={300}>
            <Link to="/spa">
              <Button variant="gold" size="lg" className="group">
                Explore Aella <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      <section className="relative py-24 bg-background overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <AnimatedSection animation="fade-right">
              <div className="relative h-96 rounded-sm overflow-hidden group">
                <img src={avocadoToast} alt="Fresh, healthy cuisine at Storm Café" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
              </div>
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={150}>
              <p className="text-accent text-sm uppercase tracking-widest mb-4">The Storm Café</p>
              <h2 className="heading-section mb-6">Nourish From Within</h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Support your wellness journey with our curated menu of fresh juices, smoothies, 
                and health-forward cuisine designed to fuel your transformation.
              </p>
              <Link to="/cafe">
                <Button variant="outline" size="lg" className="group">
                  View Menu & Order <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Kids Care */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-6">
          <AnimatedSection className="max-w-3xl mx-auto text-center">
            <p className="text-muted-foreground text-sm uppercase tracking-widest mb-4">For Families</p>
            <h2 className="heading-section mb-6">Storm Kids Care</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Prioritize your health while your little ones enjoy supervised care in our 
              dedicated space. Available to members with a Kids Care add-on.
            </p>
            <Link to="/kids-care">
              <Button variant="outline" size="lg" className="group">
                Learn More <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-charcoal relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img src={gymArea1} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
        <AnimatedSection className="relative z-10 container mx-auto px-6 text-center" animation="scale-in">
          <h2 className="heading-section text-primary-foreground mb-6">
            Begin Your Wellness Journey
          </h2>
          <p className="text-primary-foreground/70 max-w-xl mx-auto mb-10">
            Embark on a journey where physical, mental, and spiritual wellness converge in an exclusive sanctuary.
          </p>
          <Link to="/apply">
            <Button variant="gold" size="lg" className="animate-pulse-soft">
              Apply for Membership
            </Button>
          </Link>
        </AnimatedSection>
      </section>

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
