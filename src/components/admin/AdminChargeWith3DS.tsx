import { useState, useEffect } from "react";
import { useStripe, useElements, Elements } from "@stripe/react-stripe-js";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface ChargeResult {
  success: boolean;
  paymentIntentId?: string;
  status?: string;
  cardBrand?: string;
  cardLast4?: string;
  requires_action?: boolean;
  clientSecret?: string;
  error?: string;
}

interface AdminChargeWith3DSProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stripeCustomerId: string;
  amount: number;
  description: string;
  applicationId?: string;
  memberId?: string;
  onSuccess: (result: ChargeResult) => void;
  onError: (error: string) => void;
}

// Inner component that uses Stripe hooks
function ChargeHandler({
  clientSecret,
  onSuccess,
  onError,
  onComplete,
}: {
  clientSecret: string;
  onSuccess: (result: ChargeResult) => void;
  onError: (error: string) => void;
  onComplete: () => void;
}) {
  const stripe = useStripe();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");

  useEffect(() => {
    if (!stripe || !clientSecret) return;

    const handle3DS = async () => {
      setIsProcessing(true);
      setStatus("processing");

      try {
        // Handle the 3DS authentication
        const { error, paymentIntent } = await stripe.handleNextAction({
          clientSecret,
        });

        if (error) {
          setStatus("error");
          onError(error.message || "3DS authentication failed");
          return;
        }

        if (paymentIntent?.status === "succeeded") {
          setStatus("success");
          onSuccess({
            success: true,
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
          });
        } else if (paymentIntent?.status === "requires_confirmation") {
          // Need to confirm the payment after 3DS
          const { error: confirmError, paymentIntent: confirmedIntent } = await stripe.confirmCardPayment(clientSecret);
          
          if (confirmError) {
            setStatus("error");
            onError(confirmError.message || "Payment confirmation failed");
            return;
          }

          if (confirmedIntent?.status === "succeeded") {
            setStatus("success");
            onSuccess({
              success: true,
              paymentIntentId: confirmedIntent.id,
              status: confirmedIntent.status,
            });
          } else {
            setStatus("error");
            onError(`Payment failed with status: ${confirmedIntent?.status}`);
          }
        } else {
          setStatus("error");
          onError(`Unexpected payment status: ${paymentIntent?.status}`);
        }
      } catch (err) {
        setStatus("error");
        onError(err instanceof Error ? err.message : "3DS processing failed");
      } finally {
        setIsProcessing(false);
        onComplete();
      }
    };

    handle3DS();
  }, [stripe, clientSecret, onSuccess, onError, onComplete]);

  return (
    <div className="py-6 flex flex-col items-center justify-center space-y-4">
      {status === "processing" && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Processing 3D Secure authentication...</p>
          <p className="text-xs text-muted-foreground">
            A secure verification window should appear. Complete the verification to continue.
          </p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <p className="text-primary font-medium">Payment successful!</p>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive font-medium">Verification failed</p>
        </>
      )}
    </div>
  );
}

export function AdminChargeWith3DS({
  open,
  onOpenChange,
  stripeCustomerId,
  amount,
  description,
  applicationId,
  memberId,
  onSuccess,
  onError,
}: AdminChargeWith3DSProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initialResult, setInitialResult] = useState<ChargeResult | null>(null);

  // Initialize the charge when dialog opens
  useEffect(() => {
    if (!open || !stripeCustomerId) return;

    const initializeCharge = async () => {
      setIsInitializing(true);
      setClientSecret(null);
      setInitialResult(null);

      try {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card_with_3ds",
            stripeCustomerId,
            amount,
            description,
            applicationId,
            memberId,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.requires_action && data?.clientSecret) {
          // Card requires 3DS - show the handler
          setClientSecret(data.clientSecret);
        } else if (data?.success) {
          // Charge succeeded without 3DS
          setInitialResult(data);
          onSuccess(data);
        } else {
          throw new Error(data?.error || "Unexpected response from charge");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to initialize charge";
        onError(message);
        toast.error(message);
        onOpenChange(false);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeCharge();
  }, [open, stripeCustomerId, amount, description, applicationId, memberId]);

  const handleComplete = () => {
    // Close dialog after a short delay to show success/error state
    setTimeout(() => {
      onOpenChange(false);
      setClientSecret(null);
      setInitialResult(null);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            3D Secure Verification
          </DialogTitle>
          <DialogDescription>
            This card requires additional verification for security.
          </DialogDescription>
        </DialogHeader>

        {isInitializing && (
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Initiating secure payment...</p>
          </div>
        )}

        {clientSecret && (
          <Elements stripe={stripePromise}>
            <ChargeHandler
              clientSecret={clientSecret}
              onSuccess={onSuccess}
              onError={onError}
              onComplete={handleComplete}
            />
          </Elements>
        )}

        {initialResult?.success && !clientSecret && (
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <p className="text-primary font-medium">Payment successful!</p>
            <p className="text-sm text-muted-foreground">
              {initialResult.cardBrand} •••• {initialResult.cardLast4}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {initialResult?.success ? "Done" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Wrapper component that conditionally renders with Stripe Elements
export function AdminChargeWith3DSProvider(props: AdminChargeWith3DSProps) {
  return <AdminChargeWith3DS {...props} />;
}
