import { useState, useEffect, useRef, useCallback } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, AlertCircle, FileText, Download, CreditCard, CheckCircle } from "lucide-react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAgreements } from "@/hooks/useAgreements";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationProgress, getStepCompletion, APPLICATION_STEPS } from "@/components/ApplicationProgress";
import { ApplicationValidationSummary } from "@/components/ApplicationValidationSummary";
import { DraftSaveIndicator } from "@/components/DraftSaveIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolvePdfUrl } from "@/lib/pdfAssets";
import { StripeProvider } from "@/components/StripeProvider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { formatSetupError } from "@/lib/stripeErrors";
import { SmsConsentCheckbox, SMS_DISCLOSURE_VERSION } from "@/components/SmsConsentCheckbox";
import {
  newSubmitKey,
  logSubmitStart,
  logSubmitResult,
  flushSubmitLogQueue,
} from "@/lib/applicationSubmitLog";


import gymArea2 from "@/assets/gym-area-2.jpg";

// Draft persistence for form data across redirects
const DRAFT_STORAGE_KEY = "storm_apply_draft_v2";
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DraftData {
  formData: typeof initialFormData;
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
  smsConsent: true,
  ackOneYearCommitment: false,
  ackInitiationFee: false,
  ackMembershipAgreement: false,
  ackLiabilityWaiver: false,
  ackCardOnFile: false,
  ackFinalReadiness: false,
  addCardOnFile: false,
};

// Save to BOTH storages for maximum reliability on mobile
const saveDraft = (formData: typeof initialFormData) => {
  const draft: DraftData = { formData, savedAt: Date.now() };
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

  try {
    const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (stored) {
      draft = JSON.parse(stored) as DraftData;
      source = "session";
    }
  } catch (e) {
    console.warn("[Draft] sessionStorage load failed:", e);
  }

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

  if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
    clearDraft();
    return null;
  }

  draft.source = source || undefined;
  return draft;
};

const clearDraft = () => {
  try { sessionStorage.removeItem(DRAFT_STORAGE_KEY); } catch (e) {}
  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch (e) {}
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) throw new Error('Received HTML instead of PDF');
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

