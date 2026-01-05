import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Clock, Star, Users, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SpaBookingModal } from "@/components/booking/SpaBookingModal";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

import sauna from "@/assets/sauna.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import treatmentRoom from "@/assets/treatment-room.jpg";
import aellaLogo from "@/assets/aella-logo.png";
// Wellness imagery
import saunaInterior from "@/assets/wellness/sauna-interior.jpg";
import fracturedIce from "@/assets/wellness/fractured-ice.jpg";

interface SpaService {
  id: number;
  name: string;
  description: string;
  duration: string;
  cleanupTime: string;
  price: number;
  memberPrice?: number;
  category: string;
  popular?: boolean;
}

const spaServices: SpaService[] = [
  // Body Rituals – Chakra Alignment
  {
    id: 1,
    name: "Root Chakra Ritual",
    description: "A grounding ritual focused on stabilizing the body and calming the nervous system. Emphasizes lower body, feet, hips, and breath guidance with warm oils and slow rhythmic pressure.",
    duration: "75 min",
    cleanupTime: "15 min",
    price: 205,
    category: "Body Rituals",
  },
  {
    id: 2,
    name: "Sacral Chakra Ritual",
    description: "A sensory ritual designed to restore flow, emotional fluidity, and creative energy. Warm compresses, hip and lower abdominal focus, gentle oil massage, and movement stimulation.",
    duration: "75 min",
    cleanupTime: "15 min",
    price: 215,
    category: "Body Rituals",
  },
  {
    id: 3,
    name: "Solar Plexus Chakra Ritual",
    description: "A transformative ritual activating the core and energetic drive. Integrates warming oils, infrared heat, abdominal work, and rhythmic stimulation to cultivate vitality and confidence.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 260,
    category: "Body Rituals",
    popular: true,
  },
  {
    id: 4,
    name: "Heart Chakra Ritual",
    description: "A calming ritual centered on chest, shoulders, and upper body. Aromatic oils and sustained holds promote emotional release, openness, and relief from stress.",
    duration: "75 min",
    cleanupTime: "15 min",
    price: 255,
    category: "Body Rituals",
  },
  {
    id: 5,
    name: "Throat Chakra Ritual",
    description: "A neck, jaw, and scalp focused ritual supporting communication and self-expression. Warm oils, jaw release techniques, and shoulder decompression.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 225,
    category: "Body Rituals",
  },
  {
    id: 6,
    name: "Third Eye Chakra Ritual",
    description: "A meditative ritual centered on temples, scalp, face, and upper spine. Gentle lymphatic flow, pressure holds, and calm aromatics promote mental clarity.",
    duration: "75 min",
    cleanupTime: "15 min",
    price: 245,
    category: "Body Rituals",
  },
  {
    id: 7,
    name: "Crown Chakra Ritual (Integration)",
    description: "The flagship ritual integrating full-body guided breath, warm oils, and rhythmic flow to harmonize all energetic centers. Designed for profound restoration and nervous system reset.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 295,
    category: "Body Rituals",
    popular: true,
  },
  // Body Wraps
  {
    id: 8,
    name: "Detox Seaweed & Charcoal Wrap",
    description: "Premium seaweed + activated charcoal infusion to purify skin and support body detoxification.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 165,
    category: "Body Wraps",
  },
  {
    id: 9,
    name: "Detox Seaweed & Charcoal Wrap (Extended)",
    description: "Full body detox wrap with exfoliating scrub + short relaxation massage to stimulate.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 225,
    category: "Body Wraps",
  },
  {
    id: 10,
    name: "Anti-Aging Collagen Wrap",
    description: "Collagen-rich wrap to improve elasticity, reduce dryness, and support firmer skin tone.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 175,
    category: "Body Wraps",
    popular: true,
  },
  {
    id: 11,
    name: "Anti-Aging Collagen Wrap (Extended)",
    description: "Collagen infusion with full body scrub + short massage to enhance absorption and improve texture.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 235,
    category: "Body Wraps",
  },
  {
    id: 12,
    name: "Brightening Vitamin C Wrap",
    description: "Vitamin C antioxidants to brighten, awaken, and even overall skin tone.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 165,
    category: "Body Wraps",
  },
  {
    id: 13,
    name: "Mud Therapy Wrap",
    description: "Mineral mud cleanse to exfoliate and reduce inflammation while drawing toxins from the body.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 160,
    category: "Body Wraps",
  },
  {
    id: 14,
    name: "Hydration Boost Aloe Vera Wrap",
    description: "Soothing aloe infusion to rehydrate and calm dry, irritated, or stressed skin.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 155,
    category: "Body Wraps",
  },
  {
    id: 15,
    name: "Relaxing Chamomile Wrap",
    description: "Chamomile essence wrap to reduce body tension and promote calmness.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 150,
    category: "Body Wraps",
  },
  {
    id: 16,
    name: "Nourishing Avocado & Coconut Wrap",
    description: "Rich avocado + coconut oils to restore hydration and soften skin.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 175,
    category: "Body Wraps",
  },
  {
    id: 17,
    name: "Coffee Sculpting Wrap",
    description: "Caffeine-infused wrap to stimulate circulation and improve skin firmness.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 180,
    category: "Body Wraps",
  },
  // Massage / Bodywork
  {
    id: 18,
    name: "Storm Signature Massage — 60",
    description: "A calming full-body massage using slow rhythmic movements and guided breath to reduce stress and support relaxation.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 120,
    category: "Massage",
  },
  {
    id: 19,
    name: "Storm Signature Massage — 90",
    description: "A longer session with extended lower body and neck work to deepen relaxation and support nervous system regulation.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 155,
    category: "Massage",
    popular: true,
  },
  {
    id: 20,
    name: "Deep Relief Massage — 60",
    description: "Intentional deep-pressure bodywork focused on muscular tension and chronic tightness.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 145,
    category: "Massage",
  },
  {
    id: 21,
    name: "Deep Relief Massage — 90",
    description: "Extended session with deeper muscular release, fascia attention, and targeted area focus to reduce chronic tightness.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 185,
    category: "Massage",
    popular: true,
  },
  {
    id: 22,
    name: "Sports Performance Massage — 60",
    description: "Athletic-focused massage integrating compression, assisted mobility, stretching, and stimulation for training recovery.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 150,
    category: "Massage",
  },
  {
    id: 23,
    name: "Sports Performance Massage — 90",
    description: "Extended performance session with joint mobility, fascia attention, hip/shoulder work, and post-session grounding.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 195,
    category: "Massage",
  },
  {
    id: 24,
    name: "Lymph & Flow Massage — 60",
    description: "Gentle rhythmic massage to stimulate lymph movement, reduce retention, and support whole-body calm.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 160,
    category: "Massage",
  },
  {
    id: 25,
    name: "Lymph & Flow Massage — 90",
    description: "Extended lymphatic session including abdomen focus and scalp finishing for internal balance and lightness.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 205,
    category: "Massage",
  },
  {
    id: 26,
    name: "Prenatal Massage — 60",
    description: "A restorative prenatal-safe massage to relieve lower back pressure, calm tension, and support circulation during pregnancy.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 165,
    category: "Massage",
  },
  {
    id: 27,
    name: "Prenatal Massage — 90",
    description: "Extended prenatal session with hip support, lower body decompression, and guided relaxation for expecting mothers.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 215,
    category: "Massage",
  },
  // Facials
  {
    id: 28,
    name: "Age-Defying Facial — 60",
    description: "A luxurious anti-aging facial focusing on lifting, firming, and smoothing the skin with advanced serums targeting fine lines and wrinkles.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 175,
    category: "Facials",
  },
  {
    id: 29,
    name: "Age-Defying Facial — 90",
    description: "Extended anti-aging facial including deeper treatment time, targeted lifting techniques, and added massage to enhance firmness.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 215,
    category: "Facials",
    popular: true,
  },
  {
    id: 30,
    name: "Botanical Bliss Facial — 60",
    description: "An all-natural facial using organic botanical extracts to nourish and heal the skin. Ideal for sensitive skin types.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 160,
    category: "Facials",
  },
  {
    id: 31,
    name: "Botanical Bliss Facial — 90",
    description: "Extended botanical facial with added exfoliation and facial massage to maximize nourishment and soothe inflammation.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 205,
    category: "Facials",
  },
  {
    id: 32,
    name: "Customized Facial — 60",
    description: "A personalized facial tailored to hydration, anti-aging, congestion, or sensitivity. Adjusts products and techniques to meet individual skin needs.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 165,
    category: "Facials",
  },
  {
    id: 33,
    name: "Customized Facial — 90",
    description: "Extended tailored treatment with deeper exfoliation, serum layering, and targeted massage for full skin balance and renewal.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 215,
    category: "Facials",
  },
  {
    id: 34,
    name: "Detoxifying Purity Facial — 60",
    description: "Deep cleansing facial for congested or acne-prone skin. Includes charcoal mask and extractions to remove impurities.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 165,
    category: "Facials",
  },
  {
    id: 35,
    name: "Hydration Infusion Facial — 60",
    description: "Intense moisture infusion using hyaluronic-rich products to deeply hydrate dry or depleted skin.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 160,
    category: "Facials",
  },
  {
    id: 36,
    name: "Hydration Infusion Facial — 90",
    description: "Extended hydration treatment with deeper absorption and massage to sustain moisture and promote long-term suppleness.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 205,
    category: "Facials",
  },
  {
    id: 37,
    name: "Peptide Renewal Facial — 60",
    description: "Peptide-focused facial promoting collagen production and skin renewal. Ideal for improving texture and diminishing fine lines.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 175,
    category: "Facials",
  },
  {
    id: 38,
    name: "Peptide Renewal Facial — 90",
    description: "Extended peptide treatment with advanced serum layering and massage to enhance elasticity and deep renewal.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 225,
    category: "Facials",
    popular: true,
  },
  {
    id: 39,
    name: "Radiant Glow Facial — 60",
    description: "Rejuvenating facial designed to enhance natural radiance with gentle exfoliation and hydrating serums.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 160,
    category: "Facials",
  },
  {
    id: 40,
    name: "Radiant Glow Facial — 90",
    description: "Extended glow treatment with enhanced exfoliation and prolonged massage to promote luminosity.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 205,
    category: "Facials",
  },
  {
    id: 41,
    name: "Vitamin C Brightening Facial — 60",
    description: "Brightening facial infused with Vitamin C to target pigmentation, dullness, and uneven tone.",
    duration: "60 min",
    cleanupTime: "15 min",
    price: 165,
    category: "Facials",
  },
  {
    id: 42,
    name: "Vitamin C Brightening Facial — 90",
    description: "Extended Vitamin C treatment with deeper exfoliation and massage to improve clarity, radiance, and skin brightness.",
    duration: "90 min",
    cleanupTime: "20 min",
    price: 215,
    category: "Facials",
  },
  // Recovery
  {
    id: 43,
    name: "Full-Body Red Light Therapy — 10",
    description: "Full-body exposure to red and near-infrared wavelengths to support cellular energy, circulation, inflammation reduction, and muscle recovery.",
    duration: "10 min",
    cleanupTime: "5 min",
    price: 18,
    memberPrice: 12,
    category: "Recovery",
  },
  {
    id: 44,
    name: "Full-Body Red Light Therapy — 20",
    description: "Extended session designed to promote collagen production, speed recovery, reduce soreness, and enhance overall wellness.",
    duration: "20 min",
    cleanupTime: "5 min",
    price: 28,
    memberPrice: 20,
    category: "Recovery",
    popular: true,
  },
];

