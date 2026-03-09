import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, AlertCircle, FileText, Download } from "lucide-react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { loadStripe } from "@stripe/stripe-js";
// AgreementPDFViewer removed — now using download-only UI for all devices
import { useAgreements } from "@/hooks/useAgreements";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationProgress, getStepCompletion, APPLICATION_STEPS } from "@/components/ApplicationProgress";
import { PaymentSectionEnhanced, CardDetails } from "@/components/PaymentSectionEnhanced";
import { ApplicationValidationSummary } from "@/components/ApplicationValidationSummary";
import { DraftSaveIndicator } from "@/components/DraftSaveIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolvePdfUrl } from "@/lib/pdfAssets";

import gymArea2 from "@/assets/gym-area-2.jpg";

// Draft persistence for form data across redirects
// Uses BOTH localStorage and sessionStorage for mobile redirect resilience
const DRAFT_STORAGE_KEY = "storm_apply_draft_v2";
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DraftData {
  formData: typeof initialFormData;
  stripeCustomerId: string | null;
  isCardConfirmed: boolean;
  savedAt: number;
  source?: "local" | "session";
  cardDetails?: CardDetails | null;
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
const saveDraft = (
  formData: typeof initialFormData, 
  stripeCustomerId: string | null, 
  isCardConfirmed: boolean = false,
  cardDetails?: CardDetails | null
) => {
  const draft: DraftData = { formData, stripeCustomerId, isCardConfirmed, savedAt: Date.now(), cardDetails };
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
  const { data: membershipAgreements, isLoading: agreementsLoading } = useAgreements("membership_agreement");
  const isMobile = useIsMobile();
  
  const getPdfUrls = () => {
    if (!membershipAgreements || membershipAgreements.length === 0) return [];
    return membershipAgreements.map((a) => a.pdf_url).filter(Boolean);
  };

  const pdfUrls = getPdfUrls();

  const downloadPdf = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">Membership Agreement</CardTitle>
        <CardDescription>
          Please review and agree to the Membership Agreement before submitting your application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {agreementsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading agreement...</p>
            </div>
          </div>
        ) : pdfUrls.length > 0 ? (
          <div className="space-y-3">
            {pdfUrls.map((url, index) => {
              const resolvedUrl = resolvePdfUrl(url);
              const filename = typeof url === 'string' ? (url.split('/').pop() || 'membership-agreement.pdf') : `agreement-${index + 1}.pdf`;
              return (
                <div key={index} className="flex flex-col items-center gap-3 p-5 rounded-lg border bg-muted/30">
                  <FileText className="h-10 w-10 text-accent" />
                  <p className="text-sm font-medium text-center">Membership Agreement{pdfUrls.length > 1 ? ` (${index + 1})` : ''}</p>
                  <div className={`flex gap-2 w-full ${isMobile ? 'flex-col' : 'flex-row justify-center'}`}>
                    <Button size="lg" className="gap-2" onClick={() => downloadPdf(resolvedUrl, filename)}>
                      <Download className="h-4 w-4" />
                      Download Agreement
                    </Button>
                    <Button variant="outline" size="lg" className="gap-2" asChild>
                      <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open in Browser
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* No PDF available — show download fallback to the static file */
          <div className="flex flex-col items-center gap-3 p-5 rounded-lg border bg-muted/30">
            <FileText className="h-10 w-10 text-accent" />
            <p className="text-sm font-medium">Membership Agreement</p>
            <div className={`flex gap-2 w-full ${isMobile ? 'flex-col' : 'flex-row justify-center'}`}>
              <Button size="lg" className="gap-2" onClick={() => downloadPdf(resolvePdfUrl('membership-agreement.pdf'), 'membership-agreement.pdf')}>
                <Download className="h-4 w-4" />
                Download Agreement
              </Button>
              <Button variant="outline" size="lg" className="gap-2" asChild>
                <a href={resolvePdfUrl('membership-agreement.pdf')} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open in Browser
                </a>
              </Button>
            </div>
          </div>
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

// ApplicationPaymentForm has been moved to PaymentSectionEnhanced component

export default function Apply() {
  const [searchParams] = useSearchParams();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [currentStepId, setCurrentStepId] = useState("personal");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedApplicationId, setSavedApplicationId] = useState<string | null>(null);
  
  // Section refs for scroll tracking
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Use lazy initializers to hydrate from draft BEFORE any effects run
  const [formData, setFormData] = useState(() => {
    const draft = getInitialDraft();
    if (draft?.formData) {
      console.log("[Apply] Hydrated formData from draft");
      return draft.formData;
    }
    return initialFormData;
  });
  
  // CRITICAL FIX: Always restore stripeCustomerId from draft, even if card isn't confirmed yet
  // This is needed for 3DS redirect recovery - the customer was created before redirect
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(() => {
    const draft = getInitialDraft();
    if (draft?.stripeCustomerId) {
      console.log("[Apply] Hydrated stripeCustomerId from draft:", draft.stripeCustomerId, "isCardConfirmed:", draft.isCardConfirmed);
      return draft.stripeCustomerId;
    }
    return null;
  });
  
  // Track whether card was actually confirmed (not just customer created)
  const [isCardConfirmed, setIsCardConfirmed] = useState<boolean>(() => {
    const draft = getInitialDraft();
    return draft?.isCardConfirmed === true;
  });
  
  // Store card details for display and submission
  const [savedCardDetails, setSavedCardDetails] = useState<CardDetails | null>(() => {
    const draft = getInitialDraft();
    return draft?.cardDetails || null;
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

  // Check for successful card setup on return from Stripe (legacy setup_success params)
  // CRITICAL: Do NOT depend on formData - use ref to avoid overwriting with stale state
  useEffect(() => {
    const setupSuccess = searchParams.get("setup_success");
    const customerId = searchParams.get("customer_id");
    
    if (setupSuccess === "true" && customerId) {
      setStripeCustomerId(customerId);
      setIsCardConfirmed(true);
      // Use formDataRef to get current form state without adding formData as dependency
      saveDraft(formDataRef.current, customerId, true);
      toast.success("Payment method saved successfully!");
      // Clear URL params without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  // CRITICAL: Handle 3DS redirect returns from Stripe
  // When Stripe redirects back after 3DS authentication, we need to finalize the SetupIntent
  const location = useLocation();
  
  useEffect(() => {
    const handleStripeReturn = async () => {
      const urlParams = new URLSearchParams(location.search);
      const setupIntentClientSecret = urlParams.get("setup_intent_client_secret");
      const setupIntentId = urlParams.get("setup_intent");
      const redirectStatus = urlParams.get("redirect_status");
      
      // Only process if we have Stripe return params AND card is not already confirmed
      if (!setupIntentClientSecret || isCardConfirmed) {
        return;
      }
      
      console.log("[Apply] Detected Stripe 3DS return:", { 
        setupIntentId, 
        redirectStatus,
        hasClientSecret: !!setupIntentClientSecret,
        existingCustomerId: stripeCustomerId 
      });
      
      // Check redirect status first
      if (redirectStatus === "failed") {
        toast.error("Card authentication failed. Please try again.");
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      try {
        // Get Stripe publishable key
        let publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        
        if (!publishableKey || !publishableKey.startsWith("pk_")) {
          console.log("[Apply] Fetching Stripe key from backend...");
          const { data: configData, error: configError } = await supabase.functions.invoke("stripe-config");
          if (configError || !configData?.publishableKey) {
            throw new Error("Could not retrieve Stripe configuration");
          }
          publishableKey = configData.publishableKey;
        }
        
        // Initialize Stripe and retrieve the SetupIntent
        const stripe = await loadStripe(publishableKey);
        if (!stripe) {
          throw new Error("Failed to initialize Stripe");
        }
        
        console.log("[Apply] Retrieving SetupIntent...");
        const { setupIntent, error: retrieveError } = await stripe.retrieveSetupIntent(setupIntentClientSecret);
        
        if (retrieveError) {
          console.error("[Apply] Failed to retrieve SetupIntent:", retrieveError);
          throw new Error(retrieveError.message || "Failed to verify card setup");
        }
        
        if (!setupIntent) {
          throw new Error("SetupIntent not found");
        }
        
        console.log("[Apply] SetupIntent status:", setupIntent.status, setupIntent);
        
        if (setupIntent.status !== "succeeded") {
          if (setupIntent.status === "processing") {
            toast.info("Card setup is processing. Please wait...");
          } else {
            toast.error(`Card setup incomplete (${setupIntent.status}). Please try again.`);
          }
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        // SetupIntent succeeded - determine customer ID
        // Priority: 1) existing state, 2) draft, 3) setupIntent.customer (via type assertion)
        let finalCustomerId = stripeCustomerId;
        if (!finalCustomerId) {
          const draft = loadDraft();
          finalCustomerId = draft?.stripeCustomerId || null;
        }
        // Stripe's SetupIntent may include customer but TypeScript types don't always reflect it
        const setupIntentAny = setupIntent as any;
        if (!finalCustomerId && setupIntentAny.customer) {
          finalCustomerId = typeof setupIntentAny.customer === "string" 
            ? setupIntentAny.customer 
            : setupIntentAny.customer?.id;
        }
        
        if (!finalCustomerId) {
          console.error("[Apply] Could not determine customer ID after 3DS return");
          toast.error("Unable to verify payment setup. Please try again.");
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        console.log("[Apply] 3DS return successful, customer:", finalCustomerId);
        
        // Fetch card details with retry logic
        let cardDetails: CardDetails | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 2000 : 1500));
          
          try {
            console.log(`[Apply] Fetching card details attempt ${attempt}/3...`);
            const { data: pmData, error: pmError } = await supabase.functions.invoke("stripe-payment", {
              body: {
                action: "list_application_payment_methods",
                stripeCustomerId: finalCustomerId,
              },
            });
            
            if (pmError) {
              console.warn(`[Apply] Card fetch attempt ${attempt} error:`, pmError);
              continue;
            }
            
            if (pmData?.paymentMethods?.[0]) {
              const card = pmData.paymentMethods[0];
              cardDetails = {
                brand: card.brand || null,
                last4: card.last4 || null,
                expMonth: card.expMonth || null,
                expYear: card.expYear || null,
              };
              console.log("[Apply] Card details fetched:", cardDetails);
              break;
            }
          } catch (err) {
            console.warn(`[Apply] Card fetch attempt ${attempt} exception:`, err);
          }
        }
        
        // Update state
        setStripeCustomerId(finalCustomerId);
        setIsCardConfirmed(true);
        setSavedCardDetails(cardDetails);
        setShowPaymentForm(false);
        setPaymentClientSecret(null);
        
        // Save draft
        saveDraft(formDataRef.current, finalCustomerId, true, cardDetails);
        
        toast.success("Payment method saved successfully!");
        
        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        
      } catch (err) {
        console.error("[Apply] Error handling 3DS return:", err);
        toast.error(err instanceof Error ? err.message : "Failed to verify card setup");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    
    handleStripeReturn();
  }, [location.search, isCardConfirmed, stripeCustomerId]);

  // Autosave draft with debounce (only after hydration)
  useEffect(() => {
    if (!isHydrated.current) return;
    
    const timeoutId = setTimeout(() => {
      saveDraft(formData, stripeCustomerId, isCardConfirmed, savedCardDetails);
      setLastSavedAt(Date.now());
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [formData, stripeCustomerId, isCardConfirmed, savedCardDetails]);

  // Calculate step completion for progress
  const steps = getStepCompletion(formData, stripeCustomerId, isCardConfirmed);

  // Scroll to section helper
  const scrollToSection = (stepId: string) => {
    const ref = sectionRefs.current[stepId];
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentStepId(stepId);
    }
  };

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
    setIsCardConfirmed(false); // Reset card confirmation when starting new setup

    // Save draft immediately (mark card as NOT confirmed during setup)
    saveDraft(formData, stripeCustomerId, false, null);
    console.log("[Apply] Saved draft before payment setup");

    try {
      // Save application with pending_payment status BEFORE opening Stripe card form
      // This ensures we never lose an applicant even if they abandon the card step
      if (!savedApplicationId) {
        console.log("[Apply] Saving application with pending_payment status...");
        const { data: appData, error: appError } = await supabase.from("membership_applications").insert({
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: `${formData.firstName} ${formData.lastName}`,
          date_of_birth: formData.dateOfBirth || null,
          gender: formData.gender || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zipCode || null,
          country: formData.country || null,
          email: formData.email,
          phone: formData.phone || null,
          membership_plan: formData.membershipPlan || null,
          wellness_goals: formData.wellnessGoals.length > 0 ? formData.wellnessGoals : null,
          services_interested: formData.servicesInterested.length > 0 ? formData.servicesInterested : null,
          referred_by_member: formData.referredByMember || null,
          founding_member: formData.foundingMember || null,
          lifestyle_integration: formData.lifestyleIntegration || null,
          holistic_wellness: formData.holisticWellness || null,
          status: "pending_payment",
          payment_info_provided: false,
        }).select("id").single();

        if (appError) {
          console.error("[Apply] Failed to save pre-payment application:", appError);
          // Don't block the card flow - just log it
        } else if (appData?.id) {
          setSavedApplicationId(appData.id);
          console.log("[Apply] Application saved with id:", appData.id);
        }
      }

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_application_setup",
          applicantEmail: formData.email,
          applicantName: `${formData.firstName} ${formData.lastName}`,
          successUrl: window.location.origin + window.location.pathname,
          cancelUrl: window.location.origin + window.location.pathname,
        },
      });

      if (error) {
        console.error("Payment setup error:", error);
        throw new Error(error.message || "Failed to create payment setup");
      }

      if (!data) {
        throw new Error("No response data received");
      }

      if (data.error) {
        throw new Error(data.error || "Payment setup failed");
      }

      console.log("[Apply] Payment setup response:", data);
      
      if (!data.clientSecret) {
        console.error("No client secret in response data:", data);
        throw new Error("No client secret returned from payment service");
      }

      // Store client secret and customer ID (customer is created at this point)
      // NOTE: Customer ID is created when setup is created, but payment method isn't saved until user completes form
      // We set stripeCustomerId immediately so it's available to the payment form, but isCardConfirmed stays FALSE
      const customerIdFromResponse = data.customerId || null;
      if (customerIdFromResponse) {
        // Save to draft for persistence - BUT mark card as NOT confirmed yet
        saveDraft(formData, customerIdFromResponse, false, null);
        // Set in state so PaymentFormInner can use it immediately
        setStripeCustomerId(customerIdFromResponse);
      }
      
      console.log("[Apply] Setting up embedded payment form with client secret");
      setPaymentClientSecret(data.clientSecret);
      setShowPaymentForm(true);
      setIsSavingCard(false);
      console.log("[Apply] Payment form should now be visible with customerId:", customerIdFromResponse);
    } catch (error) {
      console.error("Error creating payment setup:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to open payment setup. Please try again.";
      toast.error(errorMessage);
      setIsSavingCard(false);
    }
  };

  // Check for duplicate application before submission
  const checkForDuplicateApplication = async (emailToCheck: string): Promise<{
    isDuplicate: boolean;
    message: string;
  }> => {
    try {
      // Check for existing member (case-insensitive)
      const { data: memberData } = await supabase
        .from("members")
        .select("id, status, email")
        .ilike("email", emailToCheck)
        .maybeSingle();

      if (memberData) {
        return {
          isDuplicate: true,
          message: `A member account already exists for ${emailToCheck}. Please contact support if you need to update your information.`,
        };
      }

      // Check for pending/approved application (case-insensitive)
      const { data: appData } = await supabase
        .from("membership_applications")
        .select("id, status, email")
        .ilike("email", emailToCheck)
        .neq("status", "rejected")
        .neq("status", "cancelled")
        .maybeSingle();

      if (appData) {
        const statusDisplay = appData.status.replace(/_/g, " ").toUpperCase();
        return {
          isDuplicate: true,
          message: `An application already exists for ${emailToCheck} with status: ${statusDisplay}. Only one application per email address is allowed.`,
        };
      }

      return { isDuplicate: false, message: "" };
    } catch (error) {
      console.warn("[Apply] Duplicate check failed:", error);
      return { isDuplicate: false, message: "" };
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

    // Check for duplicate application before proceeding
    const dupeCheck = await checkForDuplicateApplication(formData.email);
    if (dupeCheck.isDuplicate) {
      toast.error(dupeCheck.message);
      return;
    }

    // Validate payment method is saved AND card is confirmed
    if (!stripeCustomerId || !isCardConfirmed) {
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
      const applicationPayload = {
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
        card_brand: savedCardDetails?.brand || null,
        card_last4: savedCardDetails?.last4 || null,
        card_exp_month: savedCardDetails?.expMonth || null,
        card_exp_year: savedCardDetails?.expYear || null,
        status: "pending",
      };

      // If we already saved a pending_payment application, update it instead of inserting
      let error;
      if (savedApplicationId) {
        console.log("[Apply] Updating existing application:", savedApplicationId);
        const result = await supabase
          .from("membership_applications")
          .update(applicationPayload)
          .eq("id", savedApplicationId);
        error = result.error;
      } else {
        console.log("[Apply] Inserting new application");
        const result = await supabase.from("membership_applications").insert(applicationPayload);
        error = result.error;
      }

      if (error) {
        console.error("Error submitting application:", error);
        toast.error(`Failed to submit application: ${error.message || error.code || 'Unknown error'}`);
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
              If you have any questions, contact us at admin@stormwellnessclub.com.
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

      {/* Progress Stepper */}
      <ApplicationProgress
        steps={steps}
        currentStepId={currentStepId}
        onStepClick={scrollToSection}
      />

      {/* Draft Save Indicator */}
      <DraftSaveIndicator lastSavedAt={lastSavedAt} />

      {/* Application Form */}
      <section className="py-4 sm:py-8 bg-background">
        <div className="container mx-auto px-3 sm:px-6 max-w-3xl">
          <form onSubmit={handleSubmit}>
            {/* Personal Information */}
            <div ref={(el) => sectionRefs.current["personal"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Personal Information</h2>
              
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
            <div ref={(el) => sectionRefs.current["goals"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Wellness Goals and Interests</h2>
              
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
            <div className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Wellness Background</h2>
              
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
            <div className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Motivation for Joining</h2>
              
              <div>
                <Label className="mb-3 block">Why have you chosen Storm Wellness Club for your wellness journey? (Select all that apply)</Label>
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
            <div className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Getting to Know You Better</h2>
              
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
            <div className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Alignment with Our Wellness Community</h2>
              
              <div>
                <Label className="mb-3 block">Would you like to become a founding member? *</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  We are limiting our Founding Members to a total of 100. You can become a Founding Member 
                  by <strong className="text-foreground">paying your full annual membership dues upfront</strong>. This status grants you a special founding 
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

                {formData.foundingMember === "yes" && (
                  <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3">
                      ⚠️ Founding Member = Full Annual Dues Paid Upfront
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                         <thead>
                          <tr className="border-b border-border">
                             <th className="text-left py-2 pr-4 font-medium text-foreground">Tier</th>
                             <th className="text-left py-2 font-medium text-foreground">Annual Price</th>
                           </tr>
                         </thead>
                         <tbody className="text-muted-foreground">
                           <tr className="border-b border-border/50">
                             <td className="py-2 pr-4 font-medium text-foreground">Diamond</td>
                             <td className="py-2">$6,000/year</td>
                           </tr>
                           <tr className="border-b border-border/50">
                             <td className="py-2 pr-4 font-medium text-foreground">Platinum</td>
                             <td className="py-2">$4,200/year</td>
                           </tr>
                           <tr className="border-b border-border/50">
                             <td className="py-2 pr-4 font-medium text-foreground">Gold</td>
                             <td className="py-2">$3,000/year</td>
                           </tr>
                           <tr>
                             <td className="py-2 pr-4 font-medium text-foreground">Silver</td>
                             <td className="py-2">$2,400/year</td>
                           </tr>
                         </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
                      This full annual amount is due upon membership activation, <strong>in addition to</strong> the non-refundable initiation fee ($300).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Information - Enhanced */}
            <div ref={(el) => sectionRefs.current["payment"] = el} id="payment-section">
              <PaymentSectionEnhanced
                stripeCustomerId={stripeCustomerId}
                isCardConfirmed={isCardConfirmed}
                showPaymentForm={showPaymentForm}
                paymentClientSecret={paymentClientSecret}
                isSavingCard={isSavingCard}
                creditCardAuth={formData.creditCardAuth}
                paymentAcknowledged={formData.paymentAcknowledged}
                canStartPayment={!!(formData.firstName && formData.lastName && formData.email)}
                savedCardDetails={savedCardDetails}
                onSavePaymentMethod={handleSavePaymentMethod}
                onPaymentSuccess={(customerId, cardDetails) => {
                  setStripeCustomerId(customerId);
                  setIsCardConfirmed(true);
                  setShowPaymentForm(false);
                  setPaymentClientSecret(null);
                  setSavedCardDetails(cardDetails || null);
                  
                  const cardDisplay = cardDetails?.brand && cardDetails?.last4 
                    ? `${cardDetails.brand.toUpperCase()} •••• ${cardDetails.last4}` 
                    : "Payment method";
                  toast.success(`${cardDisplay} saved successfully!`);
                  saveDraft(formData, customerId, true, cardDetails);
                  setLastSavedAt(Date.now());
                }}
                onPaymentCancel={() => {
                  setShowPaymentForm(false);
                  setPaymentClientSecret(null);
                  setIsSavingCard(false);
                  // Do NOT reset isCardConfirmed - keep for retry if already confirmed
                }}
                onCheckboxChange={handleCheckboxChange}
              />
            </div>
            <div className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Agreements</h2>
              
              {/* STOP Warning Card */}
              <div className="mb-6 p-5 bg-destructive/10 border-2 border-destructive/40 rounded-lg">
                <p className="text-base font-bold text-destructive mb-2">🛑 STOP — Read Before Applying</p>
                <ul className="text-sm text-destructive space-y-1.5 list-disc list-inside">
                  <li>The <strong>initiation fee ($300) is non-refundable</strong> and will be charged upon membership approval.</li>
                  <li>This is a <strong>minimum 1-year membership commitment</strong>.</li>
                  <li>Founding members pay their <strong>full annual dues upfront</strong> (see pricing above).</li>
                  <li><strong>Do not apply if you are not ready to commit.</strong></li>
                </ul>
              </div>

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
                    Please note that all memberships at Storm Wellness Club require a minimum 
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
                      I understand this is a minimum 1-year commitment. The initiation fee ($300) is <strong>non-refundable</strong> and will be charged upon approval. I will not dispute these authorized charges. *
                    </Label>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong className="text-foreground">Authorization and Acknowledgment of Initiation Fee and Membership Commitment</strong>
                    <br /><br />
                    By submitting this application, I understand and agree that, upon approval of my membership at 
                    Storm Wellness Club, the initiation fee as outlined in the membership details will 
                    be charged to the credit card provided in this application. I hereby authorize Storm Wellness 
                    Club to process this charge upon the confirmation of my membership acceptance. Additionally, 
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
                      I authorize the <strong>non-refundable</strong> initiation fee to be charged upon approval. I understand founding members pay full annual dues upfront. I accept that all described charges are final and <strong>non-refundable</strong>. *
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

            {/* Validation Summary with Submit */}
            <ApplicationValidationSummary
              steps={steps}
              onStepClick={scrollToSection}
              isSubmitting={isSubmitting}
            />
          </form>
        </div>
      </section>
    </Layout>
  );
}