function LiabilityWaiverSection({ isSigned, onCheckboxChange }: { isSigned: boolean; onCheckboxChange: (checked: boolean) => void }) {
  const { data: waiverAgreements, isLoading } = useAgreements("liability_waiver");
  const isMobile = useIsMobile();

  const pdfUrls = waiverAgreements?.map((a) => a.pdf_url).filter(Boolean) || [];

  const downloadPdf = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) throw new Error('Received HTML instead of PDF');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 100);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">Liability Waiver</p>
      {isLoading ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading waiver...</span>
        </div>
      ) : pdfUrls.length > 0 ? (
        <div className="space-y-2">
          {pdfUrls.map((url, index) => {
            const resolvedUrl = resolvePdfUrl(url);
            const filename = typeof url === 'string' ? (url.split('/').pop() || 'liability-waiver.pdf') : `waiver-${index + 1}.pdf`;
            return (
              <div key={index} className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-muted/30">
                <FileText className="h-8 w-8 text-accent" />
                <p className="text-sm font-medium">Liability Waiver</p>
                <div className={`flex gap-2 w-full ${isMobile ? 'flex-col' : 'flex-row justify-center'}`}>
                  <Button size="sm" className="gap-2" onClick={() => downloadPdf(resolvedUrl, filename)}>
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-secondary/30">
        <Checkbox
          id="liabilityWaiver"
          checked={isSigned}
          onCheckedChange={onCheckboxChange}
          required
        />
        <Label htmlFor="liabilityWaiver" className="font-normal cursor-pointer text-sm leading-relaxed">
          I have read, understand, and agree to the Liability Waiver. I acknowledge and accept all risks associated with using the facilities. *
        </Label>
      </div>
    </div>
  );
}

// Hardened payment form for applicant card capture (no nested <form>, robust error/loading handling)
const CARD_LOADING_MESSAGES = [
  "Preparing secure checkout...",
  "Setting up encryption...",
  "Loading payment form...",
  "Almost ready...",
];

function ApplicantPaymentFormInner({ 
  onSuccess, 
  onCancel,
  customerId,
  clientSecret,
}: { 
  onSuccess: (cardBrand: string | null, cardLast4: string | null, cardExpMonth: number | null, cardExpYear: number | null, customerId: string | null) => void; 
  onCancel: () => void;
  customerId: string | null;
  clientSecret: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Cycle loading messages while form loads
  useEffect(() => {
    if (!isReady) {
      const interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % CARD_LOADING_MESSAGES.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isReady]);

  const handleSave = async () => {
    setError(null);
    if (!stripe || !elements) {
      setError("Payment form not ready. Please wait...");
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate form first
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Please complete the payment form");
        setIsSubmitting(false);
        return;
      }

      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (confirmError) {
        setError(formatSetupError(confirmError));
        setIsSubmitting(false);
        return;
      }

      if (!setupIntent) {
        setError("Setup failed - no response. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (setupIntent.status !== "succeeded") {
        setError(`Payment setup incomplete (status: ${setupIntent.status}). Please try again.`);
        setIsSubmitting(false);
        return;
      }

      const paymentMethodId = typeof setupIntent.payment_method === "string" 
        ? setupIntent.payment_method 
        : (setupIntent.payment_method as any)?.id;

      if (!paymentMethodId) {
        setError("Card setup completed but payment method was not saved. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Fetch card details with retry logic (Stripe eventual consistency)
      let cardBrand: string | null = null;
      let cardLast4: string | null = null;
      let cardExpMonth: number | null = null;
      let cardExpYear: number | null = null;

      const maxAttempts = 4;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const delay = attempt === 1 ? 2000 : attempt === 2 ? 2000 : attempt === 3 ? 2500 : 3000;
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
          console.log(`[ApplicantPayment] Attempt ${attempt}/${maxAttempts} - Fetching card details`);
          const { data: pmData, error: pmError } = await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "list_application_payment_methods",
              stripeCustomerId: customerId,
            },
          });

          if (pmError) {
            console.error(`[ApplicantPayment] Attempt ${attempt} - Error:`, pmError);
            continue;
          }

          if (pmData?.paymentMethods?.[0]) {
            const card = pmData.paymentMethods[0];
            cardBrand = card.brand || null;
            cardLast4 = card.last4 || null;
            cardExpMonth = card.expMonth || null;
            cardExpYear = card.expYear || null;
            console.log("[ApplicantPayment] Got card details:", { cardBrand, cardLast4 });
            break;
          }
        } catch (err) {
          console.error(`[ApplicantPayment] Attempt ${attempt} - Exception:`, err);
        }
      }

      // If we still don't have card details, try from the payment method object
      if (!cardBrand && typeof setupIntent.payment_method !== 'string' && setupIntent.payment_method?.card) {
        const card = setupIntent.payment_method.card;
        cardBrand = card.brand;
        cardLast4 = card.last4;
        cardExpMonth = card.exp_month;
        cardExpYear = card.exp_year;
      }

      toast.success("Payment method saved successfully!");
      onSuccess(cardBrand, cardLast4, cardExpMonth, cardExpYear, customerId);
    } catch (err) {
      console.error("Error saving card:", err);
      setError("Failed to save payment method. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="min-h-[300px] relative">
        {/* Loading overlay */}
        {!isReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 mx-auto rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                <CreditCard className="w-6 h-6 text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">
                {CARD_LOADING_MESSAGES[loadingMsgIdx]}
              </p>
            </div>
          </div>
        )}
        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center p-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm text-destructive mb-2">{error}</p>
              <Button type="button" variant="outline" onClick={() => {
                setError(null);
                setIsReady(false);
              }}>
                Try Again
              </Button>
            </div>
          </div>
        )}
        <div tabIndex={-1}>
          <PaymentElement 
            onReady={() => setIsReady(true)}
            onLoadError={(loadError) => {
              const msg = loadError.error?.message || "Unknown error";
              setError(`Failed to load payment form: ${msg}`);
              setIsReady(false);
            }}
            options={{ layout: "tabs" }}
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button 
          type="button"
          onClick={handleSave}
          disabled={!stripe || !elements || isSubmitting || !isReady}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Payment Method"
          )}
        </Button>
      </div>
    </div>
  );
}

