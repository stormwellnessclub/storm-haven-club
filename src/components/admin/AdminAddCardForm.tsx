import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AdminAddCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  applicationId?: string;
  memberId?: string;
  stripeCustomerId?: string;
}

export function AdminAddCardForm({ 
  onSuccess, 
  onCancel, 
  applicationId,
  memberId,
  stripeCustomerId 
}: AdminAddCardFormProps) {
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
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("Card setup error:", error);
        toast.error(error.message || "Failed to save card");
        setIsSubmitting(false);
        return;
      }

      // Validate setupIntent exists and has payment_method
      if (!setupIntent) {
        console.error("[AdminAddCardForm] Setup intent not returned");
        toast.error("Setup failed - no setup intent returned. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (setupIntent.status !== "succeeded") {
        console.error("[AdminAddCardForm] Setup intent not succeeded:", {
          status: setupIntent.status,
          setupIntentId: setupIntent.id,
        });
        toast.error(`Payment setup incomplete (status: ${setupIntent.status}). Please try again.`);
        setIsSubmitting(false);
        return;
      }

      if (!setupIntent.payment_method || typeof setupIntent.payment_method !== "string") {
        console.error("[AdminAddCardForm] Setup intent succeeded but no payment method:", {
          setupIntentId: setupIntent.id,
          status: setupIntent.status,
          payment_method: setupIntent.payment_method,
        });
        toast.error("Card setup completed but payment method was not saved. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Sync to Supabase immediately after successful card save
      // This is a backup in case the webhook is delayed or fails
      try {
        if (applicationId && stripeCustomerId) {
          await supabase
            .from('membership_applications')
            .update({ 
              stripe_customer_id: stripeCustomerId,
              payment_info_provided: true 
            })
            .eq('id', applicationId);
          console.log("[AdminAddCardForm] Synced stripe_customer_id to application:", applicationId);
        }

        if (memberId && stripeCustomerId) {
          await supabase
            .from('members')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', memberId);
          console.log("[AdminAddCardForm] Synced stripe_customer_id to member:", memberId);
        }

        // Log the payment method update for audit trail
        if (memberId && setupIntent.payment_method) {
            await supabase
              .from('payment_method_updates')
              .insert({
                member_id: memberId,
                payment_method_id: setupIntent.payment_method as string,
                event_type: 'card_added_admin',
                is_default: false,
              });
            console.log("[AdminAddCardForm] Logged payment method update for member:", memberId);
          }
        } catch (syncError) {
          console.error("[AdminAddCardForm] Supabase sync error (non-blocking):", syncError);
          // Don't fail the card save - webhook should handle this too
        }

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
