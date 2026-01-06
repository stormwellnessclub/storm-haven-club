import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useUserMembership } from "@/hooks/useUserMembership";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AnnualFeeNotice() {
  const { isAnnualFeeOverdue, isDuesPastDue, isLoading: paymentLoading } = usePaymentStatus();
  const { data: membership } = useUserMembership();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const hasPaymentIssues = isAnnualFeeOverdue || isDuesPastDue;

  if (paymentLoading || !hasPaymentIssues || isDismissed) {
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

  const handleUpdatePaymentMethod = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "customer_portal",
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening customer portal:", err);
      toast.error("Failed to open billing portal. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine message and actions based on what's overdue
  const getMessage = () => {
    if (isAnnualFeeOverdue && isDuesPastDue) {
      return "Payment required: Annual fee and monthly dues are overdue. Please update your payment method to continue your membership benefits.";
    } else if (isAnnualFeeOverdue) {
      return "Your annual fee is required to continue your membership benefits.";
    } else if (isDuesPastDue) {
      return "Monthly dues payment required. Please update your payment method to continue your membership benefits.";
    }
    return "";
  };

  const getActionButton = () => {
    if (isDuesPastDue && isAnnualFeeOverdue) {
      return (
        <Button
          onClick={handleUpdatePaymentMethod}
          disabled={isProcessing}
          size="sm"
          variant="outline"
          className="border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950"
        >
          {isProcessing ? "Loading..." : "Update Payment Method"}
        </Button>
      );
    } else if (isAnnualFeeOverdue) {
      return (
        <Button
          onClick={handlePayAnnualFee}
          disabled={isProcessing}
          size="sm"
          variant="outline"
          className="border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950"
        >
          {isProcessing ? "Processing..." : "Pay Annual Fee"}
        </Button>
      );
    } else if (isDuesPastDue) {
      return (
        <Button
          onClick={handleUpdatePaymentMethod}
          disabled={isProcessing}
          size="sm"
          variant="outline"
          className="border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950"
        >
          {isProcessing ? "Loading..." : "Update Payment Method"}
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {getMessage()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {getActionButton()}
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
