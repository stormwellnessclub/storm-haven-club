import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Check, Info, Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface PricingTier {
  type: string;
  memberPrice: number;
  nonMemberPrice: number;
}

const pilatesCyclingPricing: PricingTier[] = [
  { type: "Single Class", memberPrice: 25, nonMemberPrice: 0 },
  { type: "10 Class Pack", memberPrice: 170, nonMemberPrice: 0 },
];

const otherClassesPricing: PricingTier[] = [
  { type: "Single Class", memberPrice: 15, nonMemberPrice: 0 },
  { type: "10 Class Pack", memberPrice: 150, nonMemberPrice: 0 },
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
              Purchase class passes for our Reformer Pilates, Cycling, and Aerobics studios. 
              Members receive discounted pricing on all class packages.
            </p>
          </div>
        </div>
      </section>

      {/* Pilates & Cycling Pricing */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Pilates & Cycling Classes"
            subtitle="Our signature Reformer Pilates and high-energy Cycling classes."
          />
          
          <div className="max-w-4xl mx-auto">
            <div className="card-luxury overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 bg-secondary/50 p-4 border-b border-border">
                <div className="font-medium">Package</div>
                <div className="font-medium text-center">Member Price</div>
                <div className="font-medium text-center">Non-Member Price</div>
              </div>
              
              {/* Rows */}
              {pilatesCyclingPricing.map((tier, index) => (
                <div 
                  key={tier.type}
                  className={`grid grid-cols-3 p-4 items-center ${
                    index !== pilatesCyclingPricing.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="font-medium">{tier.type}</div>
                  <div className="text-center">
                    <span className="text-2xl font-light">${tier.memberPrice}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-light">${tier.nonMemberPrice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Other Classes Pricing */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Other Classes"
            subtitle="Yoga, Mat Pilates, Bootcamp, and other studio classes."
          />
          
          <div className="max-w-4xl mx-auto">
            <div className="card-luxury overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 bg-secondary/50 p-4 border-b border-border">
                <div className="font-medium">Package</div>
                <div className="font-medium text-center">Member Price</div>
                <div className="font-medium text-center">Non-Member Price</div>
              </div>
              
              {/* Rows */}
              {otherClassesPricing.map((tier, index) => (
                <div 
                  key={tier.type}
                  className={`grid grid-cols-3 p-4 items-center ${
                    index !== otherClassesPricing.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="font-medium">{tier.type}</div>
                  <div className="text-center">
                    <span className="text-2xl font-light">${tier.memberPrice}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-light">${tier.nonMemberPrice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pass Information */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pass Validity */}
              <div className="card-luxury p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                <h3 className="font-serif text-xl mb-2">Pass Validity</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      10 Class Packs are valid for 2 months. Single Class Passes are valid for 1 week.
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span>Use across any eligible class type</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span>Classes do not roll over after expiration</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Non-Member Access */}
              <div className="card-luxury p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Info className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl mb-2">Non-Member Access</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Non-member class passes provide access to studios only.
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span>Studio access for booked class</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span>Amenities not included</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Cancellation Policy */}
            <div className="card-luxury p-6 mt-6">
              <h3 className="font-serif text-xl mb-4">Cancellation Policy</h3>
              <p className="text-muted-foreground">
                Classes must be cancelled at least <strong className="text-foreground">24 hours in advance</strong> to 
                avoid forfeiting your class credit or pass. No-shows will result in the class being marked as used.
              </p>
            </div>
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
              Members receive discounted class pricing plus access to all club amenities, 
              spa services, and priority booking.
            </p>
            <Button variant="gold" size="lg" asChild>
              <Link to="/apply">Apply for Membership</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
