import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Check, ArrowRight, ExternalLink, Loader2, CreditCard } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AgreementPDFViewer } from "@/components/AgreementPDFViewer";
import { useAgreements } from "@/hooks/useAgreements";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import gymArea2 from "@/assets/gym-area-2.jpg";

// Draft persistence for form data across redirects
// Uses BOTH localStorage and sessionStorage for mobile redirect resilience
const DRAFT_STORAGE_KEY = "storm_apply_draft_v2";
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DraftData {
  formData: typeof initialFormData;
  stripeCustomerId: string | null;
  savedAt: number;
  source?: "local" | "session";
}

const initialFormData = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
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
  paymentAcknowledged: false,
  membershipAgreementSigned: false,
  oneYearCommitment: false,
  authAcknowledgment: false,
  submissionConfirmation: false,
};

// Save to BOTH storages for maximum reliability on mobile
const saveDraft = (formData: typeof initialFormData, stripeCustomerId: string | null) => {
  const draft: DraftData = { formData, stripeCustomerId, savedAt: Date.now() };
  const json = JSON.stringify(draft);
  
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, json);
  } catch (e) {
    console.warn("[Draft] sessionStorage save failed:", e);
  }
  
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, json);
  } catch (e) {
    console.warn("[Draft] localStorage save failed:", e);
  }
};

// Load from sessionStorage first, fallback to localStorage
const loadDraft = (): DraftData | null => {
  let draft: DraftData | null = null;
  let source: "session" | "local" | null = null;

  // Try sessionStorage first
  try {
    const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (stored) {
      draft = JSON.parse(stored) as DraftData;
      source = "session";
    }
  } catch (e) {
    console.warn("[Draft] sessionStorage load failed:", e);
  }

  // Fallback to localStorage if sessionStorage empty/failed
  if (!draft) {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        draft = JSON.parse(stored) as DraftData;
        source = "local";
      }
    } catch (e) {
      console.warn("[Draft] localStorage load failed:", e);
    }
  }

  if (!draft) return null;

  // Expire drafts older than 24 hours
  if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
    clearDraft();
    return null;
  }

  draft.source = source || undefined;
  console.log(`[Draft] Loaded from ${source}Storage, saved ${Math.round((Date.now() - draft.savedAt) / 1000 / 60)} min ago`);
  return draft;
};

// Clear from BOTH storages
const clearDraft = () => {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {
    console.warn("[Draft] sessionStorage clear failed:", e);
  }
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {
    console.warn("[Draft] localStorage clear failed:", e);
  }
};

