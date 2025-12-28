import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Bath, 
  Wind, 
  Droplets, 
  Shirt, 
  Lock, 
  Car,
  Clock,
  Coffee,
  Baby,
  Dumbbell,
  Waves,
  Flame,
  Sun,
  Snowflake,
  CheckCircle2,
  CircleDot,
  Bike,
  Activity,
  ArrowRight
} from "lucide-react";

import sauna from "@/assets/sauna.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import gymArea1 from "@/assets/gym-area-1.jpg";
import gymArea2 from "@/assets/gym-area-2.jpg";
import reformerPilates from "@/assets/reformer-pilates.jpg";
import cycling from "@/assets/cycling.jpg";
import pilates from "@/assets/pilates.jpg";
import redLightTherapy from "@/assets/red-light-therapy.jpg";
import zerobodyCryo from "@/assets/zerobody-cryo.jpg";

// Recovery Suite amenities - open access (no booking needed)
const recoveryAmenities = [
  {
    icon: Flame,
    title: "Infrared Sauna",
    description: "Deep heat therapy for detoxification and muscle recovery.",
  },
  {
    icon: Wind,
    title: "Steam Room",
    description: "Eucalyptus-infused steam for relaxation and respiratory wellness.",
  },
  {
    icon: Droplets,
    title: "Cold Plunge Pool",
    description: "Cold therapy to boost circulation and reduce inflammation.",
  },
  {
    icon: Waves,
    title: "Salt Room",
    description: "Himalayan salt therapy for respiratory health and skin rejuvenation.",
  },
];

// Premium experiences - booking required
const premiumExperiences = [
  {
    icon: Sun,
    title: "Red Light Therapy",
    description: "Cellular repair through precision wavelengths. Reduce inflammation, accelerate recovery, restore skin.",
    duration: "20 min",
    bookable: true,
  },
  {
    icon: Snowflake,
    title: "Starpool ZeroBody",
    description: "Dry floatation in complete weightlessness. The nervous system resets. The mind follows.",
    duration: "5 min",
    bookable: true,
  },
];

// Signature Classes
const signatureClasses = [
  {
    icon: CircleDot,
    title: "Reformer Pilates",
    description: "Precision-based movement on state-of-the-art reformers. Build strength, flexibility, and body awareness.",
    image: reformerPilates,
  },
  {
    icon: Bike,
    title: "Cycling",
    description: "High-energy rides that challenge your limits. Music-driven, instructor-led intensity.",
    image: cycling,
  },
  {
    icon: Activity,
    title: "Mat Pilates",
    description: "Core-focused bodyweight training. Develop stability and control through mindful movement.",
    image: pilates,
  },
  {
    icon: Dumbbell,
    title: "Strength & Sculpt",
    description: "Full-body conditioning combining weights and functional training for total-body transformation.",
    image: gymArea1,
  },
];

// Lifestyle & Comfort amenities
const lifestyleAmenities = [
  {
    icon: Bath,
    title: "Luxury Locker Rooms",
    description: "Spa-grade facilities with private showers, premium toiletries, and plush towels.",
  },
  {
    icon: Lock,
    title: "Private Changing Suites",
    description: "Private suites for members who prefer additional privacy.",
  },
  {
    icon: Shirt,
    title: "Towel Service",
    description: "Fresh, warm towels available throughout the club.",
  },
  {
    icon: Car,
    title: "Complimentary Parking",
    description: "Ample free parking for all members.",
  },
  {
    icon: Coffee,
    title: "Storm Café",
    description: "Fresh juices, smoothies, protein shakes, and healthy dining.",
  },
  {
    icon: Baby,
    title: "Kids Care",
    description: "Supervised childcare while you enjoy your wellness experience.",
    addon: true,
  },
];

