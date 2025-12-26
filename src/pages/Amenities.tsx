import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Bath, 
  Thermometer, 
  Wind, 
  Droplets, 
  Shirt, 
  Lock, 
  Wifi, 
  Car,
  Clock,
  Sparkles,
  Coffee,
  Baby,
  Dumbbell,
  Waves,
  Flame,
  Moon,
  Sun,
  CheckCircle2
} from "lucide-react";

import sauna from "@/assets/sauna.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import gymArea1 from "@/assets/gym-area-1.jpg";
import gymArea2 from "@/assets/gym-area-2.jpg";

// Member amenities from stormwellnessclub.com
const memberAmenities = [
  {
    icon: Bath,
    title: "Luxury Locker Rooms",
    description: "Spa-grade locker rooms with private showers, premium toiletries, and plush towels.",
    category: "essentials",
  },
  {
    icon: Thermometer,
    title: "Infrared Sauna",
    description: "State-of-the-art infrared sauna for deep heat therapy, detoxification, and muscle recovery.",
    category: "recovery",
    bookable: true,
  },
  {
    icon: Wind,
    title: "Steam Room",
    description: "Eucalyptus-infused steam room for relaxation and respiratory wellness.",
    category: "recovery",
    bookable: true,
  },
  {
    icon: Droplets,
    title: "Cold Plunge Pool",
    description: "Invigorating cold therapy pool to boost circulation, reduce inflammation, and accelerate recovery.",
    category: "recovery",
    bookable: true,
  },
  {
    icon: Waves,
    title: "Salt Room",
    description: "Himalayan salt therapy room for respiratory health and skin rejuvenation.",
    category: "recovery",
    bookable: true,
  },
  {
    icon: Moon,
    title: "Relaxation Lounge",
    description: "Quiet sanctuary with zero-gravity chairs for post-treatment rest and meditation.",
    category: "relaxation",
  },
  {
    icon: Shirt,
    title: "Towel Service",
    description: "Fresh, warm towels available throughout the club for your convenience.",
    category: "essentials",
  },
  {
    icon: Lock,
    title: "Private Changing Suites",
    description: "Private suites for members who prefer additional privacy.",
    category: "essentials",
  },
  {
    icon: Sparkles,
    title: "Premium Toiletries",
    description: "Organic, luxury toiletries including shampoo, conditioner, body wash, and skincare.",
    category: "essentials",
  },
  {
    icon: Coffee,
    title: "Storm Café Access",
    description: "Fresh juices, smoothies, protein shakes, and healthy dining options.",
    category: "lifestyle",
  },
  {
    icon: Baby,
    title: "Kids Care",
    description: "Supervised childcare while you enjoy your workout or spa treatment.",
    category: "lifestyle",
    addon: true,
  },
  {
    icon: Wifi,
    title: "Business Lounge",
    description: "Quiet workspace with high-speed WiFi, charging stations, and meeting areas.",
    category: "lifestyle",
  },
  {
    icon: Car,
    title: "Complimentary Parking",
    description: "Ample free parking for all members with reserved spaces available.",
    category: "essentials",
  },
  {
    icon: Dumbbell,
    title: "Fitness Floor",
    description: "Full fitness floor with premium cardio and strength equipment.",
    category: "fitness",
  },
];

// Membership tiers from website
const membershipTiers = [
  {
    name: "Essential",
    price: "$199",
    period: "/month",
    description: "Perfect for those beginning their wellness journey",
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
    description: "Our most popular membership for wellness enthusiasts",
    features: [
      "Everything in Essential",
      "Unlimited classes",
      "Recovery suite access (sauna, steam, cold plunge)",
      "Salt room sessions",
      "Relaxation lounge",
      "Café discount (15%)",
      "Guest passes (2/month)",
    ],
    popular: true,
  },
  {
    name: "Elite",
    price: "$449",
    period: "/month",
    description: "The ultimate Storm experience with exclusive perks",
    features: [
      "Everything in Premium",
      "Priority class booking",
      "Monthly spa treatment credit ($100)",
      "Kids care included",
      "Private locker",
      "Café discount (20%)",
      "Unlimited guest passes",
      "Exclusive member events",
    ],
    popular: false,
  },
];

