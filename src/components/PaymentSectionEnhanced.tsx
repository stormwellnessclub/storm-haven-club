import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Check, CreditCard, Lock, Shield, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { StripeProvider } from "@/components/StripeProvider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { formatSetupError } from "@/lib/stripeErrors";

export interface CardDetails {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

// Loading messages for payment form
const LOADING_MESSAGES = [
  "Preparing secure checkout...",
  "Setting up encryption...",
  "Loading payment form...",
  "Almost ready...",
];

interface PaymentFormProps {
  clientSecret: string;
  customerId: string; // Pass customerId directly instead of relying on draft
  onSuccess: (customerId: string, cardDetails?: CardDetails) => void;
  onCancel: () => void;
}

function PaymentFormInner({ clientSecret, customerId, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Cycle loading messages
  useEffect(() => {
    if (!isElementReady) {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isElementReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError("Payment form not ready. Please wait...");
      return;
    }

    setIsSubmitting(true);

    try {
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
        // Log the failure for audit trail
        try {
          await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "log_card_setup_failure",
              stripeCustomerId: customerId || undefined,
              source: "self_service",
              declineCode: confirmError.decline_code || confirmError.code || undefined,
              declineMessage: confirmError.message || "Card declined",
            },
          });
          console.log("[PaymentSectionEnhanced] Logged card setup failure");
        } catch (logErr) {
          console.warn("[PaymentSectionEnhanced] Failed to log card setup failure:", logErr);
        }
        
        setError(formatSetupError(confirmError));
        setIsSubmitting(false);
        return;
      }

      // CRITICAL: Validate setupIntent exists
      if (!setupIntent) {
        console.error("[PaymentSectionEnhanced] Setup intent not returned from confirmSetup");
        setError("Setup failed - no setup intent returned. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // CRITICAL: Validate setup intent status is succeeded
      if (setupIntent.status !== "succeeded") {
        console.error("[PaymentSectionEnhanced] Setup intent not succeeded:", {
          status: setupIntent.status,
          setupIntentId: setupIntent.id,
        });
        setError(`Payment setup incomplete (status: ${setupIntent.status}). Please try again.`);
        setIsSubmitting(false);
        return;
      }

      // CRITICAL: Validate payment_method exists - can be a string OR object with id
      // Stripe may return payment_method as an expanded object instead of just a string ID
      const paymentMethodId = typeof setupIntent.payment_method === "string" 
        ? setupIntent.payment_method 
        : (setupIntent.payment_method as any)?.id;
      
      if (!paymentMethodId) {
        console.error("[PaymentSectionEnhanced] Setup intent succeeded but no payment method:", {
          setupIntentId: setupIntent.id,
          status: setupIntent.status,
          payment_method: setupIntent.payment_method,
        });
        setError("Card setup completed but payment method was not saved. Please try again.");
        setIsSubmitting(false);
        return;
      }
      
      console.log("[PaymentSectionEnhanced] Payment method ID resolved:", paymentMethodId);

      // All validations passed - proceed with success
      if (!customerId) {
        console.error("[PaymentSectionEnhanced] Customer ID missing after successful payment method save");
        throw new Error("Unable to determine customer ID after payment method save");
      }

      // Fetch card details from Stripe with RETRY LOGIC to handle eventual consistency
      let cardDetails: CardDetails | undefined;
      const maxAttempts = 4;
      let attempts = 0;
      
      while (attempts < maxAttempts && !cardDetails) {
        // Increasing delays: 2s, 2s, 2.5s, 3s
        const delay = attempts === 0 ? 2000 : (attempts === 1 ? 2000 : (attempts === 2 ? 2500 : 3000));
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
        
        try {
          console.log(`[PaymentForm] Attempt ${attempts}/${maxAttempts} - Fetching card details for customer: ${customerId}`);
          
          const { data: pmData, error: pmError } = await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "list_application_payment_methods",
              stripeCustomerId: customerId,
            },
          });
          
          // Log the full response for debugging
          console.log(`[PaymentForm] Attempt ${attempts} - Response:`, { 
            pmData, 
            pmError,
            hasPaymentMethods: pmData?.paymentMethods?.length > 0
          });
          
          if (pmError) {
            console.error(`[PaymentForm] Attempt ${attempts} - Edge function error:`, pmError);
            continue; // Try again
          }
          
          if (pmData?.paymentMethods?.[0]) {
            const card = pmData.paymentMethods[0];
            cardDetails = {
              brand: card.brand || null,
              last4: card.last4 || null,
              expMonth: card.expMonth || null,
              expYear: card.expYear || null,
            };
            console.log("[PaymentForm] Successfully fetched card details:", cardDetails);
          } else {
            console.warn(`[PaymentForm] Attempt ${attempts} - No payment methods returned, will retry...`);
          }
        } catch (err) {
          console.error(`[PaymentForm] Attempt ${attempts} - Exception:`, err);
          // Continue to next attempt
        }
      }
      
