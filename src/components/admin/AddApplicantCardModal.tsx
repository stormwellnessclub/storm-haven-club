import { useState, useEffect, useRef } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StripeProvider } from "@/components/StripeProvider";

interface AddApplicantCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  applicantEmail: string;
  applicantName: string;
  applicationId: string;
}

function CardForm({ onSuccess, onCancel, applicantEmail, applicantName, applicationId, customerId }: {
  onSuccess: () => void;
  onCancel: () => void;
  applicantEmail: string;
  applicantName: string;
  applicationId: string;
  customerId: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setElementError(null);

    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setElementError(submitError.message || "Please complete the form");
        setIsSubmitting(false);
        return;
      }

      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (error) {
        toast.error(error.message || "Failed to save card");
        setIsSubmitting(false);
        return;
      }

      // Validate setupIntent exists and has payment_method
      if (!setupIntent) {
        console.error("[AddApplicantCardModal] Setup intent not returned");
        toast.error("Setup failed - no setup intent returned. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (setupIntent.status !== "succeeded") {
        console.error("[AddApplicantCardModal] Setup intent not succeeded:", {
          status: setupIntent.status,
          setupIntentId: setupIntent.id,
        });
        toast.error(`Payment setup incomplete (status: ${setupIntent.status}). Please try again.`);
        setIsSubmitting(false);
        return;
      }

      if (!setupIntent.payment_method || typeof setupIntent.payment_method !== "string") {
        console.error("[AddApplicantCardModal] Setup intent succeeded but no payment method:", {
          setupIntentId: setupIntent.id,
          status: setupIntent.status,
          payment_method: setupIntent.payment_method,
        });
        toast.error("Card setup completed but payment method was not saved. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Immediately sync to membership_applications for instant UI update
      // The webhook provides backup sync
      if (customerId && applicationId) {
        // Fetch card details from Stripe via the payment method
        let cardBrand: string | null = null;
        let cardLast4: string | null = null;
        let cardExpMonth: number | null = null;
        let cardExpYear: number | null = null;

        try {
          // Get payment methods for the customer to extract card details
          const { data: pmData } = await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "list_application_payment_methods",
              stripeCustomerId: customerId,
            },
          });

          if (pmData?.paymentMethods && pmData.paymentMethods.length > 0) {
            const latestCard = pmData.paymentMethods[0];
            cardBrand = latestCard.brand || null;
            cardLast4 = latestCard.last4 || null;
            cardExpMonth = latestCard.expMonth || null;
            cardExpYear = latestCard.expYear || null;
          }
        } catch (cardErr) {
          console.error("Failed to fetch card details:", cardErr);
          // Continue without card details - webhook will handle it
        }

        const { error: updateError } = await supabase
          .from("membership_applications")
          .update({
            stripe_customer_id: customerId,
            payment_info_provided: true,
            card_brand: cardBrand,
            card_last4: cardLast4,
            card_exp_month: cardExpMonth,
            card_exp_year: cardExpYear,
          })
            .eq("id", applicationId);

        if (updateError) {
          console.error("Failed to sync stripe_customer_id:", updateError);
          // Don't fail the operation - webhook will handle it
        } else {
          console.log("Successfully synced stripe_customer_id and card details to application", { 
            applicationId, 
            customerId,
            cardBrand,
            cardLast4
          });
        }
        toast.success("Card added successfully!");
        onSuccess();
      } else {
        toast.error("Missing customer ID or application ID");
      }
    } catch (err) {
      console.error("Setup error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground mb-1">Adding card for:</p>
        <p className="font-medium">{applicantName}</p>
        <p className="text-sm text-muted-foreground">{applicantEmail}</p>
      </div>

      <div className="min-h-[200px] max-h-[50vh] overflow-y-auto relative">
        {!isElementReady && !elementError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-accent" />
              <p className="text-sm text-muted-foreground">Loading secure card form...</p>
            </div>
          </div>
        )}
        {elementError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center p-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm text-destructive mb-2">{elementError}</p>
            </div>
          </div>
        )}
        <div tabIndex={-1}>
          <PaymentElement 
            options={{
              layout: "tabs",
            }}
            onReady={() => setIsElementReady(true)}
            onLoadError={(error) => {
              console.error("PaymentElement load error:", error);
              setElementError("Failed to load payment form. Please refresh and try again.");
            }}
          />
        </div>
      </div>

      <div className="sticky bottom-0 bg-background pt-4 mt-4 border-t flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || !elements || isSubmitting || !isElementReady}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Save Card
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function AddApplicantCardModal({ 
  open, 
  onOpenChange, 
  onSuccess, 
  applicantEmail, 
  applicantName,
  applicationId 
}: AddApplicantCardModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setupIntentKeyRef = useRef(0);

  const fetchClientSecret = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "create_application_setup",
          applicantEmail,
          applicantName,
          successUrl: window.location.origin + window.location.pathname,
          cancelUrl: window.location.origin + window.location.pathname,
        },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      setClientSecret(data.clientSecret);
      setCustomerId(data.customerId || null);
      setupIntentKeyRef.current += 1;
    } catch (err) {
      console.error("Failed to create setup intent:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize card form");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && !clientSecret && !isLoading && !error) {
      fetchClientSecret();
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setClientSecret(null);
      setCustomerId(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSuccess = () => {
    setClientSecret(null);
    setCustomerId(null);
    setError(null);
    onSuccess();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-accent" />
            Add Payment Method for Applicant
          </DialogTitle>
          <DialogDescription>
            Add a payment method for this applicant. This will be saved to their account.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading && (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-accent" />
            <p className="text-muted-foreground">Preparing secure form...</p>
          </div>
        )}

        {error && (
          <div className="py-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={fetchClientSecret}>
              Try Again
            </Button>
          </div>
        )}

        {clientSecret && !isLoading && !error && (
          <StripeProvider key={`stripe-${setupIntentKeyRef.current}`} clientSecret={clientSecret}>
            <CardForm 
              onSuccess={handleSuccess} 
              onCancel={handleCancel}
              applicantEmail={applicantEmail}
              applicantName={applicantName}
              applicationId={applicationId}
              customerId={customerId}
            />
          </StripeProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
