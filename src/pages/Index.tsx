import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { ArrowRight, Sparkles, CircleDot, Bike, Activity, Bath, Droplets, Wind, Coffee, Baby, CheckCircle2 } from "lucide-react";
import gymArea2 from "@/assets/gym-area-2.jpg";
import sauna from "@/assets/sauna.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import treatmentRoom from "@/assets/treatment-room.jpg";
import reformerPilates from "@/assets/reformer-pilates.jpg";
import cycling from "@/assets/cycling.jpg";
import aerobicsStudio from "@/assets/aerobics-studio.jpg";
import stormLogoDark from "@/assets/storm-logo-dark.png";
import aellaLogo from "@/assets/aella-logo.jpg";
const classStudios = [{
  icon: CircleDot,
  title: "Reformer Pilates",
  description: "A mixture of reformer classes, both heated and non-heated options",
  image: reformerPilates,
  isHeated: false,
  color: "text-amber-900",
  bgColor: "bg-amber-900/10"
}, {
  icon: Bike,
  title: "Cycling Studio",
  description: "High-energy rides with immersive lighting and cinematic sound",
  image: cycling,
  isHeated: true,
  badgeText: "Cycling",
  color: "text-amber-800",
  bgColor: "bg-amber-800/10"
}, {
  icon: Activity,
  title: "Aerobics Room",
  description: "Bootcamp, Sculpt, Yoga, HIIT and more in our versatile studio",
  image: aerobicsStudio,
  isHeated: true,
  badgeText: "AEROBICS",
  color: "text-amber-700",
  bgColor: "bg-amber-700/10"
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
const memberAmenities = [{
  icon: Bath,
  label: "Luxury Locker Rooms"
}, {
  icon: Wind,
  label: "Steam & Sauna"
}, {
  icon: Droplets,
  label: "Cold Plunge Pool"
}, {
  icon: Sparkles,
  label: "Relaxation Lounge"
}, {
  icon: Coffee,
  label: "Café Access"
}, {
  icon: Baby,
  label: "Kids Care Available"
}];
export default function Index() {
  return <Layout>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={gymArea2} alt="Storm Wellness Club Interior" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal/40 via-charcoal/50 to-charcoal/80" />
        </div>
        
        <div className="relative z-10 container mx-auto px-6 text-center">
          
          <h1 className="heading-display text-primary-foreground mb-6 animate-fade-up opacity-0 stagger-2">
            Elevate Your
            <br />
            <span className="text-gold-light">Wellness Journey</span>
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto mb-10 animate-fade-up opacity-0 stagger-3">
            An application-based membership club offering premium fitness, spa, and lifestyle experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up opacity-0 stagger-4">
            <Link to="/apply">
              <Button variant="hero" size="lg">
                Apply for Membership
              </Button>
            </Link>
            <Link to="/classes">
              <Button variant="hero-outline" size="lg">
                Explore Classes
              </Button>
            </Link>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-primary-foreground/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-primary-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map(link => <Link key={link.href} to={link.href} className="card-luxury p-4 flex items-center gap-4 hover:border-accent transition-colors">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <link.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-sm">{link.label}</p>
                  <p className="text-muted-foreground text-xs">{link.description}</p>
                </div>
              </Link>)}
          </div>
        </div>
      </section>

      {/* Class Studios Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading title="Three Distinct Studios" subtitle="From reformer pilates to high-intensity cycling, discover classes designed to challenge and transform." />
          
          <div className="grid md:grid-cols-3 gap-8">
            {classStudios.map((studio, index) => <div key={index} className="card-luxury overflow-hidden group">
                <div className="relative h-64 overflow-hidden">
                  <img src={studio.image} alt={studio.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-hero" />
                  <div className="absolute top-4 right-4 flex gap-2">
                    {studio.isHeated ? <span className="flex items-center gap-1 px-3 py-1 text-accent-foreground text-xs uppercase tracking-wider bg-secondary">
                         {studio.badgeText || "Heated Options"}
                      </span> : <span className="flex items-center gap-1 px-3 py-1 text-secondary-foreground text-xs uppercase tracking-wider bg-secondary">RPilates REFORMER Pilates  
                      </span>}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full ${studio.bgColor} flex items-center justify-center`}>
                      <studio.icon className={`w-5 h-5 ${studio.color}`} />
                    </div>
                    <h3 className="font-serif text-xl">{studio.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3">{studio.description}</p>
                  <Link to="/classes" className="text-accent text-sm font-medium hover:underline">
                    View Classes →
                  </Link>
                </div>
              </div>)}
          </div>

          <div className="text-center mt-12">
            <Link to="/classes">
              <Button variant="outline" size="lg">
                View Full Schedule <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Aella Spa Section */}
      <section className="py-24 bg-gradient-to-b from-secondary/20 via-secondary/30 to-secondary/20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <img src={aellaLogo} alt="Aella" className="h-24 w-auto mx-auto mb-2 mix-blend-multiply" />
            <p className="text-accent text-sm uppercase tracking-widest mb-6">by Storm Wellness Club</p>
            <h2 className="heading-section mb-4">
              A Sanctuary for <span className="text-accent">Renewal & Serenity</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Open to all—no membership required. Immerse yourself in tranquil luxury with 
              world-class treatments designed to restore balance and rejuvenate the spirit.
            </p>
          </div>

          {/* Services with Images */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="group relative rounded-sm overflow-hidden h-72">
              <img src={treatmentRoom} alt="Facials" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="font-serif text-xl text-primary-foreground mb-1">Signature Facials</h3>
                <p className="text-primary-foreground/70 text-sm">Deep cleansing & hydration</p>
              </div>
            </div>
            <div className="group relative rounded-sm overflow-hidden h-72">
              <img src={spaShower} alt="Massage" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="font-serif text-xl text-primary-foreground mb-1">Therapeutic Massage</h3>
                <p className="text-primary-foreground/70 text-sm">Deep tissue & relaxation</p>
              </div>
            </div>
            <div className="group relative rounded-sm overflow-hidden h-72">
              <img src={sauna} alt="Body Treatments" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="font-serif text-xl text-primary-foreground mb-1">Body Treatments</h3>
                <p className="text-primary-foreground/70 text-sm">Wraps, sculpting & red light</p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link to="/spa">
              <Button variant="gold" size="lg">
                Explore Aella <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Membership Benefits */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <img src={cycling} alt="Cycling Studio" className="rounded-sm shadow-2xl" />
            </div>
            <div>
              <p className="text-gold-light text-sm uppercase tracking-widest mb-4">Member Benefits</p>
              <h2 className="heading-section text-primary-foreground mb-6">
                An Exclusive
                <br />
                Experience Awaits
              </h2>
              <p className="text-primary-foreground/80 mb-8 leading-relaxed">
                Storm Wellness Club is an application-based membership. 
                Join our community of wellness enthusiasts and unlock access to premium amenities.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-10">
                {memberAmenities.map(amenity => <div key={amenity.label} className="flex items-center gap-2 text-sm text-primary-foreground/90">
                    <amenity.icon className="w-4 h-4 text-gold-light" />
                    <span>{amenity.label}</span>
                  </div>)}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/apply">
                  <Button variant="gold" size="lg">
                    Apply Now
                  </Button>
                </Link>
                <Link to="/amenities">
                  <Button variant="hero-outline" size="lg">
                    View All Amenities
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Café Preview */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">The Storm Café</p>
            <h2 className="heading-section mb-6">Nourish From Within</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Fuel your wellness journey with our carefully curated menu of fresh juices, 
              smoothies, health bowls, and clean eating options. Available for dine-in or order ahead.
            </p>
            <Link to="/cafe">
              <Button variant="outline" size="lg">
                View Menu & Order <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Kids Care */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">For Families</p>
            <h2 className="heading-section mb-6">Storm Kids Care</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Focus on your wellness while your little ones enjoy supervised activities in our 
              dedicated kids care space. Available exclusively to members with a Kids Care Pass.
            </p>
            <Link to="/kids-care">
              <Button variant="outline" size="lg">
                Learn More <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-charcoal relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img src={gymArea2} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center">
          <h2 className="heading-section text-primary-foreground mb-6">
            Ready to Begin Your Journey?
          </h2>
          <p className="text-primary-foreground/70 max-w-xl mx-auto mb-10">
            Apply for membership today and unlock access to Houston's most exclusive wellness destination.
          </p>
          <Link to="/apply">
            <Button variant="gold" size="lg">
              Apply for Membership
            </Button>
          </Link>
        </div>
      </section>
    </Layout>;
}