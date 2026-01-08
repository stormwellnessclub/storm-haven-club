import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useUserMembership } from "@/hooks/useUserMembership";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { getAnnualFeeAmount, getMembershipPrice, normalizeTierName, normalizeGender, MembershipTier, BillingType, Gender } from "@/lib/stripeProducts";

export function PaymentDueNotice() {
  const { isInitiationFeePaid, hasActiveSubscription, isDuesPastDue, hasPaymentIssues, isLoading } = usePaymentStatus();
  const { data: membership } = useUserMembership();
  const [isProcessing, setIsProcessing] = useState(false);

  if (isLoading || !hasPaymentIssues || !membership) {
    return null;
  }

  // Get pricing info
  const tier = normalizeTierName(membership.membership_type) as MembershipTier;
  const billingType = (membership.is_founding_member ? "annual" : (membership.billing_type || "monthly")) as BillingType;
  const gender = normalizeGender(membership.gender) as Gender;
  const initiationFeeAmount = getAnnualFeeAmount(gender);
  const membershipPrice = getMembershipPrice(tier, billingType, gender);

  const handleCompletePayment = async () => {
    setIsProcessing(true);
    try {
      // If initiation fee not paid, pay that first
      if (!isInitiationFeePaid) {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "pay_annual_fee",
            gender: membership.gender || "women",
          },
        });

        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      }
      
      // If initiation fee paid but no subscription, redirect to billing portal
      if (isInitiationFeePaid && !hasActiveSubscription) {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: { action: "customer_portal" },
        });

        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      }

      // If just past due, go to customer portal to update payment method
      if (isDuesPastDue) {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: { action: "customer_portal" },
        });

        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process payment request",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Build message based on what's missing
  const getMessageContent = () => {
    const issues: string[] = [];
    
    if (!isInitiationFeePaid) {
      issues.push(`Initiation Fee ($${initiationFeeAmount})`);
    }
    if (!hasActiveSubscription && isInitiationFeePaid) {
      const duesText = membershipPrice 
        ? `$${membershipPrice.amount}/${membershipPrice.interval === "year" ? "yr" : "mo"}`
        : "";
      issues.push(`Membership Dues Setup${duesText ? ` (${duesText})` : ""}`);
    }
    if (isDuesPastDue) {
      issues.push("Past Due Payment");
    }

    return issues;
  };

  const issues = getMessageContent();
  const buttonText = !isInitiationFeePaid 
    ? "Pay Initiation Fee" 
    : !hasActiveSubscription 
      ? "Set Up Billing" 
      : "Update Payment Method";

  return (
    <div className="bg-destructive/10 border-b border-destructive/20">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-destructive">
                Payment Required — Benefits Frozen
              </p>
              <p className="text-sm text-muted-foreground">
                Complete the following to activate your membership: {issues.join(", ")}
              </p>
            </div>
          </div>
          <Button 
            onClick={handleCompletePayment} 
            disabled={isProcessing}
            variant="destructive"
            size="sm"
            className="flex-shrink-0"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                {buttonText}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}