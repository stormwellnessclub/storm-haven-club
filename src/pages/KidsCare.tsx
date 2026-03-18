import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { 
  Baby, 
  Clock, 
  Shield, 
  Heart, 
  Users,
  Calendar,
  Lock,
  Moon,
  CheckCircle2,
  Loader2,
  CreditCard,
  Sparkles
} from "lucide-react";
import { KidsCareBookingModal } from "@/components/booking/KidsCareBookingModal";
import { useAuth } from "@/contexts/AuthContext";
import { useJoinKidsCareInterest } from "@/hooks/useKidsCareInterest";
import { useKidsCareHoursForWeek } from "@/hooks/useKidsCareHours";
import { useKidsCarePasses } from "@/hooks/useKidsCareBooking";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/timeFormat";

// Soft launch mode - now disabled, hours are dynamic
const isSoftLaunch = false;

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

// Updated hours for regular operation
// Hours are now fetched dynamically from the database

// Two-room structure
const rooms = [
  {
    name: "Little Stars Room",
    icon: "🍼",
    ageGroups: [
      { name: "Infants", range: "3 months - 1 year" },
      { name: "Toddlers", range: "1 - 3 years" },
    ],
    capacity: 8,
  },
  {
    name: "Big Stars Room",
    icon: "🌟",
    ageGroups: [
      { name: "Preschool", range: "3 - 5 years" },
      { name: "School Age", range: "5 - 10 years" },
    ],
    capacity: 6,
  },
];

