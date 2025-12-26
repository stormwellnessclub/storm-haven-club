import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, ArrowRight } from "lucide-react";

import gymArea2 from "@/assets/gym-area-2.jpg";

const membershipBenefits = [
  "Unlimited access to all fitness classes",
  "Priority booking for classes and amenities",
  "Complimentary towel and locker service",
  "Access to steam room, sauna, and cold plunge",
  "Member-only events and workshops",
  "Discounts on spa treatments and café",
  "Guest passes (2 per month)",
  "Dedicated member support",
];

export default function Apply() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    referral: "",
    goals: "",
    experience: "",
    schedule: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
        toast.error("Please fill in all required fields");
        return;
      }
      setStep(2);
    } else {
      toast.success("Application submitted! We'll be in touch within 48 hours.");
      setStep(3);
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-20 min-h-[40vh] flex items-center">
        <div className="absolute inset-0">
          <img src={gymArea2} alt="Gym" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/70 to-charcoal/50" />
        </div>
        <div className="relative z-10 container mx-auto px-6 py-20">
          <div className="max-w-xl">
            <p className="text-gold-light text-sm uppercase tracking-widest mb-4">
              Application-Based Membership
            </p>
            <h1 className="heading-display text-primary-foreground mb-6">
              Join Storm Wellness Club
            </h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed">
              Apply to become a member of our exclusive wellness community.
            </p>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Form */}
            <div>
              {/* Progress Steps */}
              <div className="flex items-center gap-4 mb-8">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      step >= s 
                        ? "bg-accent text-accent-foreground" 
                        : "bg-secondary text-muted-foreground"
                    }`}>
                      {step > s ? <Check className="w-4 h-4" /> : s}
                    </div>
                    <span className={`text-sm hidden sm:block ${
                      step >= s ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {s === 1 ? "Contact Info" : s === 2 ? "About You" : "Complete"}
                    </span>
                    {s < 3 && <div className="w-8 h-px bg-border hidden sm:block" />}
                  </div>
                ))}
              </div>

              {step === 3 ? (
                <div className="card-luxury p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
                    <Check className="w-8 h-8 text-accent" />
                  </div>
                  <h2 className="font-serif text-2xl mb-4">Application Received!</h2>
                  <p className="text-muted-foreground mb-6">
                    Thank you for your interest in Storm Wellness Club. Our membership team 
                    will review your application and contact you within 48 hours.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Check your email ({formData.email}) for confirmation.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="card-luxury p-8">
                    {step === 1 && (
                      <>
                        <h2 className="font-serif text-2xl mb-6">Contact Information</h2>
                        <div className="grid sm:grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label htmlFor="firstName">First Name *</Label>
                            <Input
                              id="firstName"
                              name="firstName"
                              value={formData.firstName}
                              onChange={handleInputChange}
                              placeholder="John"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName">Last Name *</Label>
                            <Input
                              id="lastName"
                              name="lastName"
                              value={formData.lastName}
                              onChange={handleInputChange}
                              placeholder="Doe"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="mb-4">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="john@example.com"
                            className="mt-1"
                          />
                        </div>
                        <div className="mb-4">
                          <Label htmlFor="phone">Phone Number *</Label>
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={handleInputChange}
                            placeholder="(123) 456-7890"
                            className="mt-1"
                          />
                        </div>
                        <div className="mb-6">
                          <Label htmlFor="referral">How did you hear about us?</Label>
                          <Input
                            id="referral"
                            name="referral"
                            value={formData.referral}
                            onChange={handleInputChange}
                            placeholder="Friend, Instagram, Google..."
                            className="mt-1"
                          />
                        </div>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <h2 className="font-serif text-2xl mb-6">Tell Us About Yourself</h2>
                        <div className="mb-4">
                          <Label htmlFor="goals">What are your wellness goals?</Label>
                          <Textarea
                            id="goals"
                            name="goals"
                            value={formData.goals}
                            onChange={handleInputChange}
                            placeholder="I want to improve my flexibility, build strength, reduce stress..."
                            className="mt-1 min-h-[100px]"
                          />
                        </div>
                        <div className="mb-4">
                          <Label htmlFor="experience">What is your fitness experience?</Label>
                          <select
                            id="experience"
                            name="experience"
                            value={formData.experience}
                            onChange={handleInputChange}
                            className="mt-1 w-full h-11 px-3 rounded-sm border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Select your experience level</option>
                            <option value="beginner">Beginner - New to fitness</option>
                            <option value="intermediate">Intermediate - Regular exerciser</option>
                            <option value="advanced">Advanced - Experienced athlete</option>
                          </select>
                        </div>
                        <div className="mb-6">
                          <Label htmlFor="schedule">When do you typically work out?</Label>
                          <select
                            id="schedule"
                            name="schedule"
                            value={formData.schedule}
                            onChange={handleInputChange}
                            className="mt-1 w-full h-11 px-3 rounded-sm border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Select your preferred time</option>
                            <option value="early-morning">Early Morning (5-8 AM)</option>
                            <option value="morning">Morning (8-11 AM)</option>
                            <option value="midday">Midday (11 AM - 2 PM)</option>
                            <option value="afternoon">Afternoon (2-5 PM)</option>
                            <option value="evening">Evening (5-8 PM)</option>
                            <option value="flexible">Flexible schedule</option>
                          </select>
                        </div>
                      </>
                    )}

                    <Button type="submit" size="lg" className="w-full">
                      {step === 1 ? (
                        <>Continue <ArrowRight className="ml-2 w-4 h-4" /></>
                      ) : (
                        "Submit Application"
                      )}
                    </Button>

                    {step === 2 && (
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back to Contact Info
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Benefits */}
            <div>
              <div className="sticky top-28">
                <h2 className="font-serif text-2xl mb-6">Membership Benefits</h2>
                <p className="text-muted-foreground mb-8">
                  As a Storm Wellness Club member, you'll enjoy exclusive access to our 
                  full range of premium amenities and services.
                </p>
                <ul className="space-y-4">
                  {membershipBenefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-accent" />
                      </div>
                      <span className="text-sm">{benefit}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-8 p-6 bg-secondary/50 rounded-sm">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Application Process:</strong>
                    <br />
                    After submitting your application, our membership team will review 
                    and contact you within 48 hours to schedule a tour and discuss 
                    membership options.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