const bookableAmenities = [
  {
    name: "Infrared Sauna",
    duration: "45 min",
    description: "Private infrared sauna session for deep heat therapy",
    icon: Flame,
  },
  {
    name: "Steam Room",
    duration: "30 min",
    description: "Eucalyptus-infused steam session",
    icon: Wind,
  },
  {
    name: "Cold Plunge",
    duration: "15 min",
    description: "Cold therapy session - walk-ins welcome",
    icon: Droplets,
  },
  {
    name: "Salt Room",
    duration: "45 min",
    description: "Himalayan salt therapy session",
    icon: Waves,
  },
];

export default function Amenities() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-20 min-h-[50vh] flex items-center">
        <div className="absolute inset-0">
          <img src={spaShower} alt="Amenities" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/80 via-charcoal/60 to-transparent" />
        </div>
        <div className="relative z-10 container mx-auto px-6 py-24">
          <div className="max-w-xl">
            <p className="text-gold-light text-sm uppercase tracking-widest mb-4">Members Only</p>
            <h1 className="heading-display text-primary-foreground mb-6">
              Member Amenities
            </h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed">
              Exclusive access to Houston's most comprehensive wellness facilities. 
              Every detail designed for your comfort and transformation.
            </p>
          </div>
        </div>
      </section>

      {/* Amenities Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Included With Membership"
            subtitle="Every membership includes access to our full suite of premium amenities."
          />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {memberAmenities.slice(0, 8).map((amenity, index) => (
              <div key={index} className="card-luxury p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                  <amenity.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-serif text-lg mb-2">{amenity.title}</h3>
                <p className="text-muted-foreground text-sm">{amenity.description}</p>
                {amenity.bookable && (
                  <span className="inline-block mt-3 text-xs text-accent uppercase tracking-wider">
                    Booking Available
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {memberAmenities.slice(8).map((amenity, index) => (
              <div key={index} className="card-luxury p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <amenity.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-serif text-lg mb-1">{amenity.title}</h3>
                  <p className="text-muted-foreground text-sm">{amenity.description}</p>
                  {amenity.addon && (
                    <span className="inline-block mt-2 text-xs text-muted-foreground uppercase tracking-wider">
                      Add-on Available
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recovery Suite */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Recovery Suite"
            subtitle="Book private sessions in our recovery amenities for the ultimate wellness experience."
          />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {bookableAmenities.map((amenity, index) => (
              <div key={index} className="card-luxury p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                  <amenity.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-serif text-xl mb-2">{amenity.name}</h3>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-3">
                  <Clock className="w-4 h-4" />
                  {amenity.duration}
                </div>
                <p className="text-muted-foreground text-sm mb-4">{amenity.description}</p>
                <Button variant="outline" className="w-full">
                  Book Session
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership Tiers */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Membership Tiers"
            subtitle="Choose the membership that fits your wellness lifestyle."
          />
          
          <div className="grid md:grid-cols-3 gap-8">
            {membershipTiers.map((tier, index) => (
              <div 
                key={index} 
                className={`card-luxury p-8 relative ${tier.popular ? 'ring-2 ring-accent' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground text-xs uppercase tracking-wider px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="font-serif text-2xl mb-2">{tier.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-serif font-medium">{tier.price}</span>
                    <span className="text-muted-foreground">{tier.period}</span>
                  </div>
                  <p className="text-muted-foreground text-sm mt-3">{tier.description}</p>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link to="/apply">
                  <Button 
                    variant={tier.popular ? "default" : "outline"} 
                    className="w-full"
                  >
                    Apply for {tier.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          
          <p className="text-center text-muted-foreground text-sm mt-8">
            Storm Wellness Club is an application-based membership. All applications are reviewed within 48 hours.
          </p>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <img src={sauna} alt="Infrared Sauna" className="rounded-sm h-64 w-full object-cover" />
            <img src={spaShower} alt="Spa Shower" className="rounded-sm h-64 w-full object-cover" />
            <img src={gymArea1} alt="Fitness Floor" className="rounded-sm h-64 w-full object-cover" />
            <img src={gymArea2} alt="Wellness Area" className="rounded-sm h-64 w-full object-cover" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-section text-primary-foreground mb-4">Ready to Transform?</h2>
            <p className="text-primary-foreground/70 mb-8">
              Apply for membership today and unlock access to Houston's most exclusive wellness destination.
            </p>
            <Link to="/apply">
              <Button variant="gold" size="lg">Apply for Membership</Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