export default function KidsCare() {
  const { user } = useAuth();
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { data: weeklyHours, isLoading: hoursLoading } = useKidsCareHoursForWeek(new Date());

  const { data: availablePasses, isLoading: passesLoading } = useKidsCarePasses();
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const hasActivePass = availablePasses && availablePasses.length > 0;

  const handlePurchasePass = async () => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }

    setPurchaseLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_kids_care_checkout",
          successUrl: `${window.location.origin}/kids-care?success=true`,
          cancelUrl: `${window.location.origin}/kids-care`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
      setPurchaseLoading(false);
    }
  };
  
  // Interest form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: user?.email || "",
    phone: "",
    childrenCount: 1,
    childrenAges: "",
    notes: "",
  });

  const joinInterest = useJoinKidsCareInterest();

  const handleInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.childrenAges) {
      return;
    }

    try {
      await joinInterest.mutateAsync(formData);
      setSubmitted(true);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Layout>
      <SEOHead title="Kids Care" description="Supervised childcare while you work out at Storm Wellness Club. Safe, engaging environment for children of members in Livonia, MI." path="/kids-care" />
      {/* Soft Launch Banner */}
      {isSoftLaunch && (
        <section className="bg-accent/10 border-b border-accent/20">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-3 justify-center text-center">
              <Moon className="w-5 h-5 text-accent" />
              <div>
                <p className="font-medium text-foreground">Coming Soon</p>
                <p className="text-sm text-muted-foreground">
                  Kids Care booking will open soon. Soft launch hours will be shared this week.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

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
            {hasActivePass ? (
              <div className="flex items-center gap-4 p-4 bg-accent/10 border border-accent/30 rounded-sm">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm font-medium text-accent">Kids Care Pass Active</p>
                  <p className="text-xs text-muted-foreground">
                    {availablePasses[0].classes_remaining} session{availablePasses[0].classes_remaining !== 1 ? "s" : ""} remaining
                  </p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => setShowBookingModal(true)}>
                  Book Now
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-background border border-border rounded-sm">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Kids Care Pass Required</p>
                  <p className="text-xs text-muted-foreground">
                    $75/month per child — 4 sessions, 2hr max each, auto-renews.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={handlePurchasePass} disabled={purchaseLoading}>
                  {purchaseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get Pass"}
                </Button>
              </div>
            )}
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

      {/* Hours & Rooms */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Hours */}
            <div className="card-luxury p-8">
              <h3 className="font-serif text-2xl mb-6 flex items-center gap-3">
                <Clock className="w-6 h-6 text-accent" />
                Hours of Operation
              </h3>
              
              {hoursLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : weeklyHours && weeklyHours.length > 0 ? (
                <div className="space-y-4">
                  {weeklyHours.filter(h => !h.is_closed).map((entry) => (
                    <div key={entry.day_of_week} className="flex justify-between items-center py-3 border-b border-border last:border-0">
                      <span className="font-medium">{DAY_NAMES[entry.day_of_week]}</span>
                      <span className="text-muted-foreground text-sm">
                        {formatTime12h(entry.open_time)} - {formatTime12h(entry.close_time)}
                      </span>
                    </div>
                  ))}
                  {weeklyHours.filter(h => !h.is_closed).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Closed this week</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Hours for this week haven't been published yet. Check back soon!
                </p>
              )}
              <p className="text-xs text-accent mt-6 flex items-center gap-2">
                <Moon className="w-4 h-4" />
                Soft launch — hours may change weekly as we expand.
              </p>
            </div>

            {/* Two Rooms */}
            <div className="card-luxury p-8">
              <h3 className="font-serif text-2xl mb-6 flex items-center gap-3">
                <Users className="w-6 h-6 text-accent" />
                Our Two Rooms
              </h3>
              <div className="space-y-6">
                {rooms.map((room, index) => (
                  <div key={index} className="pb-6 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{room.icon}</span>
                      <h4 className="font-medium text-lg">{room.name}</h4>
                    </div>
                    <div className="space-y-2 ml-10">
                      {room.ageGroups.map((group, gIndex) => (
                        <div key={gIndex} className="text-sm">
                          <span className="text-foreground">{group.name}</span>
                          <span className="text-muted-foreground ml-2">({group.range})</span>
                        </div>
                      ))}
                      <p className="text-sm text-accent mt-2">
                        Capacity: {room.capacity} children
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-lg mx-auto">
            <SectionHeading
              title="Kids Care Pass"
              subtitle="Monthly subscription for members — one pass per child."
            />
            <div className="card-luxury p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                MEMBER
              </div>
              <Sparkles className="w-10 h-10 mx-auto mb-4 text-accent" />
              <div className="mb-2">
                <span className="text-4xl font-serif font-bold text-foreground">$75</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">per child • auto-renews • cancel anytime</p>
              <ul className="text-sm text-left space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>4 sessions per month (2-hour max each)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>30-day validity — sessions reset each cycle</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>Cancel anytime — no proration, no penalties</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>Add-on hours available at $15/hr per child</span>
                </li>
              </ul>
              {hasActivePass ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-accent font-medium">
                    <CheckCircle2 className="w-5 h-5" />
                    Pass Active — {availablePasses[0].classes_remaining} sessions left
                  </div>
                  <Button size="lg" className="w-full" onClick={() => setShowBookingModal(true)}>
                    <Calendar className="w-4 h-4 mr-2" />
                    Book a Session
                  </Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handlePurchasePass}
                  disabled={purchaseLoading || !user}
                >
                  {purchaseLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    <><CreditCard className="w-4 h-4 mr-2" /> Subscribe — $75/mo</>
                  )}
                </Button>
              )}
              {!user && (
                <p className="text-xs text-muted-foreground mt-3">
                  <a href="/auth" className="text-accent underline">Sign in</a> to purchase
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Booking / Interest Waitlist Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            {isSoftLaunch ? (
              <>
                {submitted ? (
                <div className="card-luxury p-8">
                    <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-accent" />
                    <h2 className="heading-section mb-4">You're on the List!</h2>
                    <p className="text-muted-foreground">
                      Thank you for your interest in Storm Kids Care. We'll notify you when booking opens.
                    </p>
                  </div>
                ) : (
                  <>
                    <Calendar className="w-12 h-12 mx-auto mb-6 text-accent" />
                    <h2 className="heading-section mb-4">Join the Interest Waitlist</h2>
                    <p className="text-muted-foreground mb-8">
                      Be the first to know when Kids Care booking opens. 
                      Help us gauge demand by signing up below.
                    </p>
                    
                    <form onSubmit={handleInterestSubmit} className="card-luxury p-8 text-left space-y-6">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            placeholder="Your first name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            placeholder="Your last name"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="your@email.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone (Optional)</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="(555) 123-4567"
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="childrenCount">Number of Children</Label>
                          <Input
                            id="childrenCount"
                            type="number"
                            min={1}
                            max={10}
                            value={formData.childrenCount}
                            onChange={(e) => setFormData({ ...formData, childrenCount: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="childrenAges">Children's Ages *</Label>
                          <Input
                            id="childrenAges"
                            required
                            value={formData.childrenAges}
                            onChange={(e) => setFormData({ ...formData, childrenAges: e.target.value })}
                            placeholder="e.g., 2, 4, 6"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Any Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Tell us about your childcare needs..."
                          rows={3}
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        size="lg"
                        disabled={joinInterest.isPending}
                      >
                        {joinInterest.isPending ? "Submitting..." : "Join Interest Waitlist"}
                      </Button>

                      <p className="text-xs text-muted-foreground text-center">
                        Each Kids Care Pass covers one child only. Separate passes required for multiple children.
                      </p>
                    </form>
                  </>
                )}
              </>
            ) : (
              <>
                <Calendar className="w-12 h-12 mx-auto mb-6 text-accent" />
                <h2 className="heading-section mb-4">Book Your Session</h2>
                <p className="text-muted-foreground mb-8">
                  Reservations can be made up to 48 hours in advance. 
                  Walk-ins accepted based on availability.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {user ? (
                    <Button 
                      size="lg" 
                      onClick={() => setShowBookingModal(true)}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Kids Care Session
                    </Button>
                  ) : (
                    <Button 
                      size="lg" 
                      onClick={() => {
                        window.location.href = "/auth";
                      }}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Login to Book
                    </Button>
                  )}
                  <Link to="/class-passes">
                    <Button variant="outline" size="lg">
                      Purchase Kids Care Pass
                    </Button>
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Must have active Kids Care Pass to make reservations. Each pass covers one child only.
                </p>
              </>
            )}
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
                  <strong className="text-foreground">Each Kids Care Pass is valid for one child only.</strong> Separate passes required for multiple children.
                </li>
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

      {/* Booking Modal (for when soft launch ends) */}
      <KidsCareBookingModal
        open={showBookingModal}
        onOpenChange={setShowBookingModal}
      />
    </Layout>
  );
}