const categories = ["All", "Facials", "Massage", "Body Rituals", "Body Wraps", "Recovery"];

const memberDiscounts = [
  { tier: "Silver", discount: "5% OFF", color: "bg-warm-gray" },
  { tier: "Gold", discount: "8% OFF", color: "bg-gold" },
  { tier: "Platinum", discount: "10% OFF", color: "bg-muted" },
  { tier: "Diamond", discount: "12% OFF", color: "bg-accent" },
];

export default function Spa() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category");
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl || "All");
  const [selectedService, setSelectedService] = useState<SpaService | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    if (categoryFromUrl && categories.includes(categoryFromUrl)) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [categoryFromUrl]);

  const filteredServices = selectedCategory === "All" 
    ? spaServices 
    : spaServices.filter(s => s.category === selectedCategory);

  const formatPrice = (price: number) => `$${price}`;

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-20 min-h-[70vh] flex items-center">
        <div className="absolute inset-0">
          <img src={treatmentRoom} alt="Aella Spa" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/70 to-charcoal/40" />
        </div>
        <div className="relative z-10 container mx-auto px-6 py-24">
          <div className="max-w-xl">
            <img src={aellaLogo} alt="Aella" className="h-24 w-auto mb-6" />
            <p className="text-gold-light text-sm uppercase tracking-widest mb-4">by Storm Wellness Club</p>
            <h1 className="heading-display text-primary-foreground mb-6">
              A Sanctuary for Renewal
            </h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed mb-8">
              Open to all—no membership required. Our holistic approach encompasses 
              world-class treatments designed to support every step of your wellness journey.
            </p>
            <Button variant="gold" size="lg">
              Book a Treatment
            </Button>
          </div>
        </div>
      </section>

      {/* Member Discounts Banner */}
      <section className="py-6 bg-secondary/50 border-b border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">Member Spa Discounts:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {memberDiscounts.map((item) => (
                <div key={item.tier} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm">
                    <span className="font-medium">{item.tier}:</span> {item.discount}
                  </span>
                </div>
              ))}
            </div>
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
                className="card-luxury p-6 flex flex-col"
              >
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
                
                <p className="text-muted-foreground text-sm mb-4 flex-1">
                  {service.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {service.duration}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-accent font-semibold text-lg">
                        {formatPrice(service.price)}
                      </span>
                      {service.memberPrice && (
                        <span className="text-xs text-muted-foreground">
                          Members: {formatPrice(service.memberPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (!user) {
                        navigate("/auth");
                        return;
                      }
                      setSelectedService(service);
                      setShowBookingModal(true);
                    }}
                  >
                    Book Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Spa Room Info */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Our Treatment Spaces"
            subtitle="Experience tranquility in our thoughtfully designed treatment rooms."
          />
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="card-luxury p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-serif text-accent">5</span>
              </div>
              <h3 className="font-serif text-lg mb-2">Treatment Rooms</h3>
              <p className="text-sm text-muted-foreground">
                Thoughtfully designed spaces for your wellness journey
              </p>
            </div>
            
            <div className="card-luxury p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-serif text-accent">3</span>
              </div>
              <h3 className="font-serif text-lg mb-2">Shared Treatment Rooms</h3>
              <p className="text-sm text-muted-foreground">
                For facials, massage, and body ritual services
              </p>
            </div>
            
            <div className="card-luxury p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-serif text-accent">2</span>
              </div>
              <h3 className="font-serif text-lg mb-2">Dedicated Body Wrap Rooms</h3>
              <p className="text-sm text-muted-foreground">
                Specialized for body wrap services with waterproofing & sanitation
              </p>
            </div>
          </div>

          {/* Discount Exclusions Notice */}
          <div className="card-luxury p-6 mb-12">
            <div className="flex items-start gap-4">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium mb-2">Member Discount Exclusions</h4>
                <p className="text-sm text-muted-foreground">
                  Discounts do not apply to: IV Therapy, Peptide Therapy, Injectable Services, Med-Aesthetic Treatments, 
                  Device-Based Body Aesthetics, Laser Hair Removal, Retail Products, Packages/Bundles, or Gift Cards.
                </p>
              </div>
            </div>
          </div>

          {/* Gallery */}
          <div className="grid md:grid-cols-3 gap-6">
            <img src={sauna} alt="Sauna" className="rounded-sm h-64 w-full object-cover" />
            <img src={spaShower} alt="Spa Shower" className="rounded-sm h-64 w-full object-cover" />
            <img src={treatmentRoom} alt="Treatment Room" className="rounded-sm h-64 w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Booking Modal */}
      <SpaBookingModal
        service={selectedService}
        open={showBookingModal}
        onOpenChange={(open) => {
          setShowBookingModal(open);
          if (!open) setSelectedService(null);
        }}
      />
    </Layout>
  );
}
