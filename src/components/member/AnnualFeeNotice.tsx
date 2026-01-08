import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useUserMembership } from "@/hooks/useUserMembership";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AnnualFeeNotice() {
  const { isInitiationFeePaid, hasActiveSubscription, isDuesPastDue, hasPaymentIssues, isLoading: paymentLoading } = usePaymentStatus();
  const { data: membership } = useUserMembership();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // This component now only shows for renewal notices (after first year)
  // Initial payment issues are handled by PaymentDueNotice
  const isRenewalDue = isInitiationFeePaid && membership?.annual_fee_paid_at && 
    new Date(membership.annual_fee_paid_at).getTime() < Date.now() - 365 * 24 * 60 * 60 * 1000;

  if (paymentLoading || !isRenewalDue || isDismissed) {
    return null;
  }

  const handlePayAnnualFee = async () => {
    if (!membership) return;
    
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "pay_annual_fee",
          memberId: membership.id,
          successUrl: `${window.location.origin}/member?annual_fee_paid=true`,
          cancelUrl: `${window.location.origin}/member`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error initiating annual fee payment:", error);
      toast.error("Failed to start payment process. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Your annual membership fee renewal is due. Please renew to maintain your membership benefits.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handlePayAnnualFee}
            disabled={isProcessing}
            size="sm"
            variant="outline"
            className="border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950"
          >
            {isProcessing ? "Processing..." : "Renew Annual Fee"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsDismissed(true)}
            className="text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