      if (!cardDetails) {
        console.warn("[PaymentForm] Could not fetch card details after all attempts - webhook will sync later");
      }

      // Log successful save for debugging
      console.log("[PaymentSectionEnhanced] Payment method saved successfully:", {
        setupIntentId: setupIntent.id,
        paymentMethodId: setupIntent.payment_method,
        customerId,
      });
        
      onSuccess(customerId, cardDetails);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save payment method";
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Handle form submission via button click (NOT a <form> to avoid nested form issues)
  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSubmit(e as unknown as React.FormEvent);
  };

  return (
    <div className="space-y-4">
      <div className="min-h-[300px] relative">
        {!isElementReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 mx-auto rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                <Shield className="w-6 h-6 text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">
                {LOADING_MESSAGES[loadingMessageIndex]}
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center p-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm text-destructive mb-2">{error}</p>
              <Button type="button" variant="outline" onClick={() => {
                setError(null);
                setIsElementReady(false);
              }}>
                Try Again
              </Button>
            </div>
          </div>
        )}
        <div tabIndex={-1}>
          <PaymentElement
            options={{ layout: "tabs" }}
            onReady={() => setIsElementReady(true)}
            onLoadError={(loadError) => {
              const errorMessage = loadError.error?.message || "Unknown error";
              setError(`Failed to load payment form: ${errorMessage}`);
              setIsElementReady(false);
            }}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
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
          onClick={handleButtonClick}
          disabled={!stripe || !elements || isSubmitting || !isElementReady}
          variant="gold"
          className="flex-1"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Payment Method
        </Button>
      </div>
    </div>
  );
}

interface PaymentSectionEnhancedProps {
  stripeCustomerId: string | null;
  isCardConfirmed: boolean;
  showPaymentForm: boolean;
  paymentClientSecret: string | null;
  isSavingCard: boolean;
  creditCardAuth: boolean;
  paymentAcknowledged: boolean;
  canStartPayment: boolean;
  savedCardDetails?: CardDetails | null;
  onSavePaymentMethod: () => void;
  onPaymentSuccess: (customerId: string, cardDetails?: CardDetails) => void;
  onPaymentCancel: () => void;
  onCheckboxChange: (field: string, checked: boolean) => void;
}

