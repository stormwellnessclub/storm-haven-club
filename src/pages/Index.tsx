import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { ArrowRight, Sparkles, CircleDot, Bike, Activity, Bath, Droplets, Wind, Coffee, Baby, Flame, Sun, Snowflake } from "lucide-react";
import gymArea1 from "@/assets/gym-area-1.jpg";
import gymArea2 from "@/assets/gym-area-2.jpg";
import treatmentRoom from "@/assets/treatment-room.jpg";
import reformerPilates from "@/assets/reformer-pilates.jpg";
import cycling from "@/assets/cycling.jpg";
import aerobicsStudio from "@/assets/aerobics-studio.jpg";
import stormLogoDark from "@/assets/storm-logo-dark.png";
import aellaLogo from "@/assets/aella-logo.jpg";
import therapeuticMassage from "@/assets/therapeutic-massage.jpg";
import bodyTreatments from "@/assets/body-treatments.jpg";
import sauna from "@/assets/sauna.jpg";
// Brand imagery
import scienceSoulBranding from "@/assets/brand/science-soul-branding.jpg";
import marbleStaircase from "@/assets/interiors/marble-staircase.jpg";
import avocadoToast from "@/assets/food/avocado-toast.jpg";
import cafeHeroImage from "@/assets/food/matcha-latte.jpg";
import marbleTexture from "@/assets/textures/marble-texture.jpg";

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

const recoverySuiteAmenities = [
  { icon: Flame, label: "Infrared Sauna" },
  { icon: Wind, label: "Steam Room" },
  { icon: Droplets, label: "Cold Plunge Pool" },
  { icon: Sun, label: "Red Light Therapy" },
  { icon: Snowflake, label: "Starpool ZeroBody Cryo" },
];

