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

// Loading messages for payment form
const LOADING_MESSAGES = [
  "Preparing secure checkout...",
  "Setting up encryption...",
  "Loading payment form...",
  "Almost ready...",
];

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: (customerId: string) => void;
  onCancel: () => void;
  loadDraft: () => { stripeCustomerId?: string | null } | null;
}

function PaymentFormInner({ clientSecret, onSuccess, onCancel, loadDraft }: PaymentFormProps) {
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
        setError(confirmError.message || "Failed to save payment method. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (setupIntent) {
        const draft = loadDraft();
        if (draft?.stripeCustomerId) {
          onSuccess(draft.stripeCustomerId);
        } else {
          onSuccess("");
        }
      } else {
        throw new Error("Setup failed - no setup intent returned");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save payment method";
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button variant="outline" onClick={() => {
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
          type="submit"
          disabled={!stripe || !elements || isSubmitting || !isElementReady}
          variant="gold"
          className="flex-1"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Payment Method
        </Button>
      </div>
    </form>
  );
}

interface PaymentSectionEnhancedProps {
  stripeCustomerId: string | null;
  showPaymentForm: boolean;
  paymentClientSecret: string | null;
  isSavingCard: boolean;
  creditCardAuth: boolean;
  paymentAcknowledged: boolean;
  canStartPayment: boolean;
  onSavePaymentMethod: () => void;
  onPaymentSuccess: (customerId: string) => void;
  onPaymentCancel: () => void;
  onCheckboxChange: (field: string, checked: boolean) => void;
  loadDraft: () => { stripeCustomerId?: string | null } | null;
}

export function PaymentSectionEnhanced({
  stripeCustomerId,
  showPaymentForm,
  paymentClientSecret,
  isSavingCard,
  creditCardAuth,
  paymentAcknowledged,
  canStartPayment,
  onSavePaymentMethod,
  onPaymentSuccess,
  onPaymentCancel,
  onCheckboxChange,
  loadDraft,
}: PaymentSectionEnhancedProps) {
  // Calculate section progress
  const paymentSteps = [
    { done: !!stripeCustomerId, label: "Payment method saved" },
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

        {/* Important Notice */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Your card will NOT be charged today.</strong> Payment is only processed 
              when your membership is approved and you choose to activate it.
            </span>
          </p>
        </div>

        {/* Step 1: Save Card */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              stripeCustomerId ? "bg-green-500 text-white" : "bg-amber-500 text-white"
            )}>
              {stripeCustomerId ? <Check className="w-4 h-4" /> : "1"}
            </div>
            <span className={cn(
              "font-medium",
              stripeCustomerId ? "text-green-600" : "text-foreground"
            )}>
              Save Payment Method
            </span>
          </div>

          {stripeCustomerId && !showPaymentForm ? (
            <div className="ml-8 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">Payment Method Saved</p>
                <p className="text-sm text-muted-foreground">Your card has been securely saved for future billing.</p>
              </div>
            </div>
          ) : showPaymentForm && paymentClientSecret ? (
            <div className="ml-8">
              <StripeProvider clientSecret={paymentClientSecret}>
                <PaymentFormInner
                  clientSecret={paymentClientSecret}
                  onSuccess={onPaymentSuccess}
                  onCancel={onPaymentCancel}
                  loadDraft={loadDraft}
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
              I authorize Storm Wellness Club to charge my saved payment method upon membership activation. *
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
              I acknowledge that the initiation fee will be charged upon activation and I agree to the billing terms. *
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