// Membership tiers
const membershipTiers = [
  {
    name: "Essential",
    price: "$199",
    period: "/month",
    description: "Begin your wellness journey",
    features: [
      "Unlimited fitness floor access",
      "4 classes per month",
      "Locker room & shower access",
      "Towel service",
      "Café discount (10%)",
    ],
    popular: false,
  },
  {
    name: "Premium",
    price: "$299",
    period: "/month",
    description: "Full access for wellness enthusiasts",
    features: [
      "Everything in Essential",
      "Unlimited classes",
      "Recovery suite access",
      "Salt room access",
      "Café discount (15%)",
      "Guest passes (2/month)",
    ],
    popular: true,
  },
  {
    name: "Elite",
    price: "$449",
    period: "/month",
    description: "The ultimate Storm experience",
    features: [
      "Everything in Premium",
      "Priority class booking",
      "Monthly spa treatment credit ($100)",
      "Red Light Therapy sessions",
      "ZeroBody Cryo sessions",
      "Kids care included",
      "Private locker",
      "Café discount (20%)",
      "Unlimited guest passes",
    ],
    popular: false,
  },
];

export default function Amenities() {
  return (
    <Layout>
      {/* Hero - Full bleed */}
      <section className="relative min-h-[70vh] flex items-center">
        <div className="absolute inset-0">
          <img src={sauna} alt="Storm Wellness Club Recovery Suite" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/95 via-charcoal/80 to-charcoal/50" />
        </div>
        <div className="relative z-10 container mx-auto px-6 py-32">
          <div className="max-w-2xl">
            <p className="text-gold-light text-sm uppercase tracking-[0.3em] mb-6 font-medium">Members Only</p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-primary-foreground mb-8 leading-[1.1]">
              The Space<br />Supports the Work
            </h1>
            <p className="text-primary-foreground/80 text-lg md:text-xl leading-relaxed max-w-lg">
              Recovery, movement, and stillness—integrated by design. Every detail serves your wellbeing.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link to="/apply">
                <Button variant="gold" size="lg" className="group">
                  Apply for Membership
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Recovery Suite - Open Access */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-accent text-sm uppercase tracking-[0.2em] mb-4">Open Access</p>
            <h2 className="text-4xl md:text-5xl font-serif mb-6">Recovery Suite</h2>
            <p className="text-muted-foreground text-lg">
              Step into our recovery sanctuary. No reservations required—simply show up and restore.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {recoveryAmenities.map((amenity, index) => (
              <div key={index} className="group text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-secondary/50 flex items-center justify-center transition-all duration-300 group-hover:bg-accent/10 group-hover:scale-110">
                  <amenity.icon className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-serif text-xl mb-3">{amenity.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{amenity.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Experiences - Booking Required */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-gold-light text-sm uppercase tracking-[0.2em] mb-4">Reservation Required</p>
            <h2 className="text-4xl md:text-5xl font-serif text-primary-foreground mb-6">Advanced Recovery</h2>
            <p className="text-primary-foreground/70 text-lg">
              Precision therapies. Booking ensures your time is protected.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Red Light Therapy */}
            <div className="group relative overflow-hidden rounded-sm">
              <div className="aspect-[4/3]">
                <img 
                  src={redLightTherapy} 
                  alt="Red Light Therapy" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h3 className="font-serif text-2xl text-primary-foreground mb-2">Red Light Therapy</h3>
                <div className="flex items-center gap-2 text-sm text-gold-light mb-3">
                  <Clock className="w-4 h-4" />
                  20 minutes
                </div>
                <p className="text-primary-foreground/80 text-sm leading-relaxed mb-4">
                  Cellular repair through precision wavelengths. Reduce inflammation, accelerate recovery, restore skin.
                </p>
                <Button variant="outline" className="border-gold/30 text-primary-foreground hover:bg-gold/10 hover:text-primary-foreground">
                  Book Session
                </Button>
              </div>
            </div>

            {/* ZeroBody */}
            <div className="group relative overflow-hidden rounded-sm">
              <div className="aspect-[4/3]">
                <img 
                  src={zerobodyCryo} 
                  alt="Starpool ZeroBody" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h3 className="font-serif text-2xl text-primary-foreground mb-2">Starpool ZeroBody</h3>
                <div className="flex items-center gap-2 text-sm text-gold-light mb-3">
                  <Clock className="w-4 h-4" />
                  5 minutes
                </div>
                <p className="text-primary-foreground/80 text-sm leading-relaxed mb-4">
                  Dry floatation in complete weightlessness. The nervous system resets. The mind follows.
                </p>
                <Button variant="outline" className="border-gold/30 text-primary-foreground hover:bg-gold/10 hover:text-primary-foreground">
                  Book Session
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Classes */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-accent text-sm uppercase tracking-[0.2em] mb-4">Movement</p>
            <h2 className="text-4xl md:text-5xl font-serif mb-6">Signature Classes</h2>
            <p className="text-muted-foreground text-lg">
              Designed for the individual. Powered by the collective. Included with Premium and Elite memberships.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {signatureClasses.map((classItem, index) => (
              <div key={index} className="group relative overflow-hidden rounded-sm h-80">
                <img 
                  src={classItem.image} 
                  alt={classItem.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <div className="flex items-center gap-3 mb-3">
                    <classItem.icon className="w-5 h-5 text-gold-light" />
                    <h3 className="font-serif text-2xl text-primary-foreground">{classItem.title}</h3>
                  </div>
                  <p className="text-primary-foreground/80 text-sm leading-relaxed">{classItem.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/classes">
              <Button variant="outline" size="lg" className="group">
                View Class Schedule
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Lifestyle & Comfort */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-accent text-sm uppercase tracking-[0.2em] mb-4">The Details</p>
            <h2 className="text-4xl md:text-5xl font-serif mb-6">Lifestyle & Comfort</h2>
            <p className="text-muted-foreground text-lg">
              Every detail designed for your comfort and convenience.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lifestyleAmenities.map((amenity, index) => (
              <div key={index} className="bg-background rounded-sm p-6 flex items-start gap-4 hover:shadow-lg transition-shadow duration-300">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <amenity.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-serif text-lg mb-1">{amenity.title}</h3>
                  <p className="text-muted-foreground text-sm">{amenity.description}</p>
                  {amenity.addon && (
                    <span className="inline-block mt-2 text-xs text-accent uppercase tracking-wider">
                      Add-on Available
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership Tiers */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-accent text-sm uppercase tracking-[0.2em] mb-4">Membership</p>
            <h2 className="text-4xl md:text-5xl font-serif mb-6">Choose Your Path</h2>
            <p className="text-muted-foreground text-lg">
              Select the membership that aligns with your wellness goals.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {membershipTiers.map((tier, index) => (
              <div 
                key={index} 
                className={`rounded-sm p-8 relative transition-all duration-300 hover:shadow-xl ${
                  tier.popular 
                    ? 'bg-primary text-primary-foreground ring-2 ring-accent' 
                    : 'bg-secondary/30'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground text-xs uppercase tracking-wider px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-8">
                  <h3 className="font-serif text-2xl mb-2">{tier.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-serif font-medium">{tier.price}</span>
                    <span className={tier.popular ? 'text-primary-foreground/60' : 'text-muted-foreground'}>{tier.period}</span>
                  </div>
                  <p className={`text-sm mt-3 ${tier.popular ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {tier.description}
                  </p>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${tier.popular ? 'text-gold-light' : 'text-accent'}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/apply">
                  <Button 
                    variant={tier.popular ? "gold" : "outline"} 
                    className="w-full"
                  >
                    Apply Now
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          
          <p className="text-center text-muted-foreground text-sm mt-12">
            Storm Wellness Club is an application-based membership. All applications are reviewed within 48 hours.
          </p>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-1">
          <img src={sauna} alt="Infrared Sauna" className="h-72 w-full object-cover hover:opacity-90 transition-opacity" />
          <img src={spaShower} alt="Spa" className="h-72 w-full object-cover hover:opacity-90 transition-opacity" />
          <img src={gymArea1} alt="Fitness" className="h-72 w-full object-cover hover:opacity-90 transition-opacity" />
          <img src={gymArea2} alt="Wellness" className="h-72 w-full object-cover hover:opacity-90 transition-opacity" />
        </div>
      </section>

      {/* CTA - Full bleed */}
      <section className="relative py-32 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-gold via-transparent to-transparent" />
        </div>
        <div className="relative container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-serif text-primary-foreground mb-6">
              Ready to Transform?
            </h2>
            <p className="text-primary-foreground/70 text-lg mb-10 max-w-xl mx-auto">
              Join Houston's most exclusive wellness destination. Your transformation begins here.
            </p>
            <Link to="/apply">
              <Button variant="gold" size="lg" className="group">
                Apply for Membership
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