const lifestyleAmenities = [
  { icon: Bath, label: "Luxury Locker Rooms" },
  { icon: Sparkles, label: "Relaxation Lounge" },
  { icon: Coffee, label: "Café Access" },
  { icon: Baby, label: "Kids Care" },
];
export default function Index() {
  return <Layout>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={marbleStaircase} alt="Storm Wellness Club Interior" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal/40 via-charcoal/50 to-charcoal/80" />
        </div>
        
        <div className="relative z-10 container mx-auto px-6 text-center">
          
          <h1 className="heading-display text-primary-foreground mb-6 animate-fade-up opacity-0 stagger-2">
            The Wellness Solution
            <br />
            <span className="text-gold-light">You Have Been Seeking</span>
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto mb-10 animate-fade-up opacity-0 stagger-3">
            Where physical, mental, and spiritual wellness converge in an exclusive sanctuary.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up opacity-0 stagger-4">
            <Link to="/apply">
              <Button variant="hero" size="lg">
                Apply for Membership
              </Button>
            </Link>
            <Link to="/memberships">
              <Button variant="hero-outline" size="lg">
                Explore Memberships
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
          <SectionHeading title="Three Distinct Studios" subtitle="A harmonious blend of mental clarity, emotional resilience, and physical strength—designed to address all facets of wellness." />
          
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
      <section className="relative py-24 bg-gradient-to-b from-secondary/20 via-secondary/30 to-secondary/20 overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <img src={marbleTexture} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 container mx-auto px-6">
          <div className="text-center mb-16">
            <img src={aellaLogo} alt="Aella" className="h-24 w-auto mx-auto mb-2 mix-blend-multiply" />
            <p className="text-accent text-sm uppercase tracking-widest mb-6">by Storm Wellness Club</p>
            <h2 className="heading-section mb-4">
              A Sanctuary for <span className="text-accent">Renewal & Restoration</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Open to all—no membership required. Our holistic approach encompasses a wide range of 
              treatments designed to support every step of your wellness journey.
            </p>
          </div>

          {/* Services with Images */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Link to="/spa?category=Facials" className="group relative rounded-sm overflow-hidden h-72 block">
              <img src={treatmentRoom} alt="Signature Facials" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                <h3 className="font-serif text-xl text-primary-foreground">Signature Facials</h3>
                <span className="text-primary-foreground/90 text-sm font-medium border border-primary-foreground/30 px-3 py-1 rounded-sm group-hover:bg-primary-foreground/10 transition-colors">Explore</span>
              </div>
            </Link>
            <Link to="/spa?category=Massage" className="group relative rounded-sm overflow-hidden h-72 block">
              <img src={therapeuticMassage} alt="Therapeutic Massage" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                <h3 className="font-serif text-xl text-primary-foreground">Therapeutic Massage</h3>
                <span className="text-primary-foreground/90 text-sm font-medium border border-primary-foreground/30 px-3 py-1 rounded-sm group-hover:bg-primary-foreground/10 transition-colors">Explore</span>
              </div>
            </Link>
            <Link to="/spa?category=Body Wraps" className="group relative rounded-sm overflow-hidden h-72 block">
              <img src={bodyTreatments} alt="Body Treatments" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                <h3 className="font-serif text-xl text-primary-foreground">Body Treatments</h3>
                <span className="text-primary-foreground/90 text-sm font-medium border border-primary-foreground/30 px-3 py-1 rounded-sm group-hover:bg-primary-foreground/10 transition-colors">Explore</span>
              </div>
            </Link>
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
      <section className="relative py-24 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <img src={marbleTexture} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <img src={sauna} alt="Infrared Sauna" className="rounded-sm shadow-2xl" />
            </div>
            <div>
              <p className="text-gold-light text-sm uppercase tracking-widest mb-4">Member Benefits</p>
              <h2 className="heading-section text-primary-foreground mb-6">
                A Comprehensive
                <br />
                Approach to Wellness
              </h2>
              <p className="text-primary-foreground/80 mb-8 leading-relaxed">
                We believe that true fitness transcends physical boundaries. Our exclusive center 
                is designed to address all facets of wellness—body, mind, and spirit.
              </p>
              
              {/* Recovery Suite */}
              <div className="mb-6">
                <p className="text-gold-light text-xs uppercase tracking-widest mb-3 font-medium">Recovery Suite</p>
                <div className="grid grid-cols-2 gap-3">
                  {recoverySuiteAmenities.map(amenity => (
                    <div key={amenity.label} className="flex items-center gap-2 text-sm text-primary-foreground/90">
                      <amenity.icon className="w-4 h-4 text-gold-light" />
                      <span>{amenity.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lifestyle & Comfort */}
              <div className="mb-10">
                <p className="text-gold-light text-xs uppercase tracking-widest mb-3 font-medium">Lifestyle & Comfort</p>
                <div className="grid grid-cols-2 gap-3">
                  {lifestyleAmenities.map(amenity => (
                    <div key={amenity.label} className="flex items-center gap-2 text-sm text-primary-foreground/90">
                      <amenity.icon className="w-4 h-4 text-gold-light" />
                      <span>{amenity.label}</span>
                    </div>
                  ))}
                </div>
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

      {/* Wellness Philosophy - Science & Soul */}
      <section className="relative py-32 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0">
          <img src={scienceSoulBranding} alt="A blend of science & soul" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal/90 via-charcoal/80 to-charcoal/90" />
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <p className="text-gold-light text-sm uppercase tracking-widest mb-6">Our Philosophy</p>
            <h2 className="heading-section text-primary-foreground mb-8">
              A Blend of Science & Soul
            </h2>
            <p className="text-primary-foreground/80 text-lg leading-relaxed max-w-2xl mx-auto">
              At Storm Wellness Club, we believe in the harmonious integration of evidence-based wellness 
              practices with the deeper, intuitive understanding of the human spirit. Our approach combines 
              cutting-edge science with mindful, soulful practices to create transformative experiences.
            </p>
          </div>
        </div>
      </section>

      {/* Café Preview */}
      <section className="relative py-24 bg-background overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative h-96 rounded-sm overflow-hidden">
              <img src={avocadoToast} alt="Fresh, healthy cuisine at Storm Café" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-accent text-sm uppercase tracking-widest mb-4">The Storm Café</p>
              <h2 className="heading-section mb-6">Nourish From Within</h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Support your wellness journey with our curated menu of fresh juices, smoothies, 
                and health-forward cuisine designed to fuel your transformation.
              </p>
              <Link to="/cafe">
                <Button variant="outline" size="lg">
                  View Menu & Order <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
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
              Prioritize your health while your little ones enjoy supervised care in our 
              dedicated space. Available to members with a Kids Care add-on.
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
          <img src={gymArea1} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center">
          <h2 className="heading-section text-primary-foreground mb-6">
            Begin Your Wellness Journey
          </h2>
          <p className="text-primary-foreground/70 max-w-xl mx-auto mb-10">
            Embark on a journey where physical, mental, and spiritual wellness converge in an exclusive sanctuary.
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