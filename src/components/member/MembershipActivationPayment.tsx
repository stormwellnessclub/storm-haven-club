import { useState, useEffect } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MembershipActivationPaymentProps {
  memberId: string;
  tier: string;
  gender: string;
  isFoundingMember: boolean;
  startDate: string;
  skipAnnualFee: boolean;
  amount: number; // Total amount in dollars
  onSuccess: () => void;
  onCancel: () => void;
}

export function MembershipActivationPayment({
  memberId,
  tier,
  gender,
  isFoundingMember,
  startDate,
  skipAnnualFee,
  amount,
  clientSecret: propClientSecret,
  onSuccess,
  onCancel,
}: MembershipActivationPaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError("Payment form not ready. Please wait...");
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate the form first
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Please complete the payment form");
        setIsSubmitting(false);
        return;
      }

      // Get client secret from StripeProvider context (passed via Elements)
      // The client secret is already available in the PaymentElement context
      // We need to get it from the parent component that created the payment intent
      // For now, we'll need to pass it as a prop or get it from a context
      // Actually, the clientSecret should be passed to StripeProvider, which makes it available to PaymentElement
      // But we need it for confirmPayment - let's get it from the payment intent creation response stored in parent
      
      // Use client secret from prop if provided, otherwise create new payment intent
      let clientSecret = propClientSecret;
      
      if (!clientSecret) {
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "create_subscription_payment_intent",
            memberId,
            tier,
            gender,
            isFoundingMember,
            startDate,
            skipAnnualFee,
          },
        });

        if (paymentError) throw paymentError;
        if (paymentData?.error) throw new Error(paymentData.error);
        if (!paymentData?.clientSecret) throw new Error("No payment client secret returned");
        
        clientSecret = paymentData.clientSecret;
      }

      // Confirm payment with the payment method from Payment Element
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: clientSecret,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (confirmError) {
        setError(confirmError.message || "Payment failed. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // After payment succeeds, create subscription with the payment method
      if (paymentIntent?.payment_method) {
        const { data: subData, error: subError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "create_subscription_from_payment",
            memberId,
            tier,
            gender,
            isFoundingMember,
            startDate,
            skipAnnualFee,
            paymentMethodId: paymentIntent.payment_method as string,
            paymentIntentId: paymentIntent.id,
          },
        });

        if (subError || subData?.error) {
          // Payment succeeded but subscription creation failed - still show success
          // Admin can manually activate, or retry subscription creation
          console.error("Subscription creation error:", subError || subData?.error);
          toast.success("Payment processed. Setting up your subscription...");
        } else {
          toast.success("Payment successful! Your membership is being activated...");
        }
      } else {
        // Payment succeeded but no payment method - webhook will handle
        toast.success("Payment successful! Your membership is being activated...");
      }

      onSuccess();
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Failed to process payment. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Information
          </CardTitle>
          <CardDescription>
            Total: ${amount.toFixed(2)}
            {isFoundingMember && " (Annual payment)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isElementReady && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-accent" />
                <p className="text-sm text-muted-foreground">Loading secure payment form...</p>
              </div>
            </div>
          )}

          <div className={isElementReady ? "" : "opacity-0 absolute"}>
            <PaymentElement
              onReady={() => setIsElementReady(true)}
              onLoadError={(error) => {
                console.error("PaymentElement load error:", error);
                setError("Failed to load payment form. Please refresh and try again.");
              }}
              options={{
                layout: "tabs",
              }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

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
              className="flex-1"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pay ${amount.toFixed(2)} & Activate
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
