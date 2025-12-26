import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Baby, 
  Clock, 
  Shield, 
  Heart, 
  Users,
  Calendar,
  Lock
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Safe Environment",
    description: "Fully supervised space with trained childcare professionals.",
  },
  {
    icon: Heart,
    title: "Engaging Activities",
    description: "Age-appropriate activities, crafts, and educational play.",
  },
  {
    icon: Clock,
    title: "Flexible Hours",
    description: "Available during peak workout hours for your convenience.",
  },
  {
    icon: Users,
    title: "Small Groups",
    description: "Low child-to-caregiver ratios for personalized attention.",
  },
];

const hours = [
  { day: "Monday - Friday", time: "6:00 AM - 1:00 PM, 4:00 PM - 8:00 PM" },
  { day: "Saturday", time: "7:00 AM - 1:00 PM" },
  { day: "Sunday", time: "8:00 AM - 12:00 PM" },
];

const ageGroups = [
  { age: "Infants", range: "3 months - 1 year", spots: 4 },
  { age: "Toddlers", range: "1 - 3 years", spots: 8 },
  { age: "Preschool", range: "3 - 5 years", spots: 10 },
  { age: "School Age", range: "5 - 10 years", spots: 12 },
];

export default function KidsCare() {
  return (
    <Layout>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Baby className="w-5 h-5 text-accent" />
              <p className="text-accent text-sm uppercase tracking-widest">Members Only</p>
            </div>
            <h1 className="heading-display mb-6">Storm Kids Care</h1>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              Focus on your wellness while your little ones enjoy supervised activities 
              in our dedicated kids care space. Available exclusively to members with a Kids Care Pass.
            </p>
            <div className="flex items-center gap-4 p-4 bg-background border border-border rounded-sm">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Kids Care Pass Required</p>
                <p className="text-xs text-muted-foreground">
                  Purchase a Kids Care Pass to access booking. Available in Class Passes.
                </p>
              </div>
              <Link to="/class-passes" className="ml-auto">
                <Button variant="outline" size="sm">Get Pass</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="card-luxury p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-serif text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hours & Info */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Hours */}
            <div className="card-luxury p-8">
              <h3 className="font-serif text-2xl mb-6 flex items-center gap-3">
                <Clock className="w-6 h-6 text-accent" />
                Hours of Operation
              </h3>
              <div className="space-y-4">
                {hours.map((schedule, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-border last:border-0">
                    <span className="font-medium">{schedule.day}</span>
                    <span className="text-muted-foreground text-sm">{schedule.time}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-6">
                * Hours may vary on holidays. Check the app for current availability.
              </p>
            </div>

            {/* Age Groups */}
            <div className="card-luxury p-8">
              <h3 className="font-serif text-2xl mb-6 flex items-center gap-3">
                <Users className="w-6 h-6 text-accent" />
                Age Groups
              </h3>
              <div className="space-y-4">
                {ageGroups.map((group, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-border last:border-0">
                    <div>
                      <span className="font-medium">{group.age}</span>
                      <p className="text-muted-foreground text-sm">{group.range}</p>
                    </div>
                    <span className="text-sm text-accent">{group.spots} spots</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Booking */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <Calendar className="w-12 h-12 mx-auto mb-6 text-accent" />
            <h2 className="heading-section mb-4">Book Your Session</h2>
            <p className="text-muted-foreground mb-8">
              Reservations can be made up to 48 hours in advance. 
              Walk-ins accepted based on availability.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" disabled>
                <Lock className="w-4 h-4 mr-2" />
                Login to Book
              </Button>
              <Link to="/class-passes">
                <Button variant="outline" size="lg">
                  Purchase Kids Care Pass
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Must have active Kids Care Pass to make reservations.
            </p>
          </div>
        </div>
      </section>

      {/* Policies */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <SectionHeading
              title="Policies"
              subtitle="Please review our policies before your first visit."
            />
            <div className="card-luxury p-8">
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  Maximum 2-hour session per child per day
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  Parent/guardian must remain on premises during care session
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  Children must be in good health - no fever, runny nose, or contagious conditions
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  Diapers, bottles, and special care instructions must be provided
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                  Cancellations must be made at least 2 hours in advance
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
