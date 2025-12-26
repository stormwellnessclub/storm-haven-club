import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Check, ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import gymArea2 from "@/assets/gym-area-2.jpg";

const membershipPlans = [
  { value: "silver", label: "Silver Membership – $200.00" },
  { value: "gold", label: "Gold Membership – $250.00" },
  { value: "platinum", label: "Platinum Membership – $350.00" },
  { value: "diamond", label: "Diamond Membership – $500.00" },
];

const wellnessGoals = [
  "Weight Loss",
  "Muscle Gain",
  "Improved Flexibility",
  "Stress Reduction",
  "Holistic Health",
];

const servicesInterested = [
  "Fitness Classes",
  "Open Gym",
  "Spa Services",
  "Personal Training",
  "Nutritional Guidance",
];

const motivations = [
  "Comprehensive wellness approach",
  "Luxurious amenities",
  "Community and support",
  "Specific services (e.g., spa, personal training)",
];

export default function Apply() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United States of America (USA)",
    email: "",
    phone: "",
    membershipPlan: "",
    wellnessGoals: [] as string[],
    otherGoals: "",
    servicesInterested: [] as string[],
    otherServices: "",
    previousMember: "",
    motivations: [] as string[],
    otherMotivation: "",
    lifestyleIntegration: "",
    holisticWellness: "",
    referredByMember: "",
    foundingMember: "",
    creditCardAuth: false,
    nameOnCard: "",
    expiryDate: "",
    cardNumber: "",
    cvv: "",
    oneYearCommitment: false,
    authAcknowledgment: false,
    submissionConfirmation: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleMultiSelect = (field: "wellnessGoals" | "servicesInterested" | "motivations", value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v: string) => v !== value)
        : [...prev[field], value]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.fullName || !formData.dateOfBirth || !formData.address || 
        !formData.city || !formData.state || !formData.zipCode || !formData.country ||
        !formData.email || !formData.phone || !formData.membershipPlan ||
        formData.wellnessGoals.length === 0 || formData.servicesInterested.length === 0 ||
        !formData.referredByMember || !formData.foundingMember ||
        !formData.creditCardAuth || !formData.nameOnCard || !formData.expiryDate ||
        !formData.cardNumber || !formData.cvv || !formData.oneYearCommitment ||
        !formData.authAcknowledgment || !formData.submissionConfirmation) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Show success message
    setIsSubmitted(true);
  };

  if (isSubmitted) {
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
              <h1 className="heading-display text-primary-foreground mb-6">
                Thank You
              </h1>
            </div>
          </div>
        </section>

        <section className="py-16 bg-background">
          <div className="container mx-auto px-6 max-w-2xl">
            <div className="card-luxury p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Check className="w-10 h-10 text-accent" />
              </div>
              <h2 className="font-serif text-3xl mb-4">Thank You for Your Interest</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Your membership invitation request has been submitted successfully.
              </p>
              <p className="text-muted-foreground mb-8">
                Our membership team will review your application and you will hear back from us soon.
              </p>
              <Link to="/">
                <Button variant="gold" size="lg">
                  Return to Home
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

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
              Application
            </p>
            <h1 className="heading-display text-primary-foreground mb-6">
              Membership Application
            </h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed mb-6">
              Complete the form below to apply for membership. Please ensure all required 
              fields are filled out accurately to help us process your application quickly. 
              If you have any questions, contact us at contact@stormfitnessandwellness.com.
            </p>
            <Link to="/memberships">
              <Button variant="gold" size="lg">
                View Membership Tiers & Amenities
                <ExternalLink className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 max-w-3xl">
          <form onSubmit={handleSubmit}>
            {/* Personal Information */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Personal Information</h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Your Name"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Street Address"
                    className="mt-1"
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="City"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State/Province *</Label>
                    <Input
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="State"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zipCode">ZIP / Postal Code *</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      placeholder="ZIP Code"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="(123) 456-7890"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="membershipPlan">Which Membership Plan You Are Interested In? *</Label>
                  <select
                    id="membershipPlan"
                    name="membershipPlan"
                    value={formData.membershipPlan}
                    onChange={handleInputChange}
                    className="mt-1 w-full h-11 px-3 rounded-sm border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    <option value="">Please Choose</option>
                    {membershipPlans.map((plan) => (
                      <option key={plan.value} value={plan.value}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Wellness Goals and Interests */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Wellness Goals and Interests</h2>
              
              <div className="space-y-6">
                <div>
                  <Label className="mb-3 block">What are your primary health and wellness goals? (Select all that apply) *</Label>
                  <div className="space-y-2">
                    {wellnessGoals.map((goal) => (
                      <div key={goal} className="flex items-center gap-3">
                        <Checkbox
                          id={`goal-${goal}`}
                          checked={formData.wellnessGoals.includes(goal)}
                          onCheckedChange={() => handleMultiSelect("wellnessGoals", goal)}
                        />
                        <Label htmlFor={`goal-${goal}`} className="font-normal cursor-pointer">
                          {goal}
                        </Label>
                      </div>
                    ))}
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="goal-other"
                        checked={formData.wellnessGoals.includes("Other")}
                        onCheckedChange={() => handleMultiSelect("wellnessGoals", "Other")}
                      />
                      <Label htmlFor="goal-other" className="font-normal cursor-pointer">
                        Other (Please specify below)
                      </Label>
                    </div>
                    {formData.wellnessGoals.includes("Other") && (
                      <Input
                        name="otherGoals"
                        value={formData.otherGoals}
                        onChange={handleInputChange}
                        placeholder="Please specify..."
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">Which of our services are you most interested in? (Select all that apply) *</Label>
                  <div className="space-y-2">
                    {servicesInterested.map((service) => (
                      <div key={service} className="flex items-center gap-3">
                        <Checkbox
                          id={`service-${service}`}
                          checked={formData.servicesInterested.includes(service)}
                          onCheckedChange={() => handleMultiSelect("servicesInterested", service)}
                        />
                        <Label htmlFor={`service-${service}`} className="font-normal cursor-pointer">
                          {service}
                        </Label>
                      </div>
                    ))}
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="service-other"
                        checked={formData.servicesInterested.includes("Other")}
                        onCheckedChange={() => handleMultiSelect("servicesInterested", "Other")}
                      />
                      <Label htmlFor="service-other" className="font-normal cursor-pointer">
                        Other (Please specify below)
                      </Label>
                    </div>
                    {formData.servicesInterested.includes("Other") && (
                      <Input
                        name="otherServices"
                        value={formData.otherServices}
                        onChange={handleInputChange}
                        placeholder="Please specify..."
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Wellness Background */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Wellness Background</h2>
              
              <div>
                <Label className="mb-3 block">Have you previously been a member of a fitness center, or wellness club?</Label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="previousMember-yes"
                      name="previousMember"
                      value="yes"
                      checked={formData.previousMember === "yes"}
                      onChange={handleInputChange}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="previousMember-yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="previousMember-no"
                      name="previousMember"
                      value="no"
                      checked={formData.previousMember === "no"}
                      onChange={handleInputChange}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="previousMember-no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Motivation for Joining */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Motivation for Joining</h2>
              
              <div>
                <Label className="mb-3 block">Why have you chosen Storm Fitness and Wellness Center for your wellness journey? (Select all that apply)</Label>
                <div className="space-y-2">
                  {motivations.map((motivation) => (
                    <div key={motivation} className="flex items-center gap-3">
                      <Checkbox
                        id={`motivation-${motivation}`}
                        checked={formData.motivations.includes(motivation)}
                        onCheckedChange={() => handleMultiSelect("motivations", motivation)}
                      />
                      <Label htmlFor={`motivation-${motivation}`} className="font-normal cursor-pointer">
                        {motivation}
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="motivation-other"
                      checked={formData.motivations.includes("Other")}
                      onCheckedChange={() => handleMultiSelect("motivations", "Other")}
                    />
                    <Label htmlFor="motivation-other" className="font-normal cursor-pointer">
                      Other (Please share)
                    </Label>
                  </div>
                  {formData.motivations.includes("Other") && (
                    <Input
                      name="otherMotivation"
                      value={formData.otherMotivation}
                      onChange={handleInputChange}
                      placeholder="Please share..."
                      className="mt-2"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Getting to Know You Better */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Getting to Know You Better</h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lifestyleIntegration">
                    Please share a little about your lifestyle and how you envision integrating the wellness center into your daily routine.
                  </Label>
                  <Textarea
                    id="lifestyleIntegration"
                    name="lifestyleIntegration"
                    value={formData.lifestyleIntegration}
                    onChange={handleInputChange}
                    className="mt-1 min-h-[100px]"
                  />
                </div>

                <div>
                  <Label htmlFor="holisticWellness">
                    What does holistic wellness mean to you, and how do you hope to achieve it with us?
                  </Label>
                  <Textarea
                    id="holisticWellness"
                    name="holisticWellness"
                    value={formData.holisticWellness}
                    onChange={handleInputChange}
                    className="mt-1 min-h-[100px]"
                  />
                </div>

                <div>
                  <Label className="mb-3 block">Were you referred by a current member? *</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="referredByMember-yes"
                        name="referredByMember"
                        value="yes"
                        checked={formData.referredByMember === "yes"}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                        required
                      />
                      <Label htmlFor="referredByMember-yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="referredByMember-no"
                        name="referredByMember"
                        value="no"
                        checked={formData.referredByMember === "no"}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                        required
                      />
                      <Label htmlFor="referredByMember-no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alignment with Our Wellness Community */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Alignment with Our Wellness Community</h2>
              
              <div>
                <Label className="mb-3 block">Would you like to become a founding member? *</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  We are limiting our Founding Members to a total of 100. You can become a Founding Member 
                  by paying your membership annually in advance. This status grants you a special founding 
                  member card, exclusive branded apparel, a premium gym bag, and priority access to all 
                  private events. You'll also receive behind-the-scenes information and play a pivotal role 
                  in shaping our transformative community.
                </p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="foundingMember-yes"
                      name="foundingMember"
                      value="yes"
                      checked={formData.foundingMember === "yes"}
                      onChange={handleInputChange}
                      className="w-4 h-4"
                      required
                    />
                    <Label htmlFor="foundingMember-yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="foundingMember-no"
                      name="foundingMember"
                      value="no"
                      checked={formData.foundingMember === "no"}
                      onChange={handleInputChange}
                      className="w-4 h-4"
                      required
                    />
                    <Label htmlFor="foundingMember-no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Payment Details</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-sm mb-4">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Credit Card Initiation Authorization Notice</strong>
                    <br /><br />
                    As part of the application process for membership at Storm Fitness and Wellness Center, 
                    we require all applicants to provide valid credit card information. Please note that no 
                    charges will be made to your card at the time of application. Your credit card will only 
                    be charged the initiation fee upon the approval of your membership application. This policy 
                    ensures a seamless transition into our community for approved members.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="creditCardAuth"
                    checked={formData.creditCardAuth}
                    onCheckedChange={(checked) => handleCheckboxChange("creditCardAuth", checked as boolean)}
                    required
                  />
                  <Label htmlFor="creditCardAuth" className="font-normal cursor-pointer text-sm">
                    I have read, understand, and agree to abide by the terms and conditions stated on this application. *
                  </Label>
                </div>

                <div>
                  <Label htmlFor="nameOnCard">Name on Card *</Label>
                  <Input
                    id="nameOnCard"
                    name="nameOnCard"
                    value={formData.nameOnCard}
                    onChange={handleInputChange}
                    className="mt-1"
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="expiryDate">Expiry Date *</Label>
                    <Input
                      id="expiryDate"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      placeholder="MM/YY"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cardNumber">Card Number *</Label>
                    <Input
                      id="cardNumber"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={handleInputChange}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvv">CVC/CVV *</Label>
                    <Input
                      id="cvv"
                      name="cvv"
                      value={formData.cvv}
                      onChange={handleInputChange}
                      className="mt-1"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Agreements */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Agreements</h2>
              
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong className="text-foreground">One-Year Membership Commitment</strong>
                    <br /><br />
                    Please note that all memberships at Storm Fitness and Wellness Center require a minimum 
                    commitment of one year. This commitment ensures that members fully experience the transformative 
                    benefits of our wellness community. Your membership will commence upon the opening of our new 
                    facility and extend for at least one year, providing you with continuous access to our exclusive 
                    amenities and services.
                  </p>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="oneYearCommitment"
                      checked={formData.oneYearCommitment}
                      onCheckedChange={(checked) => handleCheckboxChange("oneYearCommitment", checked as boolean)}
                      required
                    />
                    <Label htmlFor="oneYearCommitment" className="font-normal cursor-pointer text-sm">
                      I have read, understand, and agree to abide by the terms and conditions stated on this application. *
                    </Label>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong className="text-foreground">Authorization and Acknowledgment of Initiation Fee and Membership Commitment</strong>
                    <br /><br />
                    By submitting this application, I understand and agree that, upon approval of my membership at 
                    Storm Fitness and Wellness Center, the initiation fee as outlined in the membership details will 
                    be charged to the credit card provided in this application. I hereby authorize Storm Fitness and 
                    Wellness Center to process this charge upon the confirmation of my membership acceptance. Additionally, 
                    I acknowledge that all memberships require a one-year commitment, starting from the opening of the 
                    new facility.
                  </p>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="authAcknowledgment"
                      checked={formData.authAcknowledgment}
                      onCheckedChange={(checked) => handleCheckboxChange("authAcknowledgment", checked as boolean)}
                      required
                    />
                    <Label htmlFor="authAcknowledgment" className="font-normal cursor-pointer text-sm">
                      I have read, understand, and agree to abide by the terms and conditions stated on this application. *
                    </Label>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong className="text-foreground">Submission Instructions</strong>
                    <br /><br />
                    Review your application to ensure all information is accurate and complete. Submitting this form 
                    is the first step toward becoming part of a community that values holistic wellness and personal 
                    growth. We're excited to learn more about you and explore how we can support your wellness journey together.
                  </p>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="submissionConfirmation"
                      checked={formData.submissionConfirmation}
                      onCheckedChange={(checked) => handleCheckboxChange("submissionConfirmation", checked as boolean)}
                      required
                    />
                    <Label htmlFor="submissionConfirmation" className="font-normal cursor-pointer text-sm">
                      I have reviewed my application and confirm that all information is accurate to the best of my knowledge. *
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full">
              Submit Application
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>
        </div>
      </section>
    </Layout>
  );
}
