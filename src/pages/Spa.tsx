import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Clock, Star } from "lucide-react";

import sauna from "@/assets/sauna.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import treatmentRoom from "@/assets/treatment-room.jpg";

interface SpaService {
  id: number;
  name: string;
  description: string;
  duration: string;
  price: string;
  category: string;
  popular?: boolean;
}

const spaServices: SpaService[] = [
  // Facials
  {
    id: 1,
    name: "Storm Signature Facial",
    description: "Our most popular treatment combining deep cleansing, exfoliation, and hydration with premium products.",
    duration: "75 min",
    price: "$195",
    category: "Facials",
    popular: true,
  },
  {
    id: 2,
    name: "Express Glow Facial",
    description: "Perfect for a quick refresh. Cleanse, exfoliate, and hydrate in under an hour.",
    duration: "45 min",
    price: "$120",
    category: "Facials",
  },
  {
    id: 3,
    name: "Anti-Aging Facial",
    description: "Advanced treatment targeting fine lines, wrinkles, and skin elasticity.",
    duration: "90 min",
    price: "$250",
    category: "Facials",
  },
  // Massage
  {
    id: 4,
    name: "Deep Tissue Massage",
    description: "Targeted pressure to release chronic muscle tension and knots.",
    duration: "60 min",
    price: "$150",
    category: "Massage",
    popular: true,
  },
  {
    id: 5,
    name: "Swedish Relaxation",
    description: "Classic massage technique for full-body relaxation and stress relief.",
    duration: "60 min",
    price: "$130",
    category: "Massage",
  },
  {
    id: 6,
    name: "Hot Stone Therapy",
    description: "Heated stones combined with massage for deep muscle relaxation.",
    duration: "90 min",
    price: "$185",
    category: "Massage",
  },
  // Body Treatments
  {
    id: 7,
    name: "Red Light Therapy",
    description: "Advanced LED therapy promoting cellular regeneration and skin health.",
    duration: "30 min",
    price: "$65",
    category: "Red Light Therapy",
    popular: true,
  },
  {
    id: 8,
    name: "Infrared Detox Wrap",
    description: "Full-body wrap with infrared technology for detoxification and relaxation.",
    duration: "60 min",
    price: "$145",
    category: "Body Wraps",
  },
  {
    id: 9,
    name: "Slimming Body Wrap",
    description: "Targeted wrap treatment designed to contour and tighten the body.",
    duration: "75 min",
    price: "$175",
    category: "Body Wraps",
  },
  {
    id: 10,
    name: "Body Sculpting",
    description: "Non-invasive treatment using advanced technology to contour and sculpt.",
    duration: "45 min",
    price: "$200",
    category: "Body Sculpting",
  },
  {
    id: 11,
    name: "Full Body Sculpting Package",
    description: "Comprehensive sculpting treatment for multiple body areas.",
    duration: "90 min",
    price: "$350",
    category: "Body Sculpting",
    popular: true,
  },
];

const categories = ["All", "Facials", "Massage", "Red Light Therapy", "Body Wraps", "Body Sculpting"];

import { useState } from "react";

export default function Spa() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredServices = selectedCategory === "All" 
    ? spaServices 
    : spaServices.filter(s => s.category === selectedCategory);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-20 min-h-[60vh] flex items-center">
        <div className="absolute inset-0">
          <img src={sauna} alt="Spa" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/80 via-charcoal/60 to-transparent" />
        </div>
        <div className="relative z-10 container mx-auto px-6 py-24">
          <div className="max-w-xl">
            <p className="text-gold-light text-sm uppercase tracking-widest mb-4">Public Spa</p>
            <h1 className="heading-display text-primary-foreground mb-6">
              Sanctuary for Body & Mind
            </h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed mb-8">
              No membership required. Experience world-class spa treatments in our 
              serene environment.
            </p>
            <Button variant="gold" size="lg">
              Book a Treatment
            </Button>
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <section className="py-8 bg-background border-b border-border sticky top-20 z-40">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`filter-badge ${selectedCategory === category ? "filter-badge-active" : ""}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="card-luxury p-6 flex flex-col md:flex-row gap-6"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-serif text-xl">{service.name}</h3>
                        {service.popular && (
                          <span className="flex items-center gap-1 text-xs text-accent">
                            <Star className="w-3 h-3 fill-current" /> Popular
                          </span>
                        )}
                      </div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {service.category}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground text-sm mb-4">
                    {service.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {service.duration}
                      </span>
                      <span className="text-accent font-semibold text-lg">
                        {service.price}
                      </span>
                    </div>
                    <Button variant="outline" size="sm">
                      Book Now
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Our Spa Spaces"
            subtitle="Experience tranquility in our thoughtfully designed treatment rooms and relaxation areas."
          />
          <div className="grid md:grid-cols-3 gap-6">
            <img src={sauna} alt="Sauna" className="rounded-sm h-64 w-full object-cover" />
            <img src={spaShower} alt="Spa Shower" className="rounded-sm h-64 w-full object-cover" />
            <img src={treatmentRoom} alt="Treatment Room" className="rounded-sm h-64 w-full object-cover" />
          </div>
        </div>
      </section>
    </Layout>
  );
}
