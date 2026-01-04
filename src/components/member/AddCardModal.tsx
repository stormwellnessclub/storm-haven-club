import { useState, useEffect } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StripeProvider } from "@/components/StripeProvider";

interface AddCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  memberId: string;
}

function CardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Explicitly validate the form first
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setValidationError(submitError.message || "Please complete the form");
        setIsSubmitting(false);
        return;
      }

      const { error } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (error) {
        toast.error(error.message || "Failed to save card");
      } else {
        setIsComplete(true);
        toast.success("Card added successfully!");
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error("Setup error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="py-8 text-center">
        <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-semibold mb-2">Card Added Successfully!</h3>
        <p className="text-muted-foreground">Your payment method has been saved.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Scrollable content area */}
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
              <p className="text-xs text-muted-foreground">Please try again or contact support.</p>
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
      
      {/* Validation error display */}
      {validationError && (
        <p className="text-sm text-destructive mt-2">{validationError}</p>
      )}
      
      {/* Sticky footer - always visible */}
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

export function AddCardModal({ open, onOpenChange, onSuccess, memberId }: AddCardModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "create_setup_intent",
          memberId,
        },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      setClientSecret(data.clientSecret);
    } catch (err) {
      console.error("Failed to create setup intent:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize card form");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch client secret when modal opens
  useEffect(() => {
    if (open && !clientSecret && !isLoading && !error) {
      fetchClientSecret();
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setClientSecret(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSuccess = () => {
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
            Add Payment Method
          </DialogTitle>
          <DialogDescription>
            Add a new card to use for membership billing and purchases.
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
          <StripeProvider clientSecret={clientSecret}>
            <CardForm onSuccess={handleSuccess} onCancel={handleCancel} />
          </StripeProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
