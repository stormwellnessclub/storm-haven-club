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
import lockerRoom from "@/assets/locker-room.jpg";
import classesHero from "@/assets/classes-hero.jpg";
import gymArea1 from "@/assets/gym-area-1.jpg";
import gymArea2 from "@/assets/gym-area-2.jpg";
import reformerPilates from "@/assets/reformer-pilates.jpg";
import cycling from "@/assets/cycling.jpg";
import pilates from "@/assets/pilates.jpg";
import redLightTherapy from "@/assets/red-light-therapy.jpg";
import zerobodyCryo from "@/assets/zerobody-cryo.jpg";
import strengthSculpt from "@/assets/strength-sculpt.jpg";
// Brand imagery
import woodenLockers from "@/assets/interiors/wooden-lockers-gold.jpg";
import saunaInterior from "@/assets/wellness/sauna-interior.jpg";
import fracturedIce from "@/assets/wellness/fractured-ice.jpg";
import marbleTexture from "@/assets/textures/marble-texture.jpg";

// Recovery Suite amenities - open access (no booking needed)
const recoveryAmenities = [
  {
    icon: Flame,
    title: "Infrared Sauna",
    description: "Deep heat therapy for detoxification and muscle recovery.",
    image: saunaInterior,
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
    image: fracturedIce,
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
    image: strengthSculpt,
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
    name: "Silver",
    subtitle: "The Foundation",
    price: "$200",
    period: "/month",
    annualFee: "$300",
    description: "Begin your wellness journey",
    features: [
      "Full gym access",
      "Wet spa amenities (sauna, steam, salt room, cold plunge)",
      "Classes available à la carte or via credits",
      "Preferred spa service pricing",
    ],
    popular: false,
  },
  {
    name: "Gold",
    subtitle: "The Enhanced Experience",
    price: "$250",
    period: "/month",
    annualFee: "$300",
    description: "Enhanced wellness treatments",
    features: [
      "All Silver benefits",
      "Red Light Therapy (4x/month)",
      "Dry Cryo (2x/month)",
      "Classes available à la carte or via credits",
      "Preferred spa service pricing",
    ],
    popular: false,
  },
  {
    name: "Platinum",
    subtitle: "The Pinnacle of Luxury",
    price: "$350",
    period: "/month",
    annualFee: "$300",
    description: "Premium wellness experience",
    features: [
      "All Silver & Gold benefits",
      "Red Light Therapy (6x/month)",
      "Dry Cryo (4x/month)",
      "Classes available à la carte or via credits",
      "Preferred spa service pricing",
    ],
    popular: true,
  },
  {
    name: "Diamond",
    subtitle: "The Ultimate Commitment",
    price: "$500",
    period: "/month",
    annualFee: "$300",
    description: "The highest level of wellness care",
    features: [
      "Full facility access",
      "10 classes per month included",
      "Red Light Therapy (10x/month)",
      "Dry Cryo (6x/month)",
      "Preferred spa service pricing",
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
          <img src={woodenLockers} alt="Storm Wellness Club Members Only" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/95 via-charcoal/80 to-charcoal/50" />
        </div>
        <div className="relative z-10 container mx-auto px-6 py-32">
          <div className="max-w-2xl">
            <p className="text-gold-light text-sm uppercase tracking-[0.3em] mb-6 font-medium">Members Only</p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-primary-foreground mb-8 leading-[1.1]">
              A Sanctuary of<br />Wellness & Luxury
            </h1>
            <p className="text-primary-foreground/80 text-lg md:text-xl leading-relaxed max-w-lg">
              Every aspect of our space is designed with your holistic wellness in mind—nurturing body, mind, and spirit.
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
              Our recovery sanctuary supports your journey toward continuous growth and restoration.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {recoveryAmenities.map((amenity, index) => (
              <div key={index} className="group">
                {amenity.image ? (
                  <div className="relative h-64 mb-6 rounded-sm overflow-hidden">
                    <img 
                      src={amenity.image} 
                      alt={amenity.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent" />
                    <div className="absolute top-4 left-4 w-12 h-12 rounded-full bg-primary/80 backdrop-blur-sm flex items-center justify-center">
                      <amenity.icon className="w-6 h-6 text-gold-light" />
                    </div>
                  </div>
                ) : (
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-secondary/50 flex items-center justify-center transition-all duration-300 group-hover:bg-accent/10 group-hover:scale-110">
                    <amenity.icon className="w-8 h-8 text-accent" />
                  </div>
                )}
                <div className="text-center">
                  <h3 className="font-serif text-xl mb-3">{amenity.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{amenity.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Experiences - Booking Required */}
      <section className="relative py-24 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <img src={marbleTexture} alt="" className="w-full h-full object-cover" />
        </div>
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
                  src={fracturedIce} 
                  alt="Starpool ZeroBody - Cold Therapy" 
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
      <section className="relative">
        {/* Hero Image */}
        <div className="relative h-[50vh] min-h-[400px]">
          <img src={classesHero} alt="Storm Wellness Group Fitness" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-charcoal/60 via-charcoal/40 to-charcoal" />
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div className="max-w-3xl px-6">
              <p className="text-gold-light text-sm uppercase tracking-[0.3em] mb-4">Movement</p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-primary-foreground mb-6">Signature Classes</h2>
              <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto">
                Where physical, mental, and spiritual wellness converge. Small class sizes, expert instruction.
              </p>
            </div>
          </div>
        </div>
        
        {/* Classes Grid */}
        <div className="bg-primary py-16">
          <div className="container mx-auto px-6">
          
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {signatureClasses.map((classItem, index) => (
                <div key={index} className="group text-center">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-primary-foreground/10 flex items-center justify-center transition-all duration-300 group-hover:bg-gold/20 group-hover:scale-110">
                    <classItem.icon className="w-7 h-7 text-gold-light" />
                  </div>
                  <h3 className="font-serif text-lg text-primary-foreground mb-2">{classItem.title}</h3>
                  <p className="text-primary-foreground/70 text-sm leading-relaxed">{classItem.description}</p>
                </div>
              ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/classes">
              <Button variant="outline" size="lg" className="group border-gold/30 text-primary-foreground hover:bg-gold/10 hover:text-primary-foreground">
                View Class Schedule
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
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
      <section className="relative py-24 bg-background overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]">
          <img src={marbleTexture} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-accent text-sm uppercase tracking-[0.2em] mb-4">Membership</p>
            <h2 className="text-4xl md:text-5xl font-serif mb-6">Your Wellness Journey</h2>
            <p className="text-muted-foreground text-lg">
              Select the membership that aligns with your wellness goals and lifestyle.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {membershipTiers.map((tier, index) => (
              <div 
                key={index} 
                className={`rounded-sm p-6 relative transition-all duration-300 hover:shadow-xl ${
                  tier.popular 
                    ? 'bg-primary text-primary-foreground ring-2 ring-accent' 
                    : 'bg-secondary/30'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground text-xs uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="font-serif text-xl mb-1">{tier.name}</h3>
                  <p className={`text-xs uppercase tracking-wider mb-3 ${tier.popular ? 'text-gold-light' : 'text-accent'}`}>
                    {tier.subtitle}
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-serif font-medium">{tier.price}</span>
                    <span className={tier.popular ? 'text-primary-foreground/60' : 'text-muted-foreground'}>{tier.period}</span>
                  </div>
                  <p className={`text-xs mt-2 ${tier.popular ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
                    Annual Fee: {tier.annualFee}
                  </p>
                </div>
                
                <ul className="space-y-2 mb-6">
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
                    size="sm"
                  >
                    Apply Now
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          
          <div className="text-center text-muted-foreground text-sm mt-12 max-w-2xl mx-auto space-y-2">
            <p className="font-medium">Childcare Add-on: $75/month</p>
            <p className="text-xs">Limit 2 hours/day, 4 days/week. Additional usage subject to availability and fees.</p>
            <p className="mt-4">Storm Wellness Club is an application-based membership. All applications are reviewed within 48 hours.</p>
          </div>
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
              Begin Your Transformation
            </h2>
            <p className="text-primary-foreground/70 text-lg mb-10 max-w-xl mx-auto">
              Embark on a journey where physical, mental, and spiritual wellness converge in an exclusive sanctuary.
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
