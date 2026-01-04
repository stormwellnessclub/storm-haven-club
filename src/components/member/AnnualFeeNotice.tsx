import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useUserMembership } from "@/hooks/useUserMembership";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AnnualFeeNotice() {
  const { isAnnualFeeOverdue, isLoading: paymentLoading } = usePaymentStatus();
  const { data: membership } = useUserMembership();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (paymentLoading || !isAnnualFeeOverdue || isDismissed) {
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
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <span className="font-medium">Annual membership renewal due.</span>{" "}
            Your annual fee is required to continue your membership benefits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handlePayAnnualFee}
            disabled={isProcessing}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Renew Now"
            )}
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
