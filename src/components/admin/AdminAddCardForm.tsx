import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatSetupError } from "@/lib/stripeErrors";

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
        toast.error(formatSetupError(error));
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
        // Fetch card details from Stripe
        let cardBrand: string | null = null;
        let cardLast4: string | null = null;
        let cardExpMonth: number | null = null;
        let cardExpYear: number | null = null;

        if (stripeCustomerId) {
          try {
            const { data: pmData } = await supabase.functions.invoke("stripe-payment", {
              body: {
                action: "list_payment_methods",
                stripeCustomerId: stripeCustomerId,
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
        }

        if (applicationId && stripeCustomerId) {
          await supabase
            .from('membership_applications')
            .update({ 
              stripe_customer_id: stripeCustomerId,
              payment_info_provided: true,
              card_brand: cardBrand,
              card_last4: cardLast4,
              card_exp_month: cardExpMonth,
              card_exp_year: cardExpYear,
            })
            .eq('id', applicationId);
          console.log("[AdminAddCardForm] Synced stripe_customer_id and card details to application:", applicationId);
        }

        if (memberId && stripeCustomerId) {
          await supabase
            .from('members')
            .update({ 
              stripe_customer_id: stripeCustomerId,
                card_brand: cardBrand,
                card_last4: cardLast4,
                card_exp_month: cardExpMonth,
                card_exp_year: cardExpYear,
              })
              .eq('id', memberId);
            console.log("[AdminAddCardForm] Synced stripe_customer_id and card details to member:", memberId);
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

        toast.success("Card added successfully!");
        setIsComplete(true);
        onSuccess();
      } catch (syncError) {
        console.error("[AdminAddCardForm] Failed to sync card details:", syncError);
        // Still show success - webhook will handle sync
        toast.success("Card added successfully! Syncing details...");
        setIsComplete(true);
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