export function PaymentSectionEnhanced({
  stripeCustomerId,
  isCardConfirmed,
  showPaymentForm,
  paymentClientSecret,
  isSavingCard,
  creditCardAuth,
  paymentAcknowledged,
  canStartPayment,
  savedCardDetails,
  onSavePaymentMethod,
  onPaymentSuccess,
  onPaymentCancel,
  onCheckboxChange,
}: PaymentSectionEnhancedProps) {
  // Calculate section progress - use isCardConfirmed instead of just stripeCustomerId
  const paymentSteps = [
    { done: isCardConfirmed, label: "Payment method saved" },
    { done: creditCardAuth, label: "Authorization confirmed" },
    { done: paymentAcknowledged, label: "Terms acknowledged" },
  ];
  const completedSteps = paymentSteps.filter(s => s.done).length;
  const progressPercent = (completedSteps / paymentSteps.length) * 100;
  const isComplete = completedSteps === paymentSteps.length;

  return (
    <Card
      id="payment-section"
      className={cn(
        "mb-8 transition-all duration-300",
        !isComplete && "ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10",
        isComplete && "ring-2 ring-green-500/50"
      )}
    >
      <CardHeader className={cn(
        "border-b",
        !isComplete && "bg-amber-500/5",
        isComplete && "bg-green-500/5"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              !isComplete && "bg-amber-500/20 animate-pulse",
              isComplete && "bg-green-500/20"
            )}>
              {isComplete ? (
                <Check className="w-6 h-6 text-green-600" />
              ) : (
                <Lock className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Payment Setup
                {!isComplete && (
                  <span className="text-xs px-2 py-0.5 bg-amber-500 text-white rounded-full font-medium animate-pulse">
                    Required
                  </span>
                )}
                {isComplete && (
                  <span className="text-xs px-2 py-0.5 bg-green-500 text-white rounded-full font-medium">
                    Complete
                  </span>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {isComplete 
                  ? "Your payment information is saved and ready"
                  : "Complete all steps below to proceed with your application"
                }
              </CardDescription>
            </div>
          </div>
        </div>

        {/* Section Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Section Progress</span>
            <span className={cn(
              "font-medium",
              isComplete ? "text-green-600" : "text-amber-600"
            )}>
              {completedSteps} of {paymentSteps.length} steps
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Trust Signals */}
        <div className="flex flex-wrap gap-4 justify-center p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4 text-green-600" />
            256-bit SSL Encryption
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-4 h-4 text-blue-600" />
            PCI DSS Compliant
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">Powered by</span>
            <span className="font-bold text-[#635BFF]">Stripe</span>
          </div>
        </div>

        {/* Non-Refundable Fee Warning */}
        <div className="p-4 bg-destructive/10 border-2 border-destructive/40 rounded-lg">
          <p className="text-sm text-destructive flex items-start gap-2 font-medium">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>
              <strong className="text-base">⚠️ IMPORTANT: Your card WILL be charged upon approval.</strong>
              <br className="mb-1" />
              By saving your payment method, you authorize Storm Wellness Club to charge the 
              <strong> non-refundable</strong> initiation fee (Women: $300 / Men: $175) when your 
              membership is approved. <strong>Do not apply if you are not ready to commit to a 1-year membership.</strong>
            </span>
          </p>
        </div>

        {/* Step 1: Save Card */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
          <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              isCardConfirmed ? "bg-green-500 text-white" : "bg-amber-500 text-white"
            )}>
              {isCardConfirmed ? <Check className="w-4 h-4" /> : "1"}
            </div>
            <span className={cn(
              "font-medium",
              isCardConfirmed ? "text-green-600" : "text-foreground"
            )}>
              Save Payment Method
            </span>
          </div>

          {isCardConfirmed && !showPaymentForm ? (
            <div className="ml-8 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  {savedCardDetails?.brand && savedCardDetails?.last4 
                    ? `${savedCardDetails.brand.toUpperCase()} •••• ${savedCardDetails.last4}`
                    : "Payment Method Saved"
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {savedCardDetails?.expMonth && savedCardDetails?.expYear
                    ? `Expires ${String(savedCardDetails.expMonth).padStart(2, '0')}/${savedCardDetails.expYear}`
                    : "Your card has been securely saved for future billing."
                  }
                </p>
              </div>
            </div>
          ) : showPaymentForm && paymentClientSecret ? (
            <div className="ml-8">
              <StripeProvider clientSecret={paymentClientSecret}>
                <PaymentFormInner
                  clientSecret={paymentClientSecret}
                  customerId={stripeCustomerId || ""}
                  onSuccess={onPaymentSuccess}
                  onCancel={onPaymentCancel}
                />
              </StripeProvider>
            </div>
          ) : (
            <div className="ml-8 space-y-3">
              <Button
                type="button"
                variant="gold"
                size="lg"
                onClick={onSavePaymentMethod}
                disabled={isSavingCard || !canStartPayment}
                className="w-full sm:w-auto"
              >
                {isSavingCard ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Preparing Secure Form...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 w-5 h-5" />
                    Add Payment Method
                  </>
                )}
              </Button>
              {!canStartPayment && (
                <p className="text-xs text-amber-600">
                  Please fill in your name and email in the Personal Information section first.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Authorization */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              creditCardAuth ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
            )}>
              {creditCardAuth ? <Check className="w-4 h-4" /> : "2"}
            </div>
            <span className={cn(
              "font-medium",
              creditCardAuth ? "text-green-600" : "text-foreground"
            )}>
              Authorize Billing
            </span>
          </div>
          <div className="ml-8 flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Checkbox
              id="creditCardAuth"
              checked={creditCardAuth}
              onCheckedChange={(checked) => onCheckboxChange("creditCardAuth", checked as boolean)}
            />
            <Label htmlFor="creditCardAuth" className="font-normal cursor-pointer text-sm leading-relaxed">
              I authorize Storm Wellness Club to charge the <strong>non-refundable</strong> initiation fee (Women: $300 / Men: $175) and recurring membership dues to this card. I understand the initiation fee is charged upon approval and is <strong>non-refundable</strong>. *
            </Label>
          </div>
        </div>

        {/* Step 3: Acknowledgment */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              paymentAcknowledged ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
            )}>
              {paymentAcknowledged ? <Check className="w-4 h-4" /> : "3"}
            </div>
            <span className={cn(
              "font-medium",
              paymentAcknowledged ? "text-green-600" : "text-foreground"
            )}>
              Acknowledge Terms
            </span>
          </div>
          <div className="ml-8 flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Checkbox
              id="paymentAcknowledged"
              checked={paymentAcknowledged}
              onCheckedChange={(checked) => onCheckboxChange("paymentAcknowledged", checked as boolean)}
            />
            <Label htmlFor="paymentAcknowledged" className="font-normal cursor-pointer text-sm leading-relaxed">
              I understand this is a minimum <strong>1-year membership commitment</strong>. I agree not to file a chargeback or payment dispute for the initiation fee or any authorized membership charges. *
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