const membershipPlans = [
  { value: "Silver Membership", label: "Silver Membership – $200.00" },
  { value: "Gold Membership", label: "Gold Membership – $250.00" },
  { value: "Platinum Membership", label: "Platinum Membership – $350.00" },
  { value: "Diamond Membership", label: "Diamond Membership – $500.00" },
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

// Load draft ONCE at module init for synchronous hydration
const getInitialDraft = (): DraftData | null => {
  try {
    return loadDraft();
  } catch {
    return null;
  }
};

interface MembershipAgreementSectionProps {
  isSigned: boolean;
  onCheckboxChange: (checked: boolean) => void;
}

function MembershipAgreementSection({ isSigned, onCheckboxChange }: MembershipAgreementSectionProps) {
  const { data: membershipAgreements } = useAgreements("membership_agreement");
  
  const getPdfUrls = () => {
    if (!membershipAgreements || membershipAgreements.length === 0) return [];
    return membershipAgreements.map((a) => a.pdf_url).filter(Boolean);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Membership Agreement</CardTitle>
        <CardDescription>
          Please review and agree to the Membership Agreement before submitting your application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {membershipAgreements && membershipAgreements.length > 0 && (
          <AgreementPDFViewer
            pdfUrl={getPdfUrls()}
            title="Membership Agreement"
            height="500px"
            showControls={true}
          />
        )}
        <div className="flex items-start gap-3 p-4 rounded-lg border bg-secondary/30">
          <Checkbox
            id="membershipAgreement"
            checked={isSigned}
            onCheckedChange={onCheckboxChange}
            required
          />
          <Label htmlFor="membershipAgreement" className="font-normal cursor-pointer text-sm leading-relaxed">
            I have read, understand, and agree to the Membership Agreement terms and conditions stated above. *
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Apply() {
  const [searchParams] = useSearchParams();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingCard, setIsSavingCard] = useState(false);
  
  // Use lazy initializers to hydrate from draft BEFORE any effects run
  const [formData, setFormData] = useState(() => {
    const draft = getInitialDraft();
    if (draft?.formData) {
      console.log("[Apply] Hydrated formData from draft");
      return draft.formData;
    }
    return initialFormData;
  });
  
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(() => {
    const draft = getInitialDraft();
    if (draft?.stripeCustomerId) {
      console.log("[Apply] Hydrated stripeCustomerId from draft:", draft.stripeCustomerId);
      return draft.stripeCustomerId;
    }
    return null;
  });
  
  const isHydrated = useRef(false);
  const formDataRef = useRef(formData);
  
  // Keep ref in sync with state
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);
  
  // Mark as hydrated after first render
  useEffect(() => {
    isHydrated.current = true;
  }, []);

  // Check for successful card setup on return from Stripe
  // CRITICAL: Do NOT depend on formData - use ref to avoid overwriting with stale state
  useEffect(() => {
    const setupSuccess = searchParams.get("setup_success");
    const customerId = searchParams.get("customer_id");
    
    if (setupSuccess === "true" && customerId) {
      setStripeCustomerId(customerId);
      // Use formDataRef to get current form state without adding formData as dependency
      saveDraft(formDataRef.current, customerId);
      toast.success("Payment method saved successfully!");
      // Clear URL params without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  // Autosave draft with debounce (only after hydration)
  useEffect(() => {
    if (!isHydrated.current) return;
    
    const timeoutId = setTimeout(() => {
      saveDraft(formData, stripeCustomerId);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [formData, stripeCustomerId]);

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

  const handleSavePaymentMethod = async () => {
    // Validate required fields for card setup
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error("Please fill in your name and email first");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSavingCard(true);

    // Save draft immediately before redirecting
    saveDraft(formData, stripeCustomerId);
    console.log("[Apply] Saved draft before payment redirect");

    try {
      const response = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_application_setup",
          applicantEmail: formData.email,
          applicantName: `${formData.firstName} ${formData.lastName}`,
          successUrl: window.location.origin + window.location.pathname,
          cancelUrl: window.location.origin + window.location.pathname,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create payment session");
      }

      const { url } = response.data;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error creating payment setup:", error);
      toast.error("Failed to open payment setup. Please try again.");
      setIsSavingCard(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.gender ||
        !formData.address || !formData.city || !formData.state || !formData.zipCode || !formData.country ||
        !formData.email || !formData.phone || !formData.membershipPlan ||
        formData.wellnessGoals.length === 0 || formData.servicesInterested.length === 0 ||
        !formData.referredByMember || !formData.foundingMember ||
        !formData.creditCardAuth || !formData.paymentAcknowledged || !formData.membershipAgreementSigned ||
        !formData.oneYearCommitment || !formData.authAcknowledgment || !formData.submissionConfirmation) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate payment method is saved
    if (!stripeCustomerId) {
      toast.error("Please save your payment method before submitting");
      return;
    }

    // Validate input lengths for security
    const maxLengths: Record<string, number> = {
      firstName: 50,
      lastName: 50,
      gender: 10,
      address: 200,
      city: 100,
      state: 50,
      zipCode: 20,
      country: 100,
      email: 255,
      phone: 30,
      otherGoals: 500,
      otherServices: 500,
      otherMotivation: 500,
      lifestyleIntegration: 1000,
      holisticWellness: 1000,
      previousMember: 50,
      referredByMember: 50,
      foundingMember: 50,
    };

    for (const [field, maxLength] of Object.entries(maxLengths)) {
      const value = formData[field as keyof typeof formData];
      if (typeof value === 'string' && value.length > maxLength) {
        toast.error(`${field.replace(/([A-Z])/g, ' $1').trim()} is too long (max ${maxLength} characters)`);
        return;
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate array lengths
    if (formData.wellnessGoals.length > 10 || formData.servicesInterested.length > 10 || formData.motivations.length > 10) {
      toast.error("Too many selections");
      return;
    }

    setIsSubmitting(true);

    try {
      // Save application to database with stripe_customer_id
      const { error } = await supabase.from("membership_applications").insert({
        first_name: formData.firstName,
        last_name: formData.lastName,
        full_name: `${formData.firstName} ${formData.lastName}`,
        date_of_birth: formData.dateOfBirth,
        gender: formData.gender,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zipCode,
        country: formData.country,
        email: formData.email,
        phone: formData.phone,
        membership_plan: formData.membershipPlan,
        wellness_goals: formData.wellnessGoals,
        other_goals: formData.otherGoals || null,
        services_interested: formData.servicesInterested,
        other_services: formData.otherServices || null,
        previous_member: formData.previousMember || null,
        motivations: formData.motivations,
        other_motivation: formData.otherMotivation || null,
        lifestyle_integration: formData.lifestyleIntegration || null,
        holistic_wellness: formData.holisticWellness || null,
        referred_by_member: formData.referredByMember,
        founding_member: formData.foundingMember,
        payment_info_provided: true,
        credit_card_auth: formData.creditCardAuth,
        one_year_commitment: formData.oneYearCommitment,
        auth_acknowledgment: formData.authAcknowledgment,
        submission_confirmation: formData.submissionConfirmation,
        membership_agreement_signed: formData.membershipAgreementSigned,
        stripe_customer_id: stripeCustomerId,
      });

      if (error) {
        console.error("Error submitting application:", error);
        toast.error("There was an error submitting your application. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Send confirmation email (fire and forget, don't block submission)
      supabase.functions.invoke('send-email', {
        body: {
          type: 'application_submitted',
          to: formData.email,
          data: {
            name: `${formData.firstName} ${formData.lastName}`,
            membershipPlan: formData.membershipPlan,
          },
        },
      }).then(({ error: emailError }) => {
        if (emailError) {
          console.error("Failed to send confirmation email:", emailError);
        } else {
          console.log("Application confirmation email sent");
        }
      });

      // Clear draft on successful submission
      clearDraft();
      // Show success message
      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting application:", error);
      toast.error("There was an error submitting your application. Please try again.");
      setIsSubmitting(false);
    }
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
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="First Name"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Last Name"
                      className="mt-1"
                      required
                    />
                  </div>
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
                  <Label className="mb-3 block">Gender *</Label>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="gender-women"
                        name="gender"
                        value="Women"
                        checked={formData.gender === "Women"}
                        onChange={handleInputChange}
                        className="h-4 w-4 accent-accent"
                      />
                      <Label htmlFor="gender-women" className="font-normal cursor-pointer">
                        Women
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="gender-men"
                        name="gender"
                        value="Men"
                        checked={formData.gender === "Men"}
                        onChange={handleInputChange}
                        className="h-4 w-4 accent-accent"
                      />
                      <Label htmlFor="gender-men" className="font-normal cursor-pointer">
                        Men
                      </Label>
                    </div>
                  </div>
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

            {/* Payment Information */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Payment Information</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-sm mb-4">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Secure Payment Setup</strong>
                    <br /><br />
                    To complete your application, please save a payment method. Your card will be securely 
                    stored with our payment processor and will only be charged upon approval of your membership 
                    when you activate it. No charges will be made until you authorize the payment.
                  </p>
                </div>

                {/* Card Save Button / Status */}
                {stripeCustomerId ? (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">Payment Method Saved</p>
                      <p className="text-sm text-muted-foreground">Your card has been securely saved for future billing.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Click the button below to securely add your payment method. You'll be redirected to our 
                      secure payment processor and returned here to complete your application.
                    </p>
                    <Button
                      type="button"
                      variant="gold"
                      onClick={handleSavePaymentMethod}
                      disabled={isSavingCard || !formData.firstName || !formData.lastName || !formData.email}
                      className="w-full sm:w-auto"
                    >
                      {isSavingCard ? (
                        <>
                          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          Opening Payment Setup...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 w-4 h-4" />
                          Add Payment Method
                        </>
                      )}
                    </Button>
                    {(!formData.firstName || !formData.lastName || !formData.email) && (
                      <p className="text-xs text-amber-600">Please fill in your name and email above first.</p>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-3 mt-4">
                  <Checkbox
                    id="creditCardAuth"
                    checked={formData.creditCardAuth}
                    onCheckedChange={(checked) => handleCheckboxChange("creditCardAuth", checked as boolean)}
                    required
                  />
                  <Label htmlFor="creditCardAuth" className="font-normal cursor-pointer text-sm">
                    I authorize Storm Fitness and Wellness Center to charge my saved payment method upon membership activation. *
                  </Label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="paymentAcknowledged"
                    checked={formData.paymentAcknowledged}
                    onCheckedChange={(checked) => handleCheckboxChange("paymentAcknowledged", checked as boolean)}
                    required
                  />
                  <Label htmlFor="paymentAcknowledged" className="font-normal cursor-pointer text-sm">
                    I acknowledge that the initiation fee will be charged upon activation and I agree to the billing terms. *
                  </Label>
                </div>
              </div>
            </div>

            {/* Agreements */}
            <div className="card-luxury p-8 mb-8">
              <h2 className="font-serif text-2xl mb-6 text-accent">Agreements</h2>
              
              <div className="space-y-6">
                {/* Membership Agreement */}
                <MembershipAgreementSection
                  isSigned={formData.membershipAgreementSigned}
                  onCheckboxChange={(checked) => handleCheckboxChange("membershipAgreementSigned", checked as boolean)}
                />
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

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Application
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </section>
    </Layout>
  );
}
