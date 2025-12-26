import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { ServiceCard } from "@/components/ServiceCard";
import { ArrowRight, Flame, Snowflake, Dumbbell, Bike, Activity, Sparkles } from "lucide-react";

import gymArea1 from "@/assets/gym-area-1.jpg";
import gymArea2 from "@/assets/gym-area-2.jpg";
import sauna from "@/assets/sauna.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import cyclingStudio from "@/assets/cycling-studio.jpg";
import treatmentRoom from "@/assets/treatment-room.jpg";

const classTypes = [
  {
    icon: Dumbbell,
    title: "Reformer Pilates",
    description: "Strengthen and lengthen with our state-of-the-art reformer equipment",
    image: gymArea1,
    isHeated: false,
  },
  {
    icon: Bike,
    title: "Cycling Studio",
    description: "High-energy rides with immersive lighting and premium TechnoGym bikes",
    image: cyclingStudio,
    isHeated: true,
  },
  {
    icon: Activity,
    title: "Aerobics & More",
    description: "From yoga to HIIT, find your perfect class in our versatile studio",
    image: gymArea2,
    isHeated: true,
  },
];

const spaServices = [
  {
    title: "Signature Facials",
    description: "Customized treatments using premium products",
    image: spaShower,
    price: "From $150",
  },
  {
    title: "Therapeutic Massage",
    description: "Deep tissue, Swedish, and specialty massages",
    image: treatmentRoom,
    price: "From $120",
  },
  {
    title: "Red Light Therapy",
    description: "Advanced cellular rejuvenation and recovery",
    image: sauna,
    price: "From $45",
  },
];

const amenities = [
  "Luxury Locker Rooms",
  "Steam & Sauna",
  "Cold Plunge Pool",
  "Relaxation Lounge",
  "Towel Service",
  "Organic Toiletries",
];

export default function Index() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={gymArea2}
            alt="Storm Wellness Club Interior"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal/40 via-charcoal/50 to-charcoal/80" />
        </div>
        
        <div className="relative z-10 container mx-auto px-6 text-center">
          <p className="text-primary-foreground/80 text-sm uppercase tracking-[0.3em] mb-6 animate-fade-up opacity-0 stagger-1">
            Exclusive Wellness Sanctuary
          </p>
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

      {/* Class Studios Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Three Distinct Studios"
            subtitle="From reformer pilates to high-intensity cycling, discover classes designed to challenge and transform."
          />
          
          <div className="grid md:grid-cols-3 gap-8">
            {classTypes.map((classType, index) => (
              <div key={index} className="card-luxury overflow-hidden group">
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={classType.image}
                    alt={classType.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-hero" />
                  <div className="absolute top-4 right-4 flex gap-2">
                    {classType.isHeated ? (
                      <span className="flex items-center gap-1 px-3 py-1 bg-accent text-accent-foreground text-xs uppercase tracking-wider">
                        <Flame className="w-3 h-3" /> Heated
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1 bg-secondary text-secondary-foreground text-xs uppercase tracking-wider">
                        <Snowflake className="w-3 h-3" /> Non-Heated
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <classType.icon className="w-5 h-5 text-accent" />
                    <h3 className="font-serif text-xl">{classType.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">{classType.description}</p>
                </div>
              </div>
            ))}
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

      {/* Spa & Wellness Section */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-accent text-sm uppercase tracking-widest mb-4">Public Spa</p>
              <h2 className="heading-section mb-6">
                Sanctuary for the
                <br />
                <span className="text-accent">Body & Mind</span>
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Our spa is open to everyone—no membership required. Experience world-class treatments 
                including facials, therapeutic massage, red light therapy, body wraps, and advanced 
                body sculpting in our serene environment.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {["Facials", "Massage", "Red Light Therapy", "Body Wraps", "Body Sculpting", "Salt Room"].map((service) => (
                  <div key={service} className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span>{service}</span>
                  </div>
                ))}
              </div>
              <Link to="/spa">
                <Button size="lg">
                  View Spa Menu <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <img src={sauna} alt="Sauna" className="rounded-sm object-cover h-48 w-full" />
                <img src={treatmentRoom} alt="Treatment Room" className="rounded-sm object-cover h-64 w-full" />
              </div>
              <div className="space-y-4 pt-8">
                <img src={spaShower} alt="Spa Shower" className="rounded-sm object-cover h-64 w-full" />
                <img src={gymArea1} alt="Wellness Area" className="rounded-sm object-cover h-48 w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Membership Benefits */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <img
                src={cyclingStudio}
                alt="Cycling Studio"
                className="rounded-sm shadow-2xl"
              />
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
                {amenities.map((amenity) => (
                  <div key={amenity} className="flex items-center gap-2 text-sm text-primary-foreground/90">
                    <div className="w-1.5 h-1.5 bg-gold rounded-full" />
                    <span>{amenity}</span>
                  </div>
                ))}
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
    </Layout>
  );
}
