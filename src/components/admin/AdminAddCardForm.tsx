import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface AdminAddCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminAddCardForm({ onSuccess, onCancel }: AdminAddCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast.error("Payment system not ready");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("Card setup error:", error);
        toast.error(error.message || "Failed to save card");
      } else {
        setIsComplete(true);
        toast.success("Card saved successfully");
        onSuccess();
      }
    } catch (err: any) {
      console.error("Card setup exception:", err);
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-3">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-sm font-medium">Card saved successfully</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border rounded-lg p-4 bg-background">
        <PaymentElement 
          options={{
            layout: "tabs",
          }}
        />
      </div>
      
      <div className="flex justify-end gap-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !stripe || !elements}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Save Card
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
