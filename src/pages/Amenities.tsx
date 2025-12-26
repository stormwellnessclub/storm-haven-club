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
  Clock
} from "lucide-react";

import sauna from "@/assets/sauna.jpg";
import spaShower from "@/assets/spa-shower.jpg";

const amenities = [
  {
    icon: Bath,
    title: "Luxury Locker Rooms",
    description: "Spacious lockers, premium toiletries, and plush towels provided.",
    available: true,
  },
  {
    icon: Thermometer,
    title: "Steam Room",
    description: "Eucalyptus-infused steam for relaxation and respiratory health.",
    available: true,
    bookable: true,
  },
  {
    icon: Wind,
    title: "Infrared Sauna",
    description: "Deep heat therapy for detoxification and muscle recovery.",
    available: true,
    bookable: true,
  },
  {
    icon: Droplets,
    title: "Cold Plunge Pool",
    description: "Invigorating cold therapy to boost circulation and recovery.",
    available: true,
    bookable: true,
  },
  {
    icon: Shirt,
    title: "Towel Service",
    description: "Fresh towels available throughout the club.",
    available: true,
  },
  {
    icon: Lock,
    title: "Private Changing Suites",
    description: "Private suites available for members who prefer extra privacy.",
    available: true,
  },
  {
    icon: Wifi,
    title: "Business Lounge",
    description: "Quiet workspace with high-speed WiFi and charging stations.",
    available: true,
  },
  {
    icon: Car,
    title: "Valet Parking",
    description: "Complimentary valet parking for all members.",
    available: true,
  },
];

const bookableAmenities = [
  {
    name: "Steam Room Session",
    duration: "30 min",
    description: "Private steam room session",
    slots: ["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"],
  },
  {
    name: "Infrared Sauna",
    duration: "45 min",
    description: "Private sauna session",
    slots: ["6:30 AM", "8:00 AM", "9:30 AM", "11:00 AM", "12:30 PM", "2:00 PM", "3:30 PM", "5:00 PM", "6:30 PM", "8:00 PM"],
  },
  {
    name: "Cold Plunge",
    duration: "15 min",
    description: "Cold therapy session",
    slots: ["On demand - walk in available"],
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
              Exclusive access to premium facilities designed for your comfort and wellness.
            </p>
          </div>
        </div>
      </section>

      {/* Amenities Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Included With Membership"
            subtitle="Every membership includes access to our full suite of amenities."
          />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {amenities.map((amenity, index) => (
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
        </div>
      </section>

      {/* Bookable Amenities */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Reserve Your Session"
            subtitle="Some amenities can be reserved for private use. Book ahead to secure your preferred time."
          />
          
          <div className="grid md:grid-cols-3 gap-6">
            {bookableAmenities.map((amenity, index) => (
              <div key={index} className="card-luxury p-6">
                <h3 className="font-serif text-xl mb-2">{amenity.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Clock className="w-4 h-4" />
                  {amenity.duration}
                </div>
                <p className="text-muted-foreground text-sm mb-4">{amenity.description}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Available: {Array.isArray(amenity.slots) && amenity.slots.length > 5 
                    ? `${amenity.slots.slice(0, 3).join(", ")}... and more`
                    : amenity.slots.join(", ")}
                </p>
                <Button variant="outline" className="w-full">
                  Book Session
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-section mb-4">Not a Member Yet?</h2>
            <p className="text-muted-foreground mb-8">
              Apply for membership to unlock access to all our premium amenities.
            </p>
            <Link to="/apply">
              <Button size="lg">Apply for Membership</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6">
            <img src={sauna} alt="Sauna" className="rounded-sm h-80 w-full object-cover" />
            <img src={spaShower} alt="Shower Area" className="rounded-sm h-80 w-full object-cover" />
          </div>
        </div>
      </section>
    </Layout>
  );
}