export default function Apply() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStepId, setCurrentStepId] = useState("personal");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  
  // Card-on-file state
  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);
  const [cardCustomerId, setCardCustomerId] = useState<string | null>(null);
  const [cardSetupComplete, setCardSetupComplete] = useState(false);
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [cardLast4, setCardLast4] = useState<string | null>(null);
  const [cardExpMonth, setCardExpMonth] = useState<number | null>(null);
  const [cardExpYear, setCardExpYear] = useState<number | null>(null);
  const [isLoadingCardSetup, setIsLoadingCardSetup] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [stripeRemountKey, setStripeRemountKey] = useState(0);
  
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  const [formData, setFormData] = useState(() => {
    const draft = getInitialDraft();
    if (draft?.formData) {
      return draft.formData;
    }
    return initialFormData;
  });
  
  const isHydrated = useRef(false);
  const submitKeyRef = useRef<string | null>(null);

  const formDataRef = useRef(formData);
  
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);
  
  useEffect(() => {
    isHydrated.current = true;
    // Retry any submit breadcrumb that couldn't be recorded on a prior visit.
    flushSubmitLogQueue();
  }, []);



  // Autosave draft with debounce
  useEffect(() => {
    if (!isHydrated.current) return;
    
    const timeoutId = setTimeout(() => {
      saveDraft(formData);
      setLastSavedAt(Date.now());
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [formData]);

  const steps = getStepCompletion(formData, cardCustomerId, cardSetupComplete);

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

  // Check for duplicate application before submission
  const checkForDuplicateApplication = async (emailToCheck: string): Promise<{
    isDuplicate: boolean;
    message: string;
  }> => {
    try {
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

      const { data: appData } = await supabase
        .from("membership_applications")
        .select("id, status, email")
        .ilike("email", emailToCheck)
        .neq("status", "rejected")
        .neq("status", "cancelled")
        .neq("status", "pending_payment")
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
    
    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.gender ||
        !formData.address || !formData.city || !formData.state || !formData.zipCode || !formData.country ||
        !formData.email || !formData.phone || !formData.membershipPlan ||
        formData.wellnessGoals.length === 0 || formData.servicesInterested.length === 0 ||
        !formData.foundingMember) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!formData.ackOneYearCommitment || !formData.ackInitiationFee ||
        !formData.ackMembershipAgreement || !formData.ackLiabilityWaiver ||
        !formData.ackCardOnFile || !formData.ackFinalReadiness) {
      toast.error("Please review and check each acknowledgment before submitting.");
      return;
    }

    if (!cardSetupComplete || !cardCustomerId) {
      toast.error("Please add a payment method before submitting your application.");
      sectionRefs.current["payment"]?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const dupeCheck = await checkForDuplicateApplication(formData.email);
    if (dupeCheck.isDuplicate) {
      toast.error(dupeCheck.message);
      return;
    }

    // Validate input lengths
    const maxLengths: Record<string, number> = {
      firstName: 50, lastName: 50, gender: 10, address: 200, city: 100,
      state: 50, zipCode: 20, country: 100, email: 255, phone: 30,
      otherGoals: 500, otherServices: 500, otherMotivation: 500,
      lifestyleIntegration: 1000, holisticWellness: 1000,
      previousMember: 50, referredByMember: 50, foundingMember: 50,
    };

    for (const [field, maxLength] of Object.entries(maxLengths)) {
      const value = formData[field as keyof typeof formData];
      if (typeof value === 'string' && value.length > maxLength) {
        toast.error(`${field.replace(/([A-Z])/g, ' $1').trim()} is too long (max ${maxLength} characters)`);
        return;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (formData.wellnessGoals.length > 10 || formData.servicesInterested.length > 10 || formData.motivations.length > 10) {
      toast.error("Too many selections");
      return;
    }

    setIsSubmitting(true);

    try {
      // Block check
      const { data: isBlocked } = await supabase.rpc('is_email_blocked', { p_email: formData.email.trim().toLowerCase() });
      if (isBlocked) {
        toast.error("You are not permitted to apply for membership. If you believe this is an error, please contact us.");
        setIsSubmitting(false);
        return;
      }

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
        referred_by_member: formData.referredByMember?.trim() || null,
        founding_member: formData.foundingMember,
        payment_info_provided: cardSetupComplete,
        stripe_customer_id: cardCustomerId || null,
        card_brand: cardBrand || null,
        card_last4: cardLast4 || null,
        card_exp_month: cardExpMonth || null,
        card_exp_year: cardExpYear || null,
        one_year_commitment: formData.ackOneYearCommitment,
        membership_agreement_signed: formData.ackMembershipAgreement,
        liability_waiver_signed: formData.ackLiabilityWaiver,
        ack_initiation_fee: formData.ackInitiationFee,
        ack_card_on_file: formData.ackCardOnFile,
        ack_final_readiness: formData.ackFinalReadiness,
        status: "pending",
      };

      // Breadcrumb BEFORE the insert so a failed submit is provable afterwards.
      const submitKey = newSubmitKey(formData.email);
      submitKeyRef.current = submitKey;
      await logSubmitStart({
        clientKey: submitKey,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        payload: applicationPayload,
      });

      const { data: inserted, error } = await supabase
        .from("membership_applications")
        .insert(applicationPayload)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("Error submitting application:", error);
        logSubmitResult({
          clientKey: submitKey,
          status: "failed",
          error: error.message || error.code || "Unknown error",
        });
        toast.error(`Failed to submit application: ${error.message || error.code || 'Unknown error'}`);
        setIsSubmitting(false);
        return;
      }

      logSubmitResult({
        clientKey: submitKey,
        status: "succeeded",
        applicationId: inserted?.id ?? undefined,
      });


      // Log SMS consent + send opt-in confirmation SMS (best-effort, non-blocking)
      if (formData.smsConsent) {
        (supabase.from('sms_consent_log') as any).insert({
          phone: formData.phone,
          action: 'opt_in',
          source: 'application',
          user_agent: navigator.userAgent,
          disclosure_version: SMS_DISCLOSURE_VERSION,
          metadata: { email: formData.email },
        }).then(({ error: logErr }: any) => {
          if (logErr) console.warn('SMS consent log failed:', logErr);
        });

        supabase.functions.invoke('send-sms', {
          body: {
            templateKey: 'opt-in-confirmation',
            to: formData.phone,
            idempotencyKey: `opt-in-confirm:${formData.email}:${Date.now()}`,
            variables: {},
            bypassConsent: true,
          },
        }).then(({ error: smsErr }) => {
          if (smsErr) console.warn('Opt-in confirmation SMS failed:', smsErr);
        });
      }


      // Send confirmation email
      supabase.functions.invoke('send-email', {
        body: {
          type: 'application_submitted',
          to: formData.email,
          data: {
            name: formData.firstName,
            firstName: formData.firstName,
            membershipPlan: formData.membershipPlan,
          },
        },
      }).then(({ error: emailError }) => {
        if (emailError) {
          console.error("Failed to send confirmation email:", emailError);
        }
      });

      // Clear draft on successful submission
      clearDraft();
      
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
              <h2 className="font-serif text-3xl mb-4">Application Received</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Your application has been received. We review every submission personally and will be in touch within 24–48 hours.
              </p>
              <p className="text-muted-foreground mb-8">
                We look forward to reading yours.
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
      <SEOHead title="Apply for Membership" description="Submit your membership application to Storm Wellness Club. Choose your plan, provide your details, and join our premium fitness community in Livonia, MI." path="/apply" />
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
              Membership is by application.
            </h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed mb-6">
              We review every application personally and respond within 24–48 hours. If your application is approved, we'll invite you for a private walkthrough of Storm Wellness Club — so you can experience everything before your membership begins.
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
          {/* Supporting line above the form */}
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-2xl mx-auto">
            Membership spots are limited. We're selective about who joins our community — not to be exclusive for its own sake, but because the right environment depends on the right people.
          </p>
          
          <form onSubmit={handleSubmit}>
            {/* Step 1 — Personal Information */}
            <div ref={(el) => sectionRefs.current["personal"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-2 sm:mb-3 text-gold">Personal Information</h2>
              <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
                Tell us a little about yourself. All information is kept private and used only to review your application.
              </p>
              
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} placeholder="First Name" className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} placeholder="Last Name" className="mt-1" required />
                  </div>
                </div>

                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input id="dateOfBirth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleInputChange} className="mt-1" required />
                </div>

                <div>
                  <Label className="mb-3 block">Gender *</Label>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <input type="radio" id="gender-women" name="gender" value="Women" checked={formData.gender === "Women"} onChange={handleInputChange} className="h-4 w-4 accent-accent" />
                      <Label htmlFor="gender-women" className="font-normal cursor-pointer">Women</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="radio" id="gender-men" name="gender" value="Men" checked={formData.gender === "Men"} onChange={handleInputChange} className="h-4 w-4 accent-accent" />
                      <Label htmlFor="gender-men" className="font-normal cursor-pointer">Men</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Input id="address" name="address" value={formData.address} onChange={handleInputChange} placeholder="Street Address" className="mt-1" required />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input id="city" name="city" value={formData.city} onChange={handleInputChange} placeholder="City" className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="state">State/Province *</Label>
                    <Input id="state" name="state" value={formData.state} onChange={handleInputChange} placeholder="State" className="mt-1" required />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zipCode">ZIP / Postal Code *</Label>
                    <Input id="zipCode" name="zipCode" value={formData.zipCode} onChange={handleInputChange} placeholder="ZIP Code" className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input id="country" name="country" value={formData.country} onChange={handleInputChange} className="mt-1" required />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="your@email.com" className="mt-1" required />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} placeholder="(123) 456-7890" className="mt-1" required />
                </div>

                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div>
                    <p className="font-medium text-sm">📱 Stay in the loop by text</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Class reminders, waitlist alerts, billing notices, and time-sensitive updates — straight to your phone. Standard rates apply. Reply STOP anytime to opt out.
                    </p>
                  </div>
                  <SmsConsentCheckbox
                    checked={formData.smsConsent}
                    onCheckedChange={(v) => setFormData((prev) => ({ ...prev, smsConsent: v }))}
                    id="apply-sms-consent"
                  />
                </div>
              </div>
            </div>

            {/* Step 2 — Membership Selection */}
            <div ref={(el) => sectionRefs.current["membership"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-2 sm:mb-3 text-gold">Membership Plan</h2>
              <p className="text-sm text-muted-foreground mb-2">
                Select the tier that aligns with your wellness goals. You'll have the opportunity to discuss your choice during your private walkthrough — nothing is finalized until you've been approved and you visit the club.
              </p>
              <p className="text-xs mb-4 sm:mb-6">
                <Link to="/memberships" className="text-muted-foreground hover:text-accent transition-colors underline underline-offset-2">
                  Not sure which tier is right for you? View membership tiers →
                </Link>
              </p>
              
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

            {/* Step 3 — Wellness Goals and Interests */}
            <div ref={(el) => sectionRefs.current["goals"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-2 sm:mb-3 text-gold">Wellness Goals and Interests</h2>
              <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
                This is the part we look forward to most. We read every response personally — your goals and motivations help us understand whether Storm Wellness Club is the right fit for you, and how we can best support your journey if you join.
              </p>
              
              <div className="space-y-6">
                <div>
                  <Label className="mb-3 block">What are your primary health and wellness goals? (Select all that apply) *</Label>
                  <div className="space-y-2">
                    {wellnessGoals.map((goal) => (
                      <div key={goal} className="flex items-center gap-3">
                        <Checkbox id={`goal-${goal}`} checked={formData.wellnessGoals.includes(goal)} onCheckedChange={() => handleMultiSelect("wellnessGoals", goal)} />
                        <Label htmlFor={`goal-${goal}`} className="font-normal cursor-pointer">{goal}</Label>
                      </div>
                    ))}
                    <div className="flex items-center gap-3">
                      <Checkbox id="goal-other" checked={formData.wellnessGoals.includes("Other")} onCheckedChange={() => handleMultiSelect("wellnessGoals", "Other")} />
                      <Label htmlFor="goal-other" className="font-normal cursor-pointer">Other (Please specify below)</Label>
                    </div>
                    {formData.wellnessGoals.includes("Other") && (
                      <Input name="otherGoals" value={formData.otherGoals} onChange={handleInputChange} placeholder="Please specify..." className="mt-2" />
                    )}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">Which of our services are you most interested in? (Select all that apply) *</Label>
                  <div className="space-y-2">
                    {servicesInterested.map((service) => (
                      <div key={service} className="flex items-center gap-3">
                        <Checkbox id={`service-${service}`} checked={formData.servicesInterested.includes(service)} onCheckedChange={() => handleMultiSelect("servicesInterested", service)} />
                        <Label htmlFor={`service-${service}`} className="font-normal cursor-pointer">{service}</Label>
                      </div>
                    ))}
                    <div className="flex items-center gap-3">
                      <Checkbox id="service-other" checked={formData.servicesInterested.includes("Other")} onCheckedChange={() => handleMultiSelect("servicesInterested", "Other")} />
                      <Label htmlFor="service-other" className="font-normal cursor-pointer">Other (Please specify below)</Label>
                    </div>
                    {formData.servicesInterested.includes("Other") && (
                      <Input name="otherServices" value={formData.otherServices} onChange={handleInputChange} placeholder="Please specify..." className="mt-2" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 — Wellness Background */}
            <div ref={(el) => sectionRefs.current["background"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Wellness Background</h2>
              
              <div>
                <Label className="mb-3 block">Have you previously been a member of a fitness center, or wellness club?</Label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input type="radio" id="previousMember-yes" name="previousMember" value="yes" checked={formData.previousMember === "yes"} onChange={handleInputChange} className="w-4 h-4" />
                    <Label htmlFor="previousMember-yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="radio" id="previousMember-no" name="previousMember" value="no" checked={formData.previousMember === "no"} onChange={handleInputChange} className="w-4 h-4" />
                    <Label htmlFor="previousMember-no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5 — Motivation for Joining */}
            <div ref={(el) => sectionRefs.current["motivation"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Motivation for Joining</h2>
              
              <div>
                <Label className="mb-3 block">Why have you chosen Storm Wellness Club for your wellness journey? (Select all that apply)</Label>
                <div className="space-y-2">
                  {motivations.map((motivation) => (
                    <div key={motivation} className="flex items-center gap-3">
                      <Checkbox id={`motivation-${motivation}`} checked={formData.motivations.includes(motivation)} onCheckedChange={() => handleMultiSelect("motivations", motivation)} />
                      <Label htmlFor={`motivation-${motivation}`} className="font-normal cursor-pointer">{motivation}</Label>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <Checkbox id="motivation-other" checked={formData.motivations.includes("Other")} onCheckedChange={() => handleMultiSelect("motivations", "Other")} />
                    <Label htmlFor="motivation-other" className="font-normal cursor-pointer">Other (Please share)</Label>
                  </div>
                  {formData.motivations.includes("Other") && (
                    <Input name="otherMotivation" value={formData.otherMotivation} onChange={handleInputChange} placeholder="Please share..." className="mt-2" />
                  )}
                </div>
              </div>
            </div>

            {/* Step 6 — Getting to Know You Better / Lifestyle */}
            <div ref={(el) => sectionRefs.current["lifestyle"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Getting to Know You Better</h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lifestyleIntegration">
                    Please share a little about your lifestyle and how you envision integrating the wellness center into your daily routine.
                  </Label>
                  <Textarea id="lifestyleIntegration" name="lifestyleIntegration" value={formData.lifestyleIntegration} onChange={handleInputChange} className="mt-1 min-h-[100px]" />
                </div>

                <div>
                  <Label htmlFor="holisticWellness">
                    What does holistic wellness mean to you, and how do you hope to achieve it with us?
                  </Label>
                  <Textarea id="holisticWellness" name="holisticWellness" value={formData.holisticWellness} onChange={handleInputChange} className="mt-1 min-h-[100px]" />
                </div>

                <div>
                  <Label htmlFor="referredByMember" className="mb-2 block">Member Referral</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Do you know a current Storm Wellness Club member? If so, include their name. A referral is not required, but it is considered as part of your application review.
                  </p>
                  <Input
                    id="referredByMember"
                    name="referredByMember"
                    type="text"
                    value={formData.referredByMember}
                    onChange={handleInputChange}
                    maxLength={100}
                    placeholder="Member's full name (optional)"
                  />
                </div>
              </div>
            </div>

            {/* Alignment with Our Wellness Community */}
            <div className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-gold">Alignment with Our Wellness Community</h2>
              
              <div>
                <Label className="mb-3 block">Would you like to become a founding member? *</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Founding members pay their membership annually in advance. If approved, you'll complete this during your walkthrough. This status grants you a special founding member card, exclusive branded apparel, a premium gym bag, and priority access to all private events.
                </p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input type="radio" id="foundingMember-yes" name="foundingMember" value="yes" checked={formData.foundingMember === "yes"} onChange={handleInputChange} className="w-4 h-4" required />
                    <Label htmlFor="foundingMember-yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="radio" id="foundingMember-no" name="foundingMember" value="no" checked={formData.foundingMember === "no"} onChange={handleInputChange} className="w-4 h-4" required />
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
                    <p className="text-xs text-muted-foreground mt-3">
                      If approved, payment details will be finalized during your private walkthrough.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Step 7 — Payment Method (REQUIRED) */}
            <div ref={(el) => sectionRefs.current["payment"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                <h2 className="font-serif text-xl sm:text-2xl text-gold">
                  Payment Method
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-xs font-medium">
                  Required
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                A valid payment method is required to submit your application. Your card is saved securely — no charges are made until your membership is approved and activated.
              </p>

              {cardSetupComplete ? (
                <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Payment method saved</p>
                    {cardBrand && cardLast4 && (
                      <p className="text-sm text-muted-foreground">
                        {cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1)} •••• {cardLast4}
                      </p>
                    )}
                  </div>
                </div>
              ) : !formData.email ? (
                <div className="flex items-start gap-3 p-4 bg-muted/40 border border-border rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Enter your email address in the Personal Information section above to load the secure payment form.
                  </p>
                </div>
              ) : showCardForm && cardClientSecret ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">
                      Your card will be saved securely for future billing. No charges will be made until your membership is approved and activated.
                    </p>
                  </div>
                  <StripeProvider key={`stripe-applicant-${stripeRemountKey}`} clientSecret={cardClientSecret}>
                    <ApplicantPaymentFormInner
                      clientSecret={cardClientSecret}
                      customerId={cardCustomerId}
                      onSuccess={(brand, last4, expMonth, expYear, custId) => {
                        setCardBrand(brand);
                        setCardLast4(last4);
                        setCardExpMonth(expMonth);
                        setCardExpYear(expYear);
                        if (custId) setCardCustomerId(custId);
                        setCardSetupComplete(true);
                        setShowCardForm(false);
                      }}
                      onCancel={() => {
                        setShowCardForm(false);
                        setCardClientSecret(null);
                        setStripeRemountKey(prev => prev + 1);
                      }}
                    />
                  </StripeProvider>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={async () => {
                    setIsLoadingCardSetup(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("stripe-payment", {
                        body: {
                          action: "create_application_setup",
                          applicantEmail: formData.email,
                          applicantName: `${formData.firstName} ${formData.lastName}`,
                        },
                      });
                      if (error) throw error;
                      if (data?.clientSecret) {
                        setCardClientSecret(data.clientSecret);
                        setCardCustomerId(data.customerId || null);
                        setStripeRemountKey(prev => prev + 1);
                        setShowCardForm(true);
                      } else {
                        throw new Error("No client secret returned");
                      }
                    } catch (err) {
                      console.error("Error creating setup intent:", err);
                      toast.error("Failed to initialize payment form. Please ensure your email is filled in above.");
                    } finally {
                      setIsLoadingCardSetup(false);
                    }
                  }}
                  disabled={isLoadingCardSetup || !formData.email}
                  className="w-full"
                >
                  {isLoadingCardSetup ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading secure payment form...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Add Payment Method
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Step 8 — Acknowledgments */}
            <div ref={(el) => sectionRefs.current["agreements"] = el} className="card-luxury p-4 sm:p-8 mb-6 sm:mb-8">
              <h2 className="font-serif text-xl sm:text-2xl mb-2 sm:mb-3 text-gold">Acknowledgments</h2>
              <p className="text-sm text-muted-foreground mb-8">
                Please review and acknowledge each of the following before submitting your application.
              </p>

              <div className="space-y-8">
                {/* 1 — One-year commitment */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="ackOneYearCommitment"
                    checked={formData.ackOneYearCommitment}
                    onCheckedChange={(checked) => handleCheckboxChange("ackOneYearCommitment", checked as boolean)}
                    required
                    className="mt-1"
                  />
                  <Label htmlFor="ackOneYearCommitment" className="font-normal cursor-pointer text-sm leading-relaxed text-foreground">
                    I understand that Storm Wellness Club membership requires a one-year commitment. By submitting this application, I acknowledge that I am ready to commit to a full year of membership upon approval.
                  </Label>
                </div>

                {/* 2 — Initiation fee */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="ackInitiationFee"
                    checked={formData.ackInitiationFee}
                    onCheckedChange={(checked) => handleCheckboxChange("ackInitiationFee", checked as boolean)}
                    required
                    className="mt-1"
                  />
                  <Label htmlFor="ackInitiationFee" className="font-normal cursor-pointer text-sm leading-relaxed text-foreground">
                    I understand that a $300 initiation fee is due upon approval of my application. This fee is non-refundable under any circumstances.
                  </Label>
                </div>

                {/* 3 — Membership Agreement (paired with the document) */}
                <div className="space-y-3">
                  <MembershipAgreementSection
                    isSigned={formData.ackMembershipAgreement}
                    onCheckboxChange={(checked) => handleCheckboxChange("ackMembershipAgreement", checked as boolean)}
                  />
                </div>

                {/* 4 — Liability Waiver (paired with the document) */}
                <div className="space-y-3">
                  <LiabilityWaiverSection
                    isSigned={formData.ackLiabilityWaiver}
                    onCheckboxChange={(checked) => handleCheckboxChange("ackLiabilityWaiver", checked as boolean)}
                  />
                </div>

                {/* 5 — Card on file */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="ackCardOnFile"
                    checked={formData.ackCardOnFile}
                    onCheckedChange={(checked) => handleCheckboxChange("ackCardOnFile", checked as boolean)}
                    required
                    className="mt-1"
                  />
                  <Label htmlFor="ackCardOnFile" className="font-normal cursor-pointer text-sm leading-relaxed text-foreground">
                    I understand that a valid credit or debit card is required on file upon membership activation. My card will be kept securely on file for recurring monthly dues.
                  </Label>
                </div>

                {/* 6 — Final readiness */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="ackFinalReadiness"
                    checked={formData.ackFinalReadiness}
                    onCheckedChange={(checked) => handleCheckboxChange("ackFinalReadiness", checked as boolean)}
                    required
                    className="mt-1"
                  />
                  <Label htmlFor="ackFinalReadiness" className="font-normal cursor-pointer text-sm leading-relaxed text-foreground">
                    I confirm that I have fully read this application, understand all terms and commitments, and am ready to move forward as a Storm Wellness Club member upon approval.
                  </Label>
                </div>
              </div>
            </div>

            {/* Application notice */}
            <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto mb-6 leading-relaxed">
              Storm Wellness Club reviews each application personally. In some cases, our team may reach out before a final decision is made. This is part of our process — and a sign of genuine interest.
            </p>

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
