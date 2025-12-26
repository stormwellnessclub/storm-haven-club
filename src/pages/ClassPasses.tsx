import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Check, Star, Baby, Dumbbell, Bike, Activity } from "lucide-react";

interface PassOption {
  id: string;
  name: string;
  description: string;
  price: number;
  period: string;
  features: string[];
  popular?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

const classPasses: PassOption[] = [
  {
    id: "single",
    name: "Drop-In Class",
    description: "Perfect for trying out a single class",
    price: 35,
    period: "per class",
    features: [
      "Access to any single class",
      "Reformer, Cycling, or Aerobics",
      "Valid for 30 days",
      "Towel service included",
    ],
  },
  {
    id: "5-pack",
    name: "5 Class Pack",
    description: "Great for regular attendees",
    price: 150,
    period: "5 classes",
    features: [
      "5 classes of your choice",
      "Mix and match class types",
      "Valid for 60 days",
      "Priority booking",
      "Towel service included",
    ],
  },
  {
    id: "10-pack",
    name: "10 Class Pack",
    description: "Best value for committed wellness",
    price: 275,
    period: "10 classes",
    features: [
      "10 classes of your choice",
      "Mix and match class types",
      "Valid for 90 days",
      "Priority booking",
      "Complimentary guest pass",
      "Towel service included",
    ],
    popular: true,
  },
  {
    id: "unlimited",
    name: "Monthly Unlimited",
    description: "For the dedicated practitioner",
    price: 199,
    period: "per month",
    features: [
      "Unlimited classes",
      "All class types included",
      "Priority booking",
      "Guest passes (2/month)",
      "Locker access",
      "Towel service included",
    ],
  },
];

const specialtyPasses: PassOption[] = [
  {
    id: "kids-care",
    name: "Kids Care Pass",
    description: "Childcare while you work out",
    price: 75,
    period: "per month",
    features: [
      "Unlimited kids care sessions",
      "Up to 2 hours per session",
      "Professional caregivers",
      "Age 3 months - 10 years",
      "Advance booking access",
    ],
    icon: Baby,
  },
  {
    id: "pilates-series",
    name: "Pilates Fundamentals",
    description: "4-week reformer introduction",
    price: 250,
    period: "4 weeks",
    features: [
      "8 reformer classes",
      "Small group setting (6 max)",
      "Equipment orientation",
      "Personalized feedback",
      "Completion certificate",
    ],
    icon: Dumbbell,
  },
  {
    id: "cycling-challenge",
    name: "Cycling Challenge",
    description: "30-day cycling transformation",
    price: 199,
    period: "30 days",
    features: [
      "Unlimited cycling classes",
      "Progress tracking",
      "Nutrition guide",
      "Performance metrics",
      "Challenge completion rewards",
    ],
    icon: Bike,
  },
];

export default function ClassPasses() {
  return (
    <Layout>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">Flexible Options</p>
            <h1 className="heading-display mb-6">Class Passes</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Choose the pass that fits your lifestyle. From single sessions to unlimited access, 
              we have options for every wellness journey.
            </p>
          </div>
        </div>
      </section>

      {/* Class Passes */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Class Packages"
            subtitle="Access reformer pilates, cycling, and aerobics classes with our flexible packages."
          />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {classPasses.map((pass) => (
              <div 
                key={pass.id} 
                className={`card-luxury p-6 flex flex-col ${
                  pass.popular ? "ring-2 ring-accent relative" : ""
                }`}
              >
                {pass.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-accent-foreground text-xs uppercase tracking-wider flex items-center gap-1">
                    <Star className="w-3 h-3" /> Most Popular
                  </span>
                )}
                
                <div className="mb-4">
                  <h3 className="font-serif text-xl mb-1">{pass.name}</h3>
                  <p className="text-muted-foreground text-sm">{pass.description}</p>
                </div>
                
                <div className="mb-6">
                  <span className="text-3xl font-light">${pass.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">/{pass.period}</span>
                </div>
                
                <ul className="space-y-3 mb-6 flex-1">
                  {pass.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  variant={pass.popular ? "gold" : "outline"} 
                  className="w-full"
                >
                  Purchase
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specialty Passes */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Specialty Passes"
            subtitle="Targeted programs and add-ons to enhance your experience."
          />
          
          <div className="grid md:grid-cols-3 gap-6">
            {specialtyPasses.map((pass) => (
              <div key={pass.id} className="card-luxury p-6 flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  {pass.icon && (
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <pass.icon className="w-5 h-5 text-accent" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-serif text-xl mb-1">{pass.name}</h3>
                    <p className="text-muted-foreground text-sm">{pass.description}</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <span className="text-2xl font-light">${pass.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">/{pass.period}</span>
                </div>
                
                <ul className="space-y-3 mb-6 flex-1">
                  {pass.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button variant="outline" className="w-full">
                  Purchase
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-section text-primary-foreground mb-4">
              Looking for Full Access?
            </h2>
            <p className="text-primary-foreground/70 mb-8">
              Members receive exclusive benefits including class discounts, 
              priority booking, and access to all amenities.
            </p>
            <Button variant="gold" size="lg" asChild>
              <a href="/apply">Apply for Membership</a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
