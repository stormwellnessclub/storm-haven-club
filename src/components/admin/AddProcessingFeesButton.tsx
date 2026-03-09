import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, DollarSign } from "lucide-react";

interface AddProcessingFeesButtonProps {
  subscriptionId: string;
  annualFeeSubscriptionId?: string | null;
  memberName: string;
}

export function AddProcessingFeesButton({
  subscriptionId,
  annualFeeSubscriptionId,
  memberName,
}: AddProcessingFeesButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddFees = async () => {
    setIsProcessing(true);
    try {
      let results: string[] = [];

      // Add to main subscription
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "add_processing_fees_to_subscription",
          subscriptionId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.skipped) {
        results.push("Main sub: already has fees");
      } else {
        results.push(`Main sub: ${data?.fees_added || 0} fees added`);
      }

      // Add to annual fee subscription if exists
      if (annualFeeSubscriptionId) {
        const { data: annualData, error: annualError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "add_processing_fees_to_subscription",
            subscriptionId: annualFeeSubscriptionId,
          },
        });

        if (!annualError && !annualData?.error) {
          if (annualData?.skipped) {
            results.push("Annual fee: already has fees");
          } else {
            results.push(`Annual fee: ${annualData?.fees_added || 0} fees added`);
          }
        }
      }

      toast.success(`Processing fees updated for ${memberName}: ${results.join(", ")}`);
      setShowConfirm(false);
    } catch (error: any) {
      console.error("Error adding processing fees:", error);
      toast.error(error.message || "Failed to add processing fees");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowConfirm(true)}
        className="gap-1"
      >
        <DollarSign className="h-3.5 w-3.5" />
        Add Processing Fees
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Processing Fees</AlertDialogTitle>
            <AlertDialogDescription>
              Add the 2.9% + $0.30 processing fee as a recurring line item to {memberName}'s subscription(s). 
              This will take effect on their next billing cycle. No immediate charge will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddFees} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Fees
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
